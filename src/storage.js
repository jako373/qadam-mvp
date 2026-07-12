import {
  createDefaultAdaptiveState,
  normalizeAdaptiveState,
} from "./lib/adaptive-state.js";

const STORAGE_KEY = "qadam.mvp.state.v1";
const TIMER_KEY = "qadam.mvp.timers.v1";

const memoryStore = new Map();

function createDefaultProgress() {
  return {
    onboardingCompleted: false,
    parentIntroCompleted: false,
    lesson1Completed: false,
    lesson1AssessmentCompleted: false,
    selectedPathway: null,
    assignedLesson2: null,
    completedLessonIds: [],
    unlockedLessonIds: ["lesson1"],
  };
}

export const defaultProgress = createDefaultProgress();

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stringArray(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === "string") : [];
}

function recordValues(value) {
  if (!isRecord(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, item]) => isRecord(item)));
}

function readItem(key) {
  try {
    const value = globalThis.localStorage?.getItem(key);
    return value ?? memoryStore.get(key) ?? null;
  } catch {
    return memoryStore.get(key) ?? null;
  }
}

function writeItem(key, value) {
  memoryStore.set(key, value);
  try {
    globalThis.localStorage?.setItem(key, value);
  } catch {
    // The in-memory copy keeps the current session usable when storage is blocked.
  }
}

function removeItem(key) {
  memoryStore.delete(key);
  try {
    globalThis.localStorage?.removeItem(key);
  } catch {
    // Nothing else is required when browser storage is unavailable.
  }
}

export function createDefaultState() {
  return {
    language: "kk",
    childProfile: null,
    progress: createDefaultProgress(),
    assessments: {},
    activityChecks: {},
    adaptive: createDefaultAdaptiveState(),
  };
}

export function loadState() {
  try {
    const saved = JSON.parse(readItem(STORAGE_KEY) || "null");
    if (!isRecord(saved)) return createDefaultState();

    const savedProgress = isRecord(saved.progress) ? saved.progress : {};
    return {
      ...createDefaultState(),
      ...saved,
      language: saved.language === "ru" ? "ru" : "kk",
      childProfile: isRecord(saved.childProfile) ? saved.childProfile : null,
      progress: {
        ...createDefaultProgress(),
        ...savedProgress,
        completedLessonIds: stringArray(savedProgress.completedLessonIds),
        unlockedLessonIds:
          savedProgress.unlockedLessonIds === undefined
            ? ["lesson1"]
            : stringArray(savedProgress.unlockedLessonIds),
      },
      assessments: recordValues(saved.assessments),
      activityChecks: recordValues(saved.activityChecks),
      adaptive: normalizeAdaptiveState(saved.adaptive),
    };
  } catch {
    return createDefaultState();
  }
}

export function saveState(state) {
  writeItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState() {
  removeItem(STORAGE_KEY);
  removeItem(TIMER_KEY);
}

export function loadTimers() {
  try {
    const timers = JSON.parse(readItem(TIMER_KEY) || "{}");
    return recordValues(timers);
  } catch {
    return {};
  }
}

export function saveTimers(timers) {
  writeItem(TIMER_KEY, JSON.stringify(isRecord(timers) ? timers : {}));
}
