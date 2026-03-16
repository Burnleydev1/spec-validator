const fs = require('fs');
const path = require('path');

const OUTPUT_DIR = path.join(__dirname, 'output');

/**
 * Generates a .md report file for a schema violation.
 * Returns the filename of the generated report.
 */
function generateReport({
  endpoint,
  method,
  statusCode,
  specName,
  confidenceLevel,
  confidenceReasons,
  classification,
  explanation,
  probableCause,
  recommendedAction,
  errors,
  responseBody,
  matchedPath,
}) {
  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  const slug = endpoint
    .replace(/^https?:\/\/[^/]+/, '') // strip domain
    .replace(/[^a-zA-Z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 60);

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `BUG-${slug}-${timestamp}.md`;
  const filePath = path.join(OUTPUT_DIR, filename);

  const expectedVsActual = buildExpectedActualTable(errors);

  const content = `# API Violation Report

**Generated:** ${new Date().toISOString()}

---

## Confidence

**Level:** ${confidenceLevel.toUpperCase()}

${confidenceReasons.map(r => `- ${r}`).join('\n')}

---

## Classification

**Type:** ${classification.toUpperCase()}

${explanation}

---

## Endpoint

| Field | Value |
|-------|-------|
| URL | \`${endpoint}\` |
| Method | \`${method.toUpperCase()}\` |
| Status Code | \`${statusCode}\` |
| Matched Spec Path | \`${matchedPath}\` |
| Spec Name | ${specName} |

---

## What Failed

${errors.length} schema violation(s) detected.

${errors.map((e, i) => `${i + 1}. **\`${e.field}\`** — ${e.message}`).join('\n')}

---

## Expected vs Actual

${expectedVsActual}

---

## Probable Cause

${probableCause}

---

## Recommended Action

${recommendedAction}

---

## Steps to Reproduce

1. Send \`${method.toUpperCase()} ${endpoint}\`
2. Observe HTTP \`${statusCode}\` response
3. Run response body through spec validator against **${specName}**
4. Violations listed above will be detected

---

## Raw Schema Violations

\`\`\`json
${JSON.stringify(errors, null, 2)}
\`\`\`
`;

  fs.writeFileSync(filePath, content, 'utf8');
  return filename;
}

function buildExpectedActualTable(errors) {
  if (!errors.length) return '_No violations._';

  const rows = errors.map(e => {
    const expected = e.expectedType != null
      ? (Array.isArray(e.expectedType) ? e.expectedType.join(', ') : String(e.expectedType))
      : '—';
    const actual = e.actualValue !== undefined
      ? `\`${JSON.stringify(e.actualValue)}\``
      : '—';
    return `| \`${e.field}\` | ${expected} | ${actual} | ${e.message} |`;
  });

  return `| Field | Expected | Actual | Message |
|-------|----------|--------|---------|
${rows.join('\n')}`;
}

module.exports = { generateReport };
