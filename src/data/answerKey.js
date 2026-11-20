export function markedAnswerIndices(answers) {
  if (!answers.length || !answers.every(answer => typeof answer?.isCorrect === "boolean")) return null;
  return answers.flatMap((answer, index) => answer.isCorrect ? [index] : []);
}

export function normalizeAnswerIndices(indices, answerCount, indexBase) {
  if (!Array.isArray(indices) || !indices.every(Number.isInteger)) return null;
  if (!indices.length) return [];
  // Without a declared base, only a boundary index can distinguish the two conventions.
  const base = indexBase === 0 || indexBase === 1 ? indexBase
    : indices.includes(0) ? 0 : indices.includes(answerCount) ? 1 : null;
  if (base === null) return null;
  const converted = indices.map(index => index - base);
  if (converted.some(index => index < 0 || index >= answerCount)) return null;
  return [...new Set(converted)].sort((a, b) => a - b);
}
