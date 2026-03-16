/**
 * Maps a real request URL to an abstract OpenAPI path.
 * e.g. /api/v1/orders/12345 → /api/v1/orders/{orderId}
 */
function matchPath(requestUrl, specPaths) {
  const specPathKeys = Object.keys(specPaths);

  // Strip query string from URL
  const cleanUrl = requestUrl.split('?')[0];

  // 1. Try exact match first
  if (specPaths[cleanUrl]) {
    return {
      matchedPath: cleanUrl,
      matchConfidence: 'exact',
    };
  }

  // 2. Fuzzy match — convert OpenAPI path params to regex
  for (const specPath of specPathKeys) {
    const regexStr = specPath
      .replace(/\{[^}]+\}/g, '([^/]+)') // {param} → capture group
      .replace(/\//g, '\\/');

    const regex = new RegExp(`^${regexStr}$`);
    if (regex.test(cleanUrl)) {
      return {
        matchedPath: specPath,
        matchConfidence: 'fuzzy',
      };
    }
  }

  throw new Error(`pathMatcher: No matching path found in spec for URL "${cleanUrl}"`);
}

module.exports = { matchPath };
