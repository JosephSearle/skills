# TTS Model Dataset Format

## Supported TTS Models

Fine-tune with Unsloth for:
- **Orpheus-TTS** — primary supported TTS model (24kHz)
- **Sesame-CSM** — conversational speech model

---

## Required Data Structure

TTS datasets pair an audio file with its normalised text transcript:

```json
{
  "audio": "path/to/audio_clip.wav",
  "transcript": "The exact words spoken in the clip, normalised."
}
```

Or as a HuggingFace Dataset with `Audio` feature:

```python
from datasets import Dataset, Audio

dataset = Dataset.from_dict({
    "audio":      ["/path/to/clip1.wav", "/path/to/clip2.wav"],
    "transcript": ["Hello world.", "How are you today?"],
})
dataset = dataset.cast_column("audio", Audio(sampling_rate=24000))
```

---

## Audio Requirements

### Sampling Rate

Orpheus-TTS requires exactly **24,000 Hz (24kHz)**. Other rates must be resampled:

```python
import librosa
import soundfile as sf

def resample_to_24k(input_path: str, output_path: str):
    audio, sr = librosa.load(input_path, sr=None)
    if sr != 24000:
        audio = librosa.resample(audio, orig_sr=sr, target_sr=24000)
    sf.write(output_path, audio, 24000)
```

Always verify sampling rate before preparing the dataset:
```python
import soundfile as sf
info = sf.info("clip.wav")
print(info.samplerate)  # must be 24000
```

### Duration Guidelines

| Duration | Notes |
|---|---|
| < 1 second | Too short — model learns poorly from brief clips |
| 1–15 seconds | Optimal range |
| 15–30 seconds | Acceptable; may hit sequence length limits |
| > 30 seconds | Split into shorter clips |

### Audio Quality

- **Format:** WAV preferred; MP3 and FLAC accepted but convert to WAV for consistency
- **Channels:** Mono (single channel) — stereo is averaged to mono
- **Noise:** Clean speech performs significantly better; background music or noise degrades results
- **Clipping:** Avoid audio that clips (hits max amplitude); normalise to -3 dBFS

---

## Transcript Normalisation

The transcript must match exactly what is spoken in the audio. Normalisation rules:

1. **Expand abbreviations:** "Dr." → "Doctor", "e.g." → "for example"
2. **Expand numbers:** "42" → "forty-two", "2024" → "twenty twenty-four"
3. **Expand currencies:** "$5.99" → "five dollars and ninety-nine cents"
4. **Spell out acronyms** if spoken letter-by-letter: "API" → "A P I"
   or leave if spoken as a word: "NASA" → "NASA"
5. **Remove non-spoken symbols:** remove `*`, `#`, `@` unless they are spoken
6. **Preserve punctuation** that marks natural pauses (`.`, `,`, `?`, `!`)
7. **Match case** to the actual spoken emphasis — keep proper nouns capitalised

```python
import re

def normalise_transcript(text: str) -> str:
    # Expand common abbreviations
    text = re.sub(r'\bDr\.', 'Doctor', text)
    text = re.sub(r'\bMr\.', 'Mister', text)
    text = re.sub(r'\bMrs\.', 'Missus', text)
    text = re.sub(r'\bSt\.', 'Saint', text)
    # Remove symbols that are never spoken
    text = re.sub(r'[*#@]', '', text)
    # Collapse multiple whitespace
    text = re.sub(r'\s+', ' ', text).strip()
    return text
```

---

## Building the Dataset from Raw Audio + Transcripts

### From a directory of WAV files + a CSV manifest

```python
import csv
import json
import soundfile as sf
from pathlib import Path

def build_tts_dataset(
    manifest_path: str,
    audio_dir: str,
    output_path: str,
    target_sr: int = 24000,
):
    """
    Expects manifest CSV with columns: filename, transcript
    """
    records = []
    with open(manifest_path) as f:
        reader = csv.DictReader(f)
        for row in reader:
            audio_path = str(Path(audio_dir) / row["filename"])
            info = sf.info(audio_path)
            if info.samplerate != target_sr:
                raise ValueError(
                    f"{row['filename']}: sampling rate is {info.samplerate}Hz, "
                    f"expected {target_sr}Hz. Resample first."
                )
            records.append({
                "audio":      audio_path,
                "transcript": normalise_transcript(row["transcript"]),
            })
    with open(output_path, "w") as f:
        for r in records:
            f.write(json.dumps(r) + "\n")
    print(f"Prepared {len(records)} TTS examples → {output_path}")
```

### From LJSpeech-style dataset (common public TTS dataset format)

LJSpeech uses pipe-separated metadata (`metadata.csv`):
```
LJ001-0001|Printing, in the only sense...| Printing, in the only sense...
```

```python
def from_ljspeech(metadata_path: str, wav_dir: str, output_path: str):
    records = []
    with open(metadata_path) as f:
        for line in f:
            parts = line.strip().split("|")
            filename = parts[0] + ".wav"
            transcript = parts[2] if len(parts) > 2 else parts[1]
            records.append({
                "audio":      str(Path(wav_dir) / filename),
                "transcript": normalise_transcript(transcript),
            })
    with open(output_path, "w") as f:
        for r in records:
            f.write(json.dumps(r) + "\n")
```

---

## Validation

```python
import soundfile as sf

def validate_tts_dataset(records, target_sr=24000):
    errors = []
    for i, record in enumerate(records):
        if not record.get("audio"):
            errors.append(f"Record {i}: missing 'audio' field")
        if not record.get("transcript", "").strip():
            errors.append(f"Record {i}: empty transcript")
        try:
            info = sf.info(record["audio"])
            if info.samplerate != target_sr:
                errors.append(
                    f"Record {i}: sampling rate {info.samplerate} != {target_sr}"
                )
            duration = info.frames / info.samplerate
            if duration < 1.0:
                errors.append(f"Record {i}: clip too short ({duration:.1f}s)")
            if duration > 30.0:
                errors.append(f"Record {i}: clip too long ({duration:.1f}s), consider splitting")
        except Exception as e:
            errors.append(f"Record {i}: cannot read audio — {e}")
    return errors
```
