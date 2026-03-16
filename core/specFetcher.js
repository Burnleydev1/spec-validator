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

  // Test mode — bypass Confluence fetch
  if (TEST_SPEC) {
    return {
      spec: TEST_SPEC,
      lastVerified: new Date().toISOString().split('T')[0],
      owner: specEntry.owner,
      name: specEntry.name,
    };
  }

  const domain = process.env.CONFLUENCE_DOMAIN;
  const email = process.env.CONFLUENCE_EMAIL;
  const token = process.env.CONFLUENCE_API_TOKEN;

  if (!domain || !email || !token) {
    throw new Error('specFetcher: Missing CONFLUENCE_DOMAIN, CONFLUENCE_EMAIL or CONFLUENCE_API_TOKEN in environment');
  }

  const auth = Buffer.from(`${email}:${token}`).toString('base64');
  const url = `https://${domain}/wiki/rest/api/content/${specEntry.pageId}?expand=body.storage`;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Accept': 'application/json',
      },
    });
  } catch (err) {
    throw new Error(`specFetcher: Network error fetching Confluence page — ${err.message}`);
  }

  if (!response.ok) {
    throw new Error(`specFetcher: Confluence returned HTTP ${response.status} for page ${specEntry.pageId}`);
  }

  const data = await response.json();
  const htmlContent = data.body?.storage?.value;

  if (!htmlContent) {
    throw new Error(`specFetcher: No content found on Confluence page ${specEntry.pageId}`);
  }

  // Extract content from code block — Confluence stores it as <ac:plain-text-body><![CDATA[...]]></ac:plain-text-body>
  const cdataMatch = htmlContent.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  if (!cdataMatch) {
    throw new Error(`specFetcher: No code block (CDATA) found on Confluence page ${specEntry.pageId}. Make sure the spec is inside a Code Block macro.`);
  }

  const rawSpec = cdataMatch[1].trim();

  let parsedSpec;
  try {
    parsedSpec = rawSpec.startsWith('{') ? JSON.parse(rawSpec) : yaml.load(rawSpec);
  } catch (err) {
    throw new Error(`specFetcher: Failed to parse spec from Confluence page ${specEntry.pageId} — ${err.message}`);
  }

  return {
    spec: parsedSpec,
    lastVerified: specEntry.lastVerified,
    owner: specEntry.owner,
    name: specEntry.name,
  };
}

module.exports = { fetchSpec };
