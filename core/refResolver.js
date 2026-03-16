/**
 * Recursively resolves all $ref values in a schema.
 * Returns a fully inlined schema. Does NOT mutate the original spec.
 */
function resolveRefs(schema, fullSpec, visited = new Set()) {
  if (!schema || typeof schema !== 'object') return schema;

  if (schema.$ref) {
    const refPath = schema.$ref;

    if (visited.has(refPath)) {
      throw new Error(`refResolver: Circular $ref detected at "${refPath}"`);
    }

    const resolved = resolveRefPath(refPath, fullSpec);
    const newVisited = new Set(visited);
    newVisited.add(refPath);
    return resolveRefs(resolved, fullSpec, newVisited);
  }

  if (Array.isArray(schema)) {
    return schema.map(item => resolveRefs(item, fullSpec, visited));
  }

  // Plain object — deep clone and recurse
  const result = {};
  for (const key of Object.keys(schema)) {
    result[key] = resolveRefs(schema[key], fullSpec, visited);
  }
  return result;
}

/**
 * Resolves a $ref string like "#/components/schemas/Order"
 * into the actual object from the full spec.
 */
function resolveRefPath(ref, fullSpec) {
  if (!ref.startsWith('#/')) {
    throw new Error(`refResolver: Only local $refs are supported. Got "${ref}"`);
  }

  const parts = ref.replace('#/', '').split('/');
  let current = fullSpec;

  for (const part of parts) {
    const decodedPart = part.replace(/~1/g, '/').replace(/~0/g, '~');
    if (current[decodedPart] === undefined) {
      throw new Error(`refResolver: $ref path "${ref}" not found in spec at segment "${decodedPart}"`);
    }
    current = current[decodedPart];
  }

  return current;
}

module.exports = { resolveRefs };
