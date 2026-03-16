/**
 * Scores how much to trust a violation before escalating it.
 *
 * Rules:
 *   - lastVerified < 7 days  → high base
 *   - lastVerified 7–30 days → medium base
 *   - lastVerified > 30 days → low base
 *   - Exact path match       → bump up one level
 *   - Fuzzy path match       → drop one level
 *   - More than 5 errors     → drop one level
 *
 * Returns { confidenceLevel: 'high'|'medium'|'low', reasons: string[] }
 */

const LEVELS = ['low', 'medium', 'high'];

function scoreConfidence({ lastVerified, matchConfidence, errors }) {
  const reasons = [];
  let score; // 0=low, 1=medium, 2=high

  // --- Base score from spec freshness ---
  const daysSinceVerified = getDaysSince(lastVerified);

  if (daysSinceVerified < 7) {
    score = 2;
    reasons.push(`Spec was verified recently (${daysSinceVerified} day(s) ago) — high base confidence`);
  } else if (daysSinceVerified <= 30) {
    score = 1;
    reasons.push(`Spec was verified ${daysSinceVerified} day(s) ago — medium base confidence`);
  } else {
    score = 0;
    reasons.push(`Spec hasn't been verified in ${daysSinceVerified} days — low base confidence`);
  }

  // --- Adjust for path match quality ---
  if (matchConfidence === 'exact') {
    score = Math.min(2, score + 1);
    reasons.push('Exact URL match with spec path — confidence bumped up one level');
  } else if (matchConfidence === 'fuzzy') {
    score = Math.max(0, score - 1);
    reasons.push('Fuzzy URL match (path parameters inferred) — confidence dropped one level');
  }

  // --- Adjust for error volume ---
  if (errors.length > 5) {
    score = Math.max(0, score - 1);
    reasons.push(`${errors.length} errors found (>5 threshold) — confidence dropped one level`);
  }

  return {
    confidenceLevel: LEVELS[score],
    reasons,
  };
}

function getDaysSince(dateString) {
  const verifiedDate = new Date(dateString);
  const now = new Date();
  const diffMs = now - verifiedDate;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
}

module.exports = { scoreConfidence };
