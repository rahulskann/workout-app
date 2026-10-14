// Turns what someone typed into a number, or null if it isn't one yet.
// Accepts "47,5" from keyboards that use a decimal comma, and half-typed
// values like "47." so typing isn't fought mid-number.
export function parseTyped(text) {
  if (typeof text !== 'string') return null;
  const cleaned = text.trim().replace(',', '.');
  if (!/^(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  return parseFloat(cleaned);
}

// Weights never go negative and keep at most 2 decimals, so repeated
// 2.5 lb steps on top of a typed value don't drift (47.3 + 2.5 = 49.8).
export function cleanWeight(n) {
  return Math.max(0, Math.round(n * 100) / 100);
}

// Reps are whole and at least 1.
export function cleanReps(n) {
  return Math.max(1, Math.round(n));
}
