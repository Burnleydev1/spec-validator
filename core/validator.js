const Ajv = require('ajv');
const addFormats = require('ajv-formats');

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

/**
 * Validates responseBody against resolvedSchema using AJV.
 * Returns { valid, errors[] } where errors are human-readable objects.
 */
function validateResponse(responseBody, resolvedSchema) {
  let validate;
  try {
    validate = ajv.compile(resolvedSchema);
  } catch (err) {
    throw new Error(`validator: Failed to compile schema — ${err.message}`);
  }

  const valid = validate(responseBody);

  if (valid) {
    return { valid: true, errors: [] };
  }

  const humanErrors = (validate.errors || []).map(err => {
    const field = err.instancePath || err.params?.missingProperty
      ? `${err.instancePath}${err.params?.missingProperty ? '.' + err.params.missingProperty : ''}`
      : '(root)';

    return {
      field: field.replace(/^\//, '') || '(root)',
      message: err.message,
      expectedType: err.params?.type || err.params?.allowedValues || null,
      actualValue: getValueAtPath(responseBody, err.instancePath),
    };
  });

  return { valid: false, errors: humanErrors };
}

/**
 * Safely retrieves a value from an object using an AJV instancePath like "/user/name"
 */
function getValueAtPath(obj, instancePath) {
  if (!instancePath || instancePath === '') return obj;

  const parts = instancePath.replace(/^\//, '').split('/');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = current[part];
  }

  return current;
}

module.exports = { validateResponse };
