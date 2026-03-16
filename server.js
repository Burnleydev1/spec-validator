require('dotenv').config();

const express = require('express');
const { fetchSpec } = require('./core/specFetcher');
const { matchPath } = require('./core/pathMatcher');
const { resolveRefs } = require('./core/refResolver');
const { validateResponse } = require('./core/validator');
const { scoreConfidence } = require('./core/confidenceScorer');
const { classifyViolation } = require('./core/classifier');
const { generateReport } = require('./reports/generator');
const { listReports, getReport } = require('./storage/reportsStore');

const app = express();
app.use(express.json({ limit: '5mb' }));

// ---------------------------------------------------------------------------
// POST /validate  — full pipeline
// ---------------------------------------------------------------------------
app.post('/validate', async (req, res) => {
  const { specName, url, method, statusCode, responseBody } = req.body;

  if (!specName || !url || !method || !statusCode || responseBody === undefined) {
    return res.status(400).json({
      error: 'Missing required fields: specName, url, method, statusCode, responseBody',
    });
  }

  try {
    // Step 1: Fetch spec
    let specData;
    try {
      specData = await fetchSpec(specName);
    } catch (err) {
      throw new Error(`Step 1 (fetchSpec): ${err.message}`);
    }
    const { spec, lastVerified, owner } = specData;

    // Step 2: Match path
    let pathMatch;
    try {
      pathMatch = matchPath(url, spec.paths || {});
    } catch (err) {
      throw new Error(`Step 2 (matchPath): ${err.message}`);
    }
    const { matchedPath, matchConfidence } = pathMatch;

    // Step 3 & 4: Get schema for this method + status code
    const methodKey = method.toLowerCase();
    const pathItem = spec.paths[matchedPath];

    if (!pathItem || !pathItem[methodKey]) {
      throw new Error(`Step 4: No "${methodKey}" operation found at path "${matchedPath}"`);
    }

    const operation = pathItem[methodKey];
    const responseSchema = operation?.responses?.[statusCode]?.content?.['application/json']?.schema
      || operation?.responses?.['default']?.content?.['application/json']?.schema;

    if (!responseSchema) {
      return res.json({
        valid: null,
        message: `No response schema defined for ${method.toUpperCase()} ${matchedPath} → ${statusCode}`,
      });
    }

    // Step 3: Resolve $refs
    let resolvedSchema;
    try {
      resolvedSchema = resolveRefs(responseSchema, spec);
    } catch (err) {
      throw new Error(`Step 3 (resolveRefs): ${err.message}`);
    }

    // Step 5: Validate
    let validation;
    try {
      validation = validateResponse(responseBody, resolvedSchema);
    } catch (err) {
      throw new Error(`Step 5 (validateResponse): ${err.message}`);
    }

    // Step 6: Valid — done
    if (validation.valid) {
      return res.json({ valid: true });
    }

    const { errors } = validation;

    // Step 7: Score confidence
    let confidence;
    try {
      confidence = scoreConfidence({ lastVerified, matchConfidence, errors });
    } catch (err) {
      throw new Error(`Step 7 (scoreConfidence): ${err.message}`);
    }
    const { confidenceLevel, reasons: confidenceReasons } = confidence;

    // Step 8: Low confidence — warn and route to owner, don't escalate
    if (confidenceLevel === 'low') {
      return res.json({
        valid: false,
        confidenceLevel,
        confidenceReasons,
        warning: `Low confidence — violation not escalated. Route to spec owner: ${owner}`,
        specOwner: owner,
        errors,
      });
    }

    // Step 9: Classify with Claude
    let classification;
    try {
      classification = await classifyViolation({ errors, endpoint: url, specName, confidenceLevel });
    } catch (err) {
      throw new Error(`Step 9 (classifyViolation): ${err.message}`);
    }

    // Step 10: Generate report
    let reportFile;
    try {
      reportFile = generateReport({
        endpoint: url,
        method,
        statusCode: String(statusCode),
        specName,
        confidenceLevel,
        confidenceReasons,
        matchedPath,
        errors,
        responseBody,
        ...classification,
      });
    } catch (err) {
      throw new Error(`Step 10 (generateReport): ${err.message}`);
    }

    // Step 11: Return result
    return res.json({
      valid: false,
      reportFile,
      confidenceLevel,
      classification: classification.classification,
      explanation: classification.explanation,
    });

  } catch (err) {
    console.error('[/validate error]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /reports  — list generated report filenames
// ---------------------------------------------------------------------------
app.get('/reports', (req, res) => {
  try {
    const files = listReports();
    return res.json({ reports: files });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// GET /reports/:filename  — retrieve a specific report
// ---------------------------------------------------------------------------
app.get('/reports/:filename', (req, res) => {
  try {
    const content = getReport(req.params.filename);
    res.type('text/markdown').send(content);
  } catch (err) {
    return res.status(404).json({ error: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`spec-validator running on port ${PORT}`);
});
