const SUPABASE_URL = "https://iismpbsapzmacxqraecx.supabase.co";
const SUPABASE_KEY = "sb_publishable_hFMdiuuIp051vWhUE7IQKg_DczXIfmV";
const SESSION_KEY = "qadam.auth.session.v1";
const STATE_KEY = "qadam.mvp.state.v1";
const CATEGORIES = ["joint_attention", "understanding", "imitation", "communication", "play_thinking", "fine_motor", "regulation", "daily_social"];
const app = document.getElementById("app");
let syncTimer = null;

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function readJson(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}

function readSession() { return readJson(SESSION_KEY); }
function writeSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

function accountLabels() {
  const language = readJson(STATE_KEY, {})?.language === "ru" ? "ru" : "kk";
  return language === "ru"
    ? { login: "Войти", register: "Регистрация", logout: "Выйти", admin: "Суперадмин" }
    : { login: "Кіру", register: "Тіркелу", logout: "Шығу", admin: "Суперадмин" };
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json", ...(options.headers || {}) },
  });
  const payload = response.status === 204 ? {} : await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.msg || payload.message || payload.error_description || payload.error || "Запрос не выполнен");
  return payload;
}

async function refreshSession(session) {
  if (!session?.refresh_token) return null;
  try {
    const refreshed = await apiRequest("/auth/v1/token?grant_type=refresh_token", { method: "POST", body: JSON.stringify({ refresh_token: session.refresh_token }) });
    writeSession(refreshed);
    return refreshed;
  } catch { clearSession(); return null; }
}

async function getSession() {
  const session = readSession();
  if (!session?.access_token) return null;
  if (Number(session.expires_at || 0) * 1000 > Date.now() + 60_000) return session;
  return refreshSession(session);
}

function isSuperadmin(session) { return session?.user?.app_metadata?.role === "superadmin"; }

async function signIn(email, password) {
  const session = await apiRequest("/auth/v1/token?grant_type=password", { method: "POST", body: JSON.stringify({ email, password }) });
  writeSession(session);
  await hydrateState(session);
  return session;
}

async function signUp(email, password) {
  const redirectTo = encodeURIComponent(`${location.origin}/login?confirmed=1`);
  const result = await apiRequest(`/auth/v1/signup?redirect_to=${redirectTo}`, { method: "POST", body: JSON.stringify({ email, password }) });
  if (result.access_token) writeSession(result);
  return result;
}

