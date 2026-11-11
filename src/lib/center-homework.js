export function homeworkStatus(exerciseIds, responses) {
  const results = exerciseIds.map((id) => responses?.[id]?.result || responses?.[id]).filter(Boolean);
  if (!results.length) return "pending";
  if (results.length < exerciseIds.length) return "partial";
  if (results.every((result) => result === "unable")) return "unable";
  return results.every((result) => result === "done") ? "complete" : "partial";
}
