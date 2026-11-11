export const exerciseSpecialties = ["speech", "development", "biofeedback", "general"];
export const exerciseDifficulties = ["intro", "standard", "advanced"];
export const exerciseSpecialtyLabels = {
  speech: { ru: "Логопед", kk: "Логопед" },
  development: { ru: "Дефектолог", kk: "Дефектолог" },
  biofeedback: { ru: "БОС-терапевт", kk: "БОС-терапевт" },
  general: { ru: "Любой специалист", kk: "Кез келген маман" },
};
export const exerciseDifficultyLabels = {
  intro: { ru: "Начальная", kk: "Бастапқы" },
  standard: { ru: "Средняя", kk: "Орташа" },
  advanced: { ru: "Повышенная", kk: "Күрделі" },
};

export function filterCuratedExercises(items, filters = {}) {
  const age = filters.age ? Number(filters.age) : null;
  return items.filter((item) => item.isActive !== false
    && (!filters.category || item.category === filters.category)
    && (!filters.level || String(item.level) === String(filters.level))
    && (!filters.age || (Number.isInteger(age) && Number.isInteger(item.ageMin) && Number.isInteger(item.ageMax) && item.ageMin <= age && age <= item.ageMax))
    && (!filters.specialty || (Array.isArray(item.specialties) && (item.specialties.includes(filters.specialty) || item.specialties.includes("general"))))
    && (!filters.difficulty || item.difficulty === filters.difficulty));
}

export function readExerciseCuration(data) {
  const min = String(data.get("age_min") || "").trim();
  const max = String(data.get("age_max") || "").trim();
  const specialty = data.getAll("specialty").map(String);
  const difficulty = String(data.get("difficulty") || "");
  if ((min || max) && (!/^\d+$/.test(min) || !/^\d+$/.test(max) || Number(min) < 2 || Number(max) > 18 || Number(min) > Number(max))) throw new Error("Укажите возраст от 2 до 18 лет: начало не старше конца диапазона");
  if (specialty.some((value) => !exerciseSpecialties.includes(value))) throw new Error("Неизвестная специальность");
  if (difficulty && !exerciseDifficulties.includes(difficulty)) throw new Error("Неизвестная сложность");
  return { ...(min ? { ageMin: Number(min), ageMax: Number(max) } : {}), ...(specialty.length ? { specialties: [...new Set(specialty)] } : {}), ...(difficulty ? { difficulty } : {}) };
}

export function updateExerciseCuration(content, data) {
  const updated = { ...content };
  for (const key of ["ageMin", "ageMax", "specialties", "difficulty"]) delete updated[key];
  return { ...updated, ...readExerciseCuration(data) };
}
