const fetch = require('node-fetch');

async function classifyViolation({ errors, endpoint, specName, confidenceLevel }) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('classifier: GEMINI_API_KEY is not set in environment');
  }

  const systemInstruction = `You are an API quality engineer. You will be given structured data about an OpenAPI schema violation.

Your job is to classify whether it is:
- "bug": The API implementation is returning incorrect data — a developer needs to fix the code.
- "spec-drift": The spec is likely outdated and no longer reflects how the API actually works — the spec needs updating.

Respond ONLY with a raw JSON object. No markdown, no backticks, no preamble, no explanation outside the JSON.

Required shape:
{
  "classification": "bug" | "spec-drift",
  "explanation": "One to two sentences in plain English summarising what went wrong.",
  "probableCause": "One to two sentences on the most likely root cause.",
  "recommendedAction": "One to two sentences on what should be done to fix this."
}`;

  const userMessage = `Spec name: ${specName}
Endpoint: ${endpoint}
Confidence level: ${confidenceLevel}

Validation errors:
${JSON.stringify(errors, null, 2)}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: systemInstruction }]
        },
        contents: [
          {
            role: 'user',
            parts: [{ text: userMessage }]
          }
        ],
        generationConfig: {
          temperature: 0.2,
          maxOutputTokens: 1000,
        }
      }),
    });
  } catch (err) {
    throw new Error(`classifier: Network error calling Gemini API — ${err.message}`);
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`classifier: Gemini API returned HTTP ${response.status} — ${body}`);
  }

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!rawText) {
    throw new Error('classifier: Gemini API returned an empty response');
  }

  let parsed;
  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(clean);
  } catch (err) {
    throw new Error(`classifier: Failed to parse Gemini response as JSON — ${err.message}\nRaw: ${rawText}`);
  }

  const required = ['classification', 'explanation', 'probableCause', 'recommendedAction'];
  for (const field of required) {
    if (!parsed[field]) {
      throw new Error(`classifier: Missing required field "${field}" in Gemini response`);
    }
  }

  if (!['bug', 'spec-drift'].includes(parsed.classification)) {
    throw new Error(`classifier: Invalid classification value "${parsed.classification}"`);
  }

  return parsed;
}

module.exports = { classifyViolation };
