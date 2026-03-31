export function clamp01(value) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.min(1, numberValue));
}

export function scoreBand(score) {
  if (score > 0.75) return "good";
  if (score >= 0.5) return "warn";
  return "bad";
}

// Strict scoring logic:
// final_score = (drug_score + (1 - toxicity_score)) / 2
export function calculateFinalScore(toxicityScore, drugScore) {
  const tox = clamp01(toxicityScore);
  const drug = clamp01(drugScore);
  return clamp01((drug + (1 - tox)) / 2);
}

export function interpretationForFinalScore(finalScore) {
  const s = clamp01(finalScore);
  if (s > 0.75) return "STRONG DRUG CANDIDATE";
  if (s >= 0.5) return "MODERATE DRUG CANDIDATE";
  return "UNSAFE";
}

