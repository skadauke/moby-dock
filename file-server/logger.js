const fs = require('fs');
const path = require('path');

const os = require('os');
const HOME = process.env.HOME || process.env.USERPROFILE || os.homedir();
const LOG_DIR = path.join(HOME, '.openclaw', 'logs');
const LOG_PREFIX = 'fileserver';
const MAX_FILE_BYTES = 10_000_000; // 10MB

// Ensure log dir exists
try { fs.mkdirSync(LOG_DIR, { recursive: true }); } catch {}

function getLogFile() {
  const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  return path.join(LOG_DIR, `${LOG_PREFIX}-${date}.log`);
}

function log(level, message, data = {}) {
  const entry = {
    time: new Date().toISOString(),
    level,
    source: 'fileserver',
    message,
    ...data,
  };
  const line = JSON.stringify(entry) + '\n';
  
  // Write to stdout for launchd capture
  process.stdout.write(line);
  
  // Write to date-rotated file
  try {
    const logFile = getLogFile();
    // Check size before writing
    try {
      const stat = fs.statSync(logFile);
      if (stat.size > MAX_FILE_BYTES) {
        // Rotate: rename to .1 and start fresh
        const rotated = logFile + '.1';
        try { fs.unlinkSync(rotated); } catch {}
        fs.renameSync(logFile, rotated);
      }
    } catch {} // File doesn't exist yet, that's fine
    fs.appendFileSync(logFile, line);
  } catch (err) {
    // If file logging fails, at least stdout captured it
  }
}

module.exports = {
  info: (message, data) => log('info', message, data),
  warn: (message, data) => log('warn', message, data),
  error: (message, data) => log('error', message, data),
  debug: (message, data) => log('debug', message, data),
};
