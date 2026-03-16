const fs = require('fs');
const path = require('path');

const REPORTS_DIR = path.join(__dirname, '../reports/output');

/**
 * Returns a list of all generated .md report filenames, newest first.
 */
function listReports() {
  if (!fs.existsSync(REPORTS_DIR)) return [];

  return fs.readdirSync(REPORTS_DIR)
    .filter(f => f.endsWith('.md'))
    .sort()
    .reverse();
}

/**
 * Returns the contents of a specific report file.
 */
function getReport(filename) {
  const filePath = path.join(REPORTS_DIR, filename);

  if (!fs.existsSync(filePath)) {
    throw new Error(`reportsStore: Report file "${filename}" not found`);
  }

  return fs.readFileSync(filePath, 'utf8');
}

module.exports = { listReports, getReport };