async function signOut() {
  const session = readSession();
  clearSession();
  if (session?.access_token) await apiRequest("/auth/v1/logout", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` } }).catch(() => {});
}

async function dataRequest(path, session, options = {}) {
  return apiRequest(`/rest/v1/${path}`, { ...options, headers: { Authorization: `Bearer ${session.access_token}`, ...(options.headers || {}) } });
}

async function upsert(table, rows, conflict, session) {
  if (!rows?.length) return [];
  return dataRequest(`${table}?on_conflict=${encodeURIComponent(conflict)}`, session, {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
}

async function hydrateState(session) {
  if (!session?.user?.id || isSuperadmin(session)) return;
  const uid = session.user.id;
  const [profiles, children] = await Promise.all([
    dataRequest(`profiles?select=preferred_language&id=eq.${uid}&limit=1`, session),
    dataRequest(`children?select=*&parent_id=eq.${uid}&order=created_at.asc&limit=1`, session),
  ]).catch(() => [[], []]);
  const child = children?.[0];
  if (!child) return;
  const childId = child.id;
  localStorage.setItem(`qadam.child.id.${uid}`, childId);
  const [assessments, levels, progress, plans, attempts] = await Promise.all([
    dataRequest(`skill_assessments?select=*&child_id=eq.${childId}&order=completed_at.desc&limit=4`, session),
    dataRequest(`child_skill_levels?select=*&child_id=eq.${childId}`, session),
    dataRequest(`child_exercise_progress?select=*&child_id=eq.${childId}`, session),
    dataRequest(`daily_plans?select=*&child_id=eq.${childId}&order=plan_date.asc`, session),
    dataRequest(`exercise_attempts?select=*&child_id=eq.${childId}&order=created_at.asc&limit=500`, session),
  ]).catch(() => [[], [], [], [], []]);
  const saved = readJson(STATE_KEY, {});
  const adaptive = saved.adaptive && typeof saved.adaptive === "object" ? saved.adaptive : {};
  const initial = assessments.find((item) => item.assessment_type === "initial");
  const skillLevels = { ...(adaptive.skillLevels || {}) };
  for (const category of CATEGORIES) skillLevels[category] = 1;
  for (const item of levels) skillLevels[item.category] = Number(item.level);
  const exerciseProgress = Object.fromEntries(progress.map((item) => [item.exercise_id, {
    independentCount: item.independent_count,
    unableStreak: item.unable_streak,
    attempts: item.attempts,
    lastOutcome: item.last_outcome,
    lastDate: item.last_attempted_on,
  }]));
  const dailyPlans = Object.fromEntries(plans.map((item) => [item.plan_date, {
    date: item.plan_date,
    basedOnDate: item.based_on_date || null,
    items: item.items,
    results: item.results || {},
    viewedCount: item.viewed_count || 0,
    completedAt: item.completed_at || null,
  }]));
  const exerciseHistory = attempts.map((item) => ({
    exerciseId: item.exercise_id,
    category: item.category,
    level: item.exercise_level,
    outcome: item.outcome,
    score: item.score,
    date: item.attempted_on,
    at: item.created_at,
  }));
  const next = {
    language: profiles?.[0]?.preferred_language === "ru" ? "ru" : (saved.language === "ru" ? "ru" : "kk"),
    childProfile: {
      name: child.name, age: child.age, diagnosis: child.diagnosis, homeLanguage: child.home_language,
      meaningfulWords: child.meaningful_words, interests: child.interests || "", dislikes: child.dislikes || "", bestTime: child.best_time || "",
    },
    progress: { onboardingCompleted: true },
    adaptive: {
      ...adaptive,
      initialAssessment: initial ? { answers: initial.answers || {}, completedAt: initial.completed_at } : (adaptive.initialAssessment || { answers: {}, completedAt: null }),
      skillLevels,
      exerciseProgress,
      exerciseHistory,
      introducedExerciseIds: progress.map((item) => item.exercise_id),
      favoriteExerciseIds: progress.filter((item) => item.is_favorite).map((item) => item.exercise_id),
      dailyPlans,
      completedDates: plans.filter((item) => item.completed_at).map((item) => item.plan_date).sort(),
    },
  };
  localStorage.setItem(STATE_KEY, JSON.stringify(next));
  localStorage.setItem(`qadam.synced.attempts.${uid}`, JSON.stringify(attempts.map((item) => item.created_at)));
}

async function syncState(state) {
  const session = await getSession();
  if (!session?.user?.id || isSuperadmin(session)) return;
  const uid = session.user.id;
  await upsert("profiles", [{ id: uid, preferred_language: state.language === "ru" ? "ru" : "kk" }], "id", session);
  const profile = state.childProfile;
  if (!profile || !state.progress?.onboardingCompleted) return;
  let childId = localStorage.getItem(`qadam.child.id.${uid}`);
  if (!childId) { childId = crypto.randomUUID(); localStorage.setItem(`qadam.child.id.${uid}`, childId); }
  await upsert("children", [{
    id: childId, parent_id: uid, name: profile.name, age: Number(profile.age), diagnosis: profile.diagnosis,
    home_language: profile.homeLanguage, meaningful_words: profile.meaningfulWords, interests: profile.interests || null,
    dislikes: profile.dislikes || null, best_time: profile.bestTime || null,
  }], "id", session);
  const adaptive = state.adaptive || {};
  const levelRows = CATEGORIES.map((category) => ({ parent_id: uid, child_id: childId, category, level: Number(adaptive.skillLevels?.[category] || 1) }));
  await upsert("child_skill_levels", levelRows, "child_id,category", session);
  const favorites = new Set(adaptive.favoriteExerciseIds || []);
  const progressIds = new Set([...Object.keys(adaptive.exerciseProgress || {}), ...favorites]);
  const progressRows = [...progressIds].map((exerciseId) => {
    const item = adaptive.exerciseProgress?.[exerciseId] || {};
    return { parent_id: uid, child_id: childId, exercise_id: exerciseId, independent_count: Number(item.independentCount || 0), unable_streak: Number(item.unableStreak || 0), attempts: Number(item.attempts || 0), last_outcome: item.lastOutcome || null, last_attempted_on: item.lastDate || null, is_favorite: favorites.has(exerciseId) };
  });
  await upsert("child_exercise_progress", progressRows, "child_id,exercise_id", session);
  const planRows = Object.entries(adaptive.dailyPlans || {}).filter(([, plan]) => Array.isArray(plan.items) && plan.items.length === 3).map(([date, plan]) => ({
    parent_id: uid, child_id: childId, plan_date: date, based_on_date: plan.basedOnDate || null, items: plan.items,
    results: plan.results || {}, viewed_count: Number(plan.viewedCount || 0), completed_at: plan.completedAt || null,
  }));
  await upsert("daily_plans", planRows, "child_id,plan_date", session);
  const assessmentAt = adaptive.initialAssessment?.completedAt;
  const assessmentKey = `qadam.synced.assessment.${uid}`;
  if (assessmentAt && localStorage.getItem(assessmentKey) !== assessmentAt) {
    await dataRequest("skill_assessments", session, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ parent_id: uid, child_id: childId, assessment_type: "initial", answers: adaptive.initialAssessment.answers || {}, skill_levels: adaptive.skillLevels || {}, completed_at: assessmentAt }) });
    localStorage.setItem(assessmentKey, assessmentAt);
  }
  const syncedKey = `qadam.synced.attempts.${uid}`;
  const synced = new Set(readJson(syncedKey, []));
  const newHistory = (adaptive.exerciseHistory || []).filter((item) => item.at && !synced.has(item.at));
  if (newHistory.length) {
    const attempts = newHistory.map((item) => ({ parent_id: uid, child_id: childId, exercise_id: item.exerciseId, category: item.category, exercise_level: Number(item.level || 1), outcome: item.outcome, score: item.outcome === "refused" ? null : item.score, attempted_on: item.date, created_at: item.at }));
    await dataRequest("exercise_attempts", session, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(attempts) });
    localStorage.setItem(syncedKey, JSON.stringify([...synced, ...newHistory.map((item) => item.at)].slice(-500)));
  }
}

function scheduleSync(state) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncState(state).catch((error) => console.warn("Qadam sync:", error.message)), 650);
}

globalThis.qadamAuth = { getSession, scheduleSync, signOut };

function userDestination() {
  const state = readJson(STATE_KEY, {});
  return state.progress?.onboardingCompleted ? "/today" : "/language";
}

function authSteps(active) {
  return `<ol class="auth-steps"><li class="${active >= 1 ? "active" : ""}"><span>1</span>Аккаунт</li><li class="${active >= 2 ? "active" : ""}"><span>2</span>Профиль ребёнка</li><li class="${active >= 3 ? "active" : ""}"><span>3</span>Первые упражнения</li></ol>`;
}

function loginMarkup() {
  const confirmed = new URLSearchParams(location.search).get("confirmed") === "1";
  return `<main class="auth-page"><section class="auth-card" aria-labelledby="login-title">
    <a class="auth-brand" href="/" aria-label="Qadam, на главную"><span>Q</span><strong>Qadam</strong></a>${authSteps(1)}
    <div class="auth-kicker">Личный кабинет</div><h1 id="login-title">Вход в Qadam</h1>
    <p>${confirmed ? "Email подтверждён. Теперь войдите в аккаунт." : "Продолжите занятия ребёнка с того места, где остановились."}</p>
    <form id="login-form" class="auth-form"><label><span>Email</span><input name="email" type="email" autocomplete="username" required /></label><label><span>Пароль</span><input name="password" type="password" autocomplete="current-password" required minlength="8" /></label><p id="login-error" class="auth-error" role="alert" hidden></p><button class="auth-primary" type="submit">Войти</button></form>
    <p class="auth-switch">Нет аккаунта? <a href="/register">Зарегистрироваться</a></p><a class="auth-back" href="/">Вернуться на главную</a>
  </section></main>`;
}

function registerMarkup() {
  return `<main class="auth-page"><section class="auth-card" aria-labelledby="register-title">
    <a class="auth-brand" href="/" aria-label="Qadam, на главную"><span>Q</span><strong>Qadam</strong></a>${authSteps(1)}
    <div class="auth-kicker">Новый аккаунт</div><h1 id="register-title">Начать с Qadam</h1><p>Создайте аккаунт, затем заполните короткий профиль ребёнка и получите первые упражнения.</p>
    <form id="register-form" class="auth-form"><label><span>Email</span><input name="email" type="email" autocomplete="username" required /></label><label><span>Пароль</span><input name="password" type="password" autocomplete="new-password" required minlength="8" /></label><label><span>Повторите пароль</span><input name="passwordConfirm" type="password" autocomplete="new-password" required minlength="8" /></label><p class="auth-hint">Минимум 8 символов. Лучше использовать уникальный пароль.</p><p id="register-error" class="auth-error" role="alert" hidden></p><button class="auth-primary" type="submit">Создать аккаунт</button></form>
    <p class="auth-switch">Уже есть аккаунт? <a href="/login">Войти</a></p><a class="auth-back" href="/">Вернуться на главную</a>
  </section></main>`;
}

function mountLogin() {
  app.innerHTML = loginMarkup();
  const form = document.getElementById("login-form"); const errorBox = document.getElementById("login-error");
  form.addEventListener("submit", async (event) => { event.preventDefault(); const button = form.querySelector("button"); const data = new FormData(form); button.disabled = true; button.textContent = "Входим…"; errorBox.hidden = true;
    try { const session = await signIn(String(data.get("email") || "").trim(), String(data.get("password") || "")); location.replace(isSuperadmin(session) ? "/admin" : userDestination()); }
    catch (error) { errorBox.textContent = error.message === "Invalid login credentials" ? "Неверный email или пароль" : error.message; errorBox.hidden = false; button.disabled = false; button.textContent = "Войти"; }
  });
}

function mountRegister() {
  app.innerHTML = registerMarkup();
  const form = document.getElementById("register-form"); const errorBox = document.getElementById("register-error");
  form.addEventListener("submit", async (event) => { event.preventDefault(); const button = form.querySelector("button"); const data = new FormData(form); const password = String(data.get("password") || ""); const confirmation = String(data.get("passwordConfirm") || ""); errorBox.hidden = true;
    if (password !== confirmation) { errorBox.textContent = "Пароли не совпадают"; errorBox.hidden = false; return; }
    button.disabled = true; button.textContent = "Создаём аккаунт…";
    try { const result = await signUp(String(data.get("email") || "").trim(), password); if (result.access_token) { location.replace("/language"); return; } app.innerHTML = `<main class="auth-page"><section class="auth-card auth-success"><div class="auth-success-mark">✓</div><div class="auth-kicker">Аккаунт создан</div><h1>Проверьте почту</h1><p>Мы отправили ссылку подтверждения. После подтверждения вернитесь и войдите в Qadam.</p><a class="auth-primary auth-link" href="/login">Перейти ко входу</a></section></main>`; }
    catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; button.disabled = false; button.textContent = "Создать аккаунт"; }
  });
}

async function rpc(name, session) { return dataRequest(`rpc/${name}`, session, { method: "POST", body: "{}" }); }
function summaryCard(value, label) { return `<article class="admin-stat"><strong>${Number(value || 0)}</strong><span>${label}</span></article>`; }

function adminShell(session) {
  return `<main class="admin-page"><header class="admin-header"><a class="auth-brand" href="/"><span>Q</span><strong>Qadam</strong></a><div class="admin-account"><span class="admin-badge">Суперадмин</span><small>${escapeHtml(session.user?.email || "")}</small><button id="logout-button" type="button">Выйти</button></div></header><section class="admin-content"><div class="admin-title"><div><div class="auth-kicker">Панель управления</div><h1>Обзор Qadam</h1><p>Регистрации и прогресс всех участников.</p></div><button id="refresh-admin" class="auth-secondary" type="button">Обновить</button></div><div id="admin-status" class="admin-status">Загружаем данные…</div><section id="admin-dashboard" hidden></section></section></main>`;
}

function participantRows(rows) {
  if (!rows.length) return `<div class="admin-empty">Пока нет участников с заполненным профилем ребёнка.</div>`;
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Участник</th><th>Ребёнок</th><th>Уровни</th><th>Результаты</th><th>Дней завершено</th><th>Последняя активность</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.participant_email || "—")}</td><td><strong>${escapeHtml(row.child_name || "—")}</strong><small>${row.child_age ? `${Number(row.child_age)} лет` : ""}</small></td><td>${escapeHtml(JSON.stringify(row.skill_levels || {}))}</td><td>${escapeHtml(JSON.stringify(row.outcomes || {}))}</td><td>${Number(row.completed_days || 0)}</td><td>${row.last_activity_at ? escapeHtml(new Date(row.last_activity_at).toLocaleString("ru-RU")) : "—"}</td></tr>`).join("")}</tbody></table></div>`;
}

async function loadAdmin(session) {
  const status = document.getElementById("admin-status"); const dashboard = document.getElementById("admin-dashboard"); status.hidden = false; status.textContent = "Загружаем данные…"; dashboard.hidden = true;
  try { const [summary, participants] = await Promise.all([rpc("admin_dashboard_summary", session), rpc("admin_participant_progress", session)]); const outcomes = summary.outcomes || {}; dashboard.innerHTML = `<div class="admin-stats">${summaryCard(summary.registered_users, "Зарегистрировано")}${summaryCard(summary.participants, "Участников")}${summaryCard(summary.children, "Детских профилей")}${summaryCard(summary.active_participants_30d, "Активны за 30 дней")}${summaryCard(summary.assessments, "Оценок навыков")}${summaryCard(summary.exercise_attempts, "Выполнений упражнений")}${summaryCard(summary.completed_plans, "Завершённых планов")}</div><section class="admin-panel"><h2>Результаты упражнений</h2><div class="admin-outcomes">${summaryCard(outcomes.independent, "Самостоятельно")}${summaryCard(outcomes.assisted, "С помощью")}${summaryCard(outcomes.unable, "Не получилось")}${summaryCard(outcomes.refused, "Отказ")}</div></section><section class="admin-panel"><h2>Прогресс участников</h2>${participantRows(Array.isArray(participants) ? participants : [])}</section>`; status.hidden = true; dashboard.hidden = false; }
  catch (error) { if (/jwt|token|unauthorized/i.test(error.message)) { clearSession(); location.replace("/login"); return; } status.textContent = `Не удалось загрузить данные: ${error.message}`; }
}

async function renderAdmin() {
  const session = await getSession(); if (!session) { location.replace("/login"); return; }
  if (!isSuperadmin(session)) { app.innerHTML = `<main class="auth-page"><section class="auth-card"><div class="auth-kicker">Доступ ограничен</div><h1>Это раздел суперадмина</h1><p>Ваш аккаунт не имеет административных прав.</p><a class="auth-primary auth-link" href="/today">Перейти в приложение</a></section></main>`; return; }
  app.innerHTML = adminShell(session); document.getElementById("logout-button").addEventListener("click", async () => { await signOut(); location.replace("/login"); }); document.getElementById("refresh-admin").addEventListener("click", () => loadAdmin(session)); await loadAdmin(session);
}

function decorateApp(session) {
  const mount = () => {
    if (app.querySelector("[data-account-controls]")) return;
    const shell = app.querySelector(".app-shell"); if (!shell) return;
    const labels = accountLabels();
    const controls = document.createElement("div"); controls.dataset.accountControls = "true"; controls.className = "account-controls";
    if (!session) controls.innerHTML = `<a href="/login">${labels.login}</a><a class="account-register" href="/register">${labels.register}</a>`;
    else controls.innerHTML = `${isSuperadmin(session) ? `<a class="admin-badge" href="/admin">${labels.admin}</a>` : ""}<span>${escapeHtml(session.user?.email || "")}</span><button type="button" data-account-logout>${labels.logout}</button>`;
    shell.append(controls);
    controls.querySelector("[data-account-logout]")?.addEventListener("click", async () => { await signOut(); location.replace("/"); });
  };
  mount(); new MutationObserver(mount).observe(app, { childList: true, subtree: true });
}

document.documentElement.lang = "ru";
const path = location.pathname.replace(/\/$/, "") || "/";
const publicRoutes = new Set(["/", "/login", "/register"]);
const session = await getSession();
if ((path === "/login" || path === "/register") && session) location.replace(isSuperadmin(session) ? "/admin" : userDestination());
else if (path === "/login") mountLogin();
else if (path === "/register") mountRegister();
else if (path === "/admin") await renderAdmin();
else if (!publicRoutes.has(path) && !session) location.replace(`/login?next=${encodeURIComponent(path)}`);
else { if (session) await hydrateState(session); await import("./app.js"); decorateApp(session); }
