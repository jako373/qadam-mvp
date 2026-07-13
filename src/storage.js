import { createDefaultAdaptiveState, normalizeAdaptiveState } from "./lib/adaptive-state.js";

const STORAGE_KEY = "qadam.mvp.state.v1";
const memoryStore = new Map();

function isRecord(value) { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function readItem(key) { try { const value = globalThis.localStorage?.getItem(key); return value ?? memoryStore.get(key) ?? null; } catch { return memoryStore.get(key) ?? null; } }
function writeItem(key, value) { memoryStore.set(key, value); try { globalThis.localStorage?.setItem(key, value); } catch { /* Keep the in-memory copy when storage is blocked. */ } }
function removeItem(key) { memoryStore.delete(key); try { globalThis.localStorage?.removeItem(key); } catch { /* Storage may be intentionally blocked. */ } }

export function createDefaultState() { return { language: "kk", childProfile: null, progress: { onboardingCompleted: false }, adaptive: createDefaultAdaptiveState() }; }

export function loadState() {
  try {
    const saved = JSON.parse(readItem(STORAGE_KEY) || "null");
    if (!isRecord(saved)) return createDefaultState();
    const progress = isRecord(saved.progress) ? saved.progress : {};
    return { language: saved.language === "ru" ? "ru" : "kk", childProfile: isRecord(saved.childProfile) ? saved.childProfile : null, progress: { onboardingCompleted: progress.onboardingCompleted === true }, adaptive: normalizeAdaptiveState(saved.adaptive) };
  } catch { return createDefaultState(); }
}

export function saveState(state) {
  writeItem(STORAGE_KEY, JSON.stringify(state));
  globalThis.qadamAuth?.scheduleSync?.(state);
}

export function resetState() { removeItem(STORAGE_KEY); }
