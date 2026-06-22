# RHF + Carbon Integration Reference

> Authority: [react-hook-form.com/docs/usecontroller](https://react-hook-form.com/docs/usecontroller) and [carbondesignsystem.com/components/form/usage](https://carbondesignsystem.com/components/form/usage/)

Every Carbon form component requires the `Controller` wrapper from React Hook Form. This file provides the exact pattern for each component.

---

## TextInput

```tsx
<Controller
  name="email"
  control={control}
  render={({ field }) => (
    <TextInput
      {...field}
      id="email"
      type="email"
      labelText="Email address"
      placeholder="user@example.com"
      invalid={!!errors.email}
      invalidText={errors.email?.message}
    />
  )}
/>
```

---

## TextArea

```tsx
<Controller
  name="description"
  control={control}
  render={({ field }) => (
    <TextArea
      {...field}
      id="description"
      labelText="Description"
      rows={4}
      invalid={!!errors.description}
      invalidText={errors.description?.message}
    />
  )}
/>
```

---

## Select (native select)

Carbon `Select` uses a native `<select>` element. The `value` and `onChange` from `field` work directly:

```tsx
<Controller
  name="region"
  control={control}
  render={({ field }) => (
    <Select
      {...field}
      id="region"
      labelText="Region"
      invalid={!!errors.region}
      invalidText={errors.region?.message}
    >
      <SelectItem value="" text="Choose a region" />
      <SelectItem value="us-east" text="US East" />
      <SelectItem value="eu-west" text="EU West" />
    </Select>
  )}
/>
```

---

## Dropdown (Carbon custom dropdown)

Carbon `Dropdown` uses `selectedItem` + `onChange` with an object (not a plain string). The `onChange` callback receives `{ selectedItem }`:

```tsx
const regionItems = [
  { id: 'us-east', label: 'US East' },
  { id: 'eu-west', label: 'EU West' },
]

<Controller
  name="region"
  control={control}
  render={({ field: { value, onChange, onBlur } }) => (
    <Dropdown
      id="region"
      titleText="Region"
      label="Choose a region"
      items={regionItems}
      itemToString={(item) => item?.label ?? ''}
      selectedItem={regionItems.find((i) => i.id === value) ?? null}
      onChange={({ selectedItem }) => onChange(selectedItem?.id ?? '')}
      onBlur={onBlur}
      invalid={!!errors.region}
      invalidText={errors.region?.message}
    />
  )}
/>
```

---

## ComboBox

Carbon `ComboBox` is similar to `Dropdown` but allows typing to filter:

```tsx
<Controller
  name="model"
  control={control}
  render={({ field: { value, onChange, onBlur } }) => (
    <ComboBox
      id="model"
      titleText="Model"
      placeholder="Select or type a model"
      items={modelItems}
      itemToString={(item) => item?.label ?? ''}
      selectedItem={modelItems.find((i) => i.id === value) ?? null}
      onChange={({ selectedItem }) => onChange(selectedItem?.id ?? '')}
      onBlur={onBlur}
      invalid={!!errors.model}
      invalidText={errors.model?.message}
    />
  )}
/>
```

---

## Checkbox

```tsx
<Controller
  name="acceptTerms"
  control={control}
  render={({ field: { value, onChange, onBlur } }) => (
    <Checkbox
      id="accept-terms"
      labelText="I accept the terms and conditions"
      checked={value}
      onChange={(_, { checked }) => onChange(checked)}
      onBlur={onBlur}
      invalid={!!errors.acceptTerms}
      invalidText={errors.acceptTerms?.message}
    />
  )}
/>
```

Note: Carbon `Checkbox.onChange` passes `(event, { checked })` — extract `checked` and pass to RHF's `onChange`.

---

## Toggle

```tsx
<Controller
  name="enableStreaming"
  control={control}
  render={({ field: { value, onChange } }) => (
    <Toggle
      id="enable-streaming"
      labelText="Enable streaming"
      toggled={value}
      onToggle={(toggled) => onChange(toggled)}
    />
  )}
/>
```

---

## DatePicker (single date)

```tsx
<Controller
  name="startDate"
  control={control}
  render={({ field: { value, onChange, onBlur } }) => (
    <DatePicker
      datePickerType="single"
      value={value}
      onChange={([date]) => onChange(date?.toISOString() ?? '')}
    >
      <DatePickerInput
        id="start-date"
        labelText="Start date"
        placeholder="mm/dd/yyyy"
        onBlur={onBlur}
        invalid={!!errors.startDate}
        invalidText={errors.startDate?.message}
      />
    </DatePicker>
  )}
/>
```

Carbon `DatePicker.onChange` passes an array of dates — destructure to get the first date.

---

## NumberInput

```tsx
<Controller
  name="maxTokens"
  control={control}
  render={({ field: { value, onChange, onBlur } }) => (
    <NumberInput
      id="max-tokens"
      label="Max tokens"
      value={value}
      onChange={(_, { value: newValue }) => onChange(newValue)}
      onBlur={onBlur}
      min={100}
      max={8000}
      step={100}
      invalid={!!errors.maxTokens}
      invalidText={errors.maxTokens?.message}
    />
  )}
/>
```

---

## Error display summary

Show all form errors together with Carbon `InlineNotification`:

```tsx
{Object.keys(errors).length > 0 && (
  <InlineNotification
    kind="error"
    title="Please fix the following errors:"
    subtitle={Object.values(errors).map((e) => e?.message).join(', ')}
  />
)}
```
