export function homeworkStatus(exerciseIds, responses) {
  const results = exerciseIds.map((id) => responses?.[id]?.result || responses?.[id]).filter(Boolean);
  if (!results.length) return "pending";
  if (results.length < exerciseIds.length) return "partial";
  if (results.every((result) => result === "unable")) return "unable";
  return results.every((result) => result === "done") ? "complete" : "partial";
}

export function recommendHomework(skillLevels, catalogue, latestHomework) {
  const assessed = Object.entries(skillLevels || {}).filter(([, level]) => Number.isInteger(level) && level >= 1 && level <= 3);
  const unassessed = Object.entries(skillLevels || {}).filter(([, level]) => level == null).map(([category]) => category);
  if (assessed.length < 2) return { priorities: [], exerciseIds: [], unassessed, insufficient: true };
  const priorities = assessed.filter(([, level]) => level <= 2).sort((a, b) => a[1] - b[1]).slice(0, 3).map(([category, level]) => ({ category, level }));
  const active = catalogue.filter((exercise) => exercise.isActive !== false);
  const exerciseIds = priorities.flatMap(({ category, level }) => {
    const prior = latestHomework?.exercise_ids?.map((id) => active.find((exercise) => exercise.id === id))
      .find((exercise) => exercise?.category === category && latestHomework.responses?.[exercise.id]?.result);
    const outcome = prior && latestHomework.responses[prior.id].result;
    if (outcome === "difficult" || outcome === "unable") return [prior.id];
    if (outcome === "done") return active.filter((exercise) => exercise.category === category && exercise.level === Math.min(3, prior.level + 1)).slice(0, 1).map((exercise) => exercise.id);
    return active.filter((exercise) => exercise.category === category && exercise.level === level).slice(0, 2).map((exercise) => exercise.id);
  });
  return { priorities, exerciseIds: [...new Set(exerciseIds)].slice(0, 6), unassessed, insufficient: false };
}
