const fetch = require('node-fetch');
const yaml = require('js-yaml');
const fs = require('fs');
const path = require('path');

const TEST_SPEC = process.env.USE_TEST_SPEC === 'true' ? {
  openapi: '3.0.0',
  info: { title: 'Test', version: '1.0.0' },
  paths: {
    '/api/v1/orders/{orderId}': {
      get: {
        responses: {
          '200': {
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['id', 'status', 'total'],
                  properties: {
                    id:     { type: 'string' },
                    status: { type: 'string' },
                    total:  { type: 'number' }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
} : null;

async function fetchSpec(specName) {
  const configPath = path.join(__dirname, '../config/specs.json');
  const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

  const specEntry = config.specs.find(s => s.name === specName);
  if (!specEntry) {
    throw new Error(`specFetcher: No spec found with name "${specName}"`);
  }

  // Test mode — bypass GitHub fetch
  if (TEST_SPEC) {
    return {
      spec: TEST_SPEC,
      lastVerified: new Date().toISOString().split('T')[0],
      owner: specEntry.owner,
      name: specEntry.name,
    };
  }

  let response;
  try {
    response = await fetch(specEntry.url);
  } catch (err) {
    throw new Error(`specFetcher: Failed to fetch spec from ${specEntry.url} — ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`specFetcher: HTTP ${response.status} fetching spec from ${specEntry.url}`);
  }

  const rawText = await response.text();

  let parsedSpec;
  try {
    // Try JSON first, fall back to YAML
    parsedSpec = specEntry.url.endsWith('.json')
      ? JSON.parse(rawText)
      : yaml.load(rawText);
  } catch (err) {
    throw new Error(`specFetcher: Failed to parse spec — ${err.message}`);
  }

  return {
    spec: parsedSpec,
    lastVerified: specEntry.lastVerified,
    owner: specEntry.owner,
    name: specEntry.name,
  };
}

module.exports = { fetchSpec };
