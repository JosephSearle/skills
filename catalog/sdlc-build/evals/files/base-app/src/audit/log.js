const fs = require('node:fs');
const path = require('node:path');

const LOG_PATH = process.env.AUDIT_LOG || path.join(__dirname, '..', '..', 'audit.log');

// Append-only: entries are never rewritten or removed.
function record(entry) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...entry });
  fs.appendFileSync(LOG_PATH, `${line}\n`);
}

module.exports = { record, LOG_PATH };
