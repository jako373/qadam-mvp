const STORAGE_KEY = "qadam.mvp.state.v1";
const TIMER_KEY = "qadam.mvp.timers.v1";

export const defaultProgress = {
  onboardingCompleted: false,
  parentIntroCompleted: false,
  lesson1Completed: false,
  lesson1AssessmentCompleted: false,
  selectedPathway: null,
  assignedLesson2: null,
  completedLessonIds: [],
  unlockedLessonIds: ["lesson1"],
};

export function createDefaultState() {
  return {
    language: "kk",
    childProfile: null,
    progress: { ...defaultProgress },
    assessments: {},
    activityChecks: {},
  };
}

export function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
    if (!saved) return createDefaultState();
    return {
      ...createDefaultState(),
      ...saved,
      progress: { ...defaultProgress, ...(saved.progress || {}) },
      assessments: saved.assessments || {},
      activityChecks: saved.activityChecks || {},
    };
  } catch {
    return createDefaultState();
  }
}

export function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TIMER_KEY);
}

export function loadTimers() {
  try {
    return JSON.parse(localStorage.getItem(TIMER_KEY) || "{}");
  } catch {
    return {};
  }
}

export function saveTimers(timers) {
  localStorage.setItem(TIMER_KEY, JSON.stringify(timers));
}
