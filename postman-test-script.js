// ============================================================
// spec-validator — Postman post-response test script
// Paste this into the "Tests" tab of your Postman collection
// or a specific request. It runs silently after every response.
// ============================================================

(async () => {
  const specName = pm.collectionVariables.get('specName');
  const validatorUrl = pm.collectionVariables.get('validatorUrl');

  if (!specName || !validatorUrl) {
    // Variables not set — skip silently
    return;
  }

  const payload = {
    specName: specName,
    url: '/' + pm.request.url.getPath().replace(/^\//, '').split('/').slice(2).join('/'),
    method: pm.request.method,
    statusCode: pm.response.code,
    responseBody: pm.response.json(),
  };

  try {
    const response = await pm.sendRequest({
      url: `${validatorUrl}/validate`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      body: {
        mode: 'raw',
        raw: JSON.stringify(payload),
      },
    });

    const result = response.json();

    if (result.valid === true) {
      // Response is valid — no action needed
      return;
    }

    if (result.confidenceLevel === 'low') {
      console.warn(
        `[spec-validator] ⚠️  Low-confidence violation detected — not escalated.\n` +
        `  Spec owner: ${result.specOwner}\n` +
        `  Reasons: ${(result.confidenceReasons || []).join('; ')}`
      );
      return;
    }

    if (result.reportFile) {
      console.warn(
        `[spec-validator] 🚨 Violation report generated!\n` +
        `  File:           ${result.reportFile}\n` +
        `  Confidence:     ${result.confidenceLevel?.toUpperCase()}\n` +
        `  Classification: ${result.classification?.toUpperCase()}\n` +
        `  Summary:        ${result.explanation}`
      );
    }

  } catch (err) {
    // Never interfere with the test itself
    console.warn(`[spec-validator] Failed to reach validator: ${err.message}`);
  }
})();
