const SUPABASE_URL = "https://iismpbsapzmacxqraecx.supabase.co";
const SUPABASE_KEY = "sb_publishable_hFMdiuuIp051vWhUE7IQKg_DczXIfmV";
const SESSION_KEY = "qadam.auth.session.v1";
const STATE_KEY = "qadam.mvp.state.v1";
const ACCESS_KEY = "qadam.account.access.v1";
const CATEGORIES = ["joint_attention", "understanding", "imitation", "communication", "play_thinking", "fine_motor", "regulation", "daily_social"];
const app = document.getElementById("app");
let syncTimer = null;
let adminExerciseRows = [];

function escapeHtml(value = "") {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function readJson(key, fallback = null) {
  try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; }
}

function readSession() { return readJson(SESSION_KEY); }
function writeSession(session) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)); }
function clearSession() { localStorage.removeItem(SESSION_KEY); }

function readAccountAccess(session = readSession()) {
  const saved = readJson(ACCESS_KEY, {});
  return {
    access_tier: saved.access_tier || "standard",
    access_until: saved.access_until || null,
    plan_code: saved.plan_code || null,
    role: accountRole(session),
  };
}

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

function accountRole(session) { return session?.user?.app_metadata?.role || "parent"; }
function isSuperadmin(session) { return accountRole(session) === "superadmin"; }
function isAdmin(session) { return ["admin", "superadmin"].includes(accountRole(session)); }

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

async function requestPasswordReset(email) {
  const redirectTo = encodeURIComponent(`${location.origin}/reset-password`);
  return apiRequest(`/auth/v1/recover?redirect_to=${redirectTo}`, {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

function recoveryAccessToken() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ""));
  return params.get("type") === "recovery" ? params.get("access_token") : null;
}

async function updatePassword(accessToken, password) {
  return apiRequest("/auth/v1/user", {
    method: "PUT",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: JSON.stringify({ password }),
  });
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
  if (!session?.user?.id) return;
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
  if (!session?.user?.id) return;
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

async function hydrateAccountAccess(session) {
  if (!session?.user?.id) return;
  const fallback = { access_tier: "standard", access_until: null, plan_code: null, role: accountRole(session) };
  try {
    const rows = await dataRequest(`account_access?select=access_tier,access_until,plan_code&user_id=eq.${session.user.id}&limit=1`, session);
    localStorage.setItem(ACCESS_KEY, JSON.stringify({ ...fallback, ...(rows?.[0] || {}) }));
  } catch (error) {
    localStorage.setItem(ACCESS_KEY, JSON.stringify(fallback));
    console.warn("Qadam access:", error.message);
  }
}

function scheduleSync(state) {
  clearTimeout(syncTimer);
  syncTimer = setTimeout(() => syncState(state).catch((error) => console.warn("Qadam sync:", error.message)), 650);
}

async function createPaymentOrder(planCode) {
  const session = await getSession();
  if (!session) throw new Error("Сначала войдите в аккаунт");
  return rpc("create_payment_order", session, { p_plan_code: planCode });
}

async function verifyKaspiReceipt(orderId, receiptUrl, fileHash) {
  const session = await getSession();
  if (!session) throw new Error("Сначала войдите в аккаунт");
  const result = await functionRequest("qadam-verify-kaspi-receipt", session, { order_id: orderId, receipt_url: receiptUrl, file_sha256: fileHash });
  if (result.status === "confirmed") await hydrateAccountAccess(session);
  return result;
}

async function submitManualReceipt(orderId, file, fileHash) {
  const session = await getSession();
  if (!session) throw new Error("Сначала войдите в аккаунт");
  const extension = ({ "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" })[file.type] || "bin";
  const path = `${session.user.id}/${orderId}/${fileHash}.${extension}`;
  const response = await fetch(`${SUPABASE_URL}/storage/v1/object/payment-receipts/${path}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": file.type, "x-upsert": "false" },
    body: file,
  });
  if (!response.ok && response.status !== 409) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.message || payload.error || "Не удалось передать чек на проверку");
  }
  return rpc("submit_payment_manual_review", session, { p_order_id: orderId, p_storage_path: path, p_file_sha256: fileHash });
}

async function paymentOrders() {
  const session = await getSession();
  if (!session) return [];
  return dataRequest("payment_orders?select=id,requested_plan_code,requested_amount_kzt,actual_plan_code,actual_amount_kzt,status,access_until,review_reason,created_at,updated_at&order=created_at.desc&limit=10", session);
}

globalThis.qadamAuth = {
  getSession,
  getAccess: () => readAccountAccess(),
  scheduleSync,
  signOut,
  createPaymentOrder,
  verifyKaspiReceipt,
  submitManualReceipt,
  paymentOrders,
  canBrowseCatalogWithoutOnboarding: () => isSuperadmin(readSession()),
};

function userDestination() {
  const state = readJson(STATE_KEY, {});
  return state.progress?.onboardingCompleted ? "/today" : "/language";
}

function authSteps(active) {
  return `<ol class="auth-steps"><li class="${active >= 1 ? "active" : ""}"><span>1</span>Аккаунт</li><li class="${active >= 2 ? "active" : ""}"><span>2</span>Профиль ребёнка</li><li class="${active >= 3 ? "active" : ""}"><span>3</span>Первые упражнения</li></ol>`;
}

function passwordField(name, autocomplete) {
  return `<span class="password-control"><input name="${name}" type="password" autocomplete="${autocomplete}" required minlength="8" /><button class="password-toggle" type="button" data-password-toggle aria-label="Показать пароль" aria-pressed="false"><span>Показать</span></button></span>`;
}

function mountPasswordToggles(container = document) {
  container.querySelectorAll("[data-password-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      const input = button.closest(".password-control")?.querySelector("input");
      if (!input) return;
      const visible = input.type === "text";
      input.type = visible ? "password" : "text";
      button.setAttribute("aria-pressed", String(!visible));
      button.setAttribute("aria-label", visible ? "Показать пароль" : "Скрыть пароль");
      button.querySelector("span").textContent = visible ? "Показать" : "Скрыть";
    });
  });
}

function loginMarkup() {
  const params = new URLSearchParams(location.search);
  const confirmed = params.get("confirmed") === "1";
  const passwordReset = params.get("password_reset") === "1";
  return `<main class="auth-page"><section class="auth-card" aria-labelledby="login-title">
    <a class="auth-brand" href="/" aria-label="Qadam, на главную"><span>Q</span><strong>Qadam</strong></a>${authSteps(1)}
    <div class="auth-kicker">Личный кабинет</div><h1 id="login-title">Вход в Qadam</h1>
    <p>${passwordReset ? "Пароль обновлён. Теперь войдите с новым паролем." : confirmed ? "Email подтверждён. Теперь войдите в аккаунт." : "Продолжите занятия ребёнка с того места, где остановились."}</p>
    <form id="login-form" class="auth-form"><label><span>Email</span><input name="email" type="email" autocomplete="username" required /></label><label><span>Пароль</span>${passwordField("password", "current-password")}</label><p id="login-error" class="auth-error" role="alert" hidden></p><button class="auth-primary" type="submit">Войти</button></form>
    <p class="auth-switch"><a href="/forgot-password">Забыли пароль?</a></p>
    <p class="auth-switch">Нет аккаунта? <a href="/register">Зарегистрироваться</a></p><a class="auth-back" href="/">Вернуться на главную</a>
  </section></main>`;
}

function registerMarkup() {
  return `<main class="auth-page"><section class="auth-card" aria-labelledby="register-title">
    <a class="auth-brand" href="/" aria-label="Qadam, на главную"><span>Q</span><strong>Qadam</strong></a>${authSteps(1)}
    <div class="auth-kicker">Новый аккаунт</div><h1 id="register-title">Начать с Qadam</h1><p>Создайте аккаунт, затем заполните короткий профиль ребёнка и получите первые упражнения.</p>
    <form id="register-form" class="auth-form"><label><span>Email</span><input name="email" type="email" autocomplete="username" required /></label><label><span>Пароль</span>${passwordField("password", "new-password")}</label><label><span>Повторите пароль</span>${passwordField("passwordConfirm", "new-password")}</label><p class="auth-hint">Минимум 8 символов. Лучше использовать уникальный пароль.</p><p id="register-error" class="auth-error" role="alert" hidden></p><button class="auth-primary" type="submit">Создать аккаунт</button></form>
    <p class="auth-switch">Уже есть аккаунт? <a href="/login">Войти</a></p><a class="auth-back" href="/">Вернуться на главную</a>
  </section></main>`;
}

function forgotPasswordMarkup() {
  return `<main class="auth-page"><section class="auth-card" aria-labelledby="forgot-title">
    <a class="auth-brand" href="/" aria-label="Qadam, на главную"><span>Q</span><strong>Qadam</strong></a>
    <div class="auth-kicker">Восстановление доступа</div><h1 id="forgot-title">Забыли пароль?</h1>
    <p>Введите email аккаунта Qadam. Мы отправим безопасную ссылку для создания нового пароля.</p>
    <form id="forgot-form" class="auth-form"><label><span>Email</span><input name="email" type="email" autocomplete="username" required /></label><p id="forgot-error" class="auth-error" role="alert" hidden></p><button class="auth-primary" type="submit">Отправить ссылку</button></form>
    <p class="auth-switch"><a href="/login">Вернуться ко входу</a></p>
  </section></main>`;
}

function resetPasswordMarkup() {
  const hasToken = Boolean(recoveryAccessToken());
  return `<main class="auth-page"><section class="auth-card" aria-labelledby="reset-title">
    <a class="auth-brand" href="/" aria-label="Qadam, на главную"><span>Q</span><strong>Qadam</strong></a>
    <div class="auth-kicker">Новый пароль</div><h1 id="reset-title">${hasToken ? "Создайте новый пароль" : "Ссылка недействительна"}</h1>
    ${hasToken ? `<p>Введите новый пароль для аккаунта Qadam.</p><form id="reset-form" class="auth-form"><label><span>Новый пароль</span>${passwordField("password", "new-password")}</label><label><span>Повторите пароль</span>${passwordField("passwordConfirm", "new-password")}</label><p class="auth-hint">Минимум 8 символов. Используйте уникальный пароль.</p><p id="reset-error" class="auth-error" role="alert" hidden></p><button class="auth-primary" type="submit">Сохранить новый пароль</button></form>` : `<p>Ссылка истекла или уже была использована. Запросите новую ссылку восстановления.</p><a class="auth-primary auth-link" href="/forgot-password">Получить новую ссылку</a>`}
    <p class="auth-switch"><a href="/login">Вернуться ко входу</a></p>
  </section></main>`;
}

function mountLogin() {
  app.innerHTML = loginMarkup();
  mountPasswordToggles(app);
  const form = document.getElementById("login-form"); const errorBox = document.getElementById("login-error");
  form.addEventListener("submit", async (event) => { event.preventDefault(); const button = form.querySelector("button"); const data = new FormData(form); button.disabled = true; button.textContent = "Входим…"; errorBox.hidden = true;
    try { const session = await signIn(String(data.get("email") || "").trim(), String(data.get("password") || "")); location.replace(isSuperadmin(session) ? "/account-mode" : (isAdmin(session) ? "/admin" : userDestination())); }
    catch (error) { errorBox.textContent = error.message === "Invalid login credentials" ? "Неверный email или пароль" : error.message; errorBox.hidden = false; button.disabled = false; button.textContent = "Войти"; }
  });
}

function mountForgotPassword() {
  app.innerHTML = forgotPasswordMarkup();
  const form = document.getElementById("forgot-form");
  const errorBox = document.getElementById("forgot-error");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    const email = String(new FormData(form).get("email") || "").trim();
    button.disabled = true;
    button.textContent = "Отправляем…";
    errorBox.hidden = true;
    try {
      await requestPasswordReset(email);
      app.innerHTML = `<main class="auth-page"><section class="auth-card auth-success"><div class="auth-success-mark">✓</div><div class="auth-kicker">Письмо отправлено</div><h1>Проверьте почту</h1><p>Если аккаунт с таким email существует, вы получите ссылку для создания нового пароля.</p><a class="auth-primary auth-link" href="/login">Вернуться ко входу</a></section></main>`;
    } catch (error) {
      errorBox.textContent = /rate limit/i.test(error.message) ? "Слишком много писем. Подождите немного и попробуйте снова." : error.message;
      errorBox.hidden = false;
      button.disabled = false;
      button.textContent = "Отправить ссылку";
    }
  });
}

function mountResetPassword() {
  app.innerHTML = resetPasswordMarkup();
  mountPasswordToggles(app);
  const form = document.getElementById("reset-form");
  if (!form) return;
  const errorBox = document.getElementById("reset-error");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const password = String(data.get("password") || "");
    const confirmation = String(data.get("passwordConfirm") || "");
    if (password !== confirmation) {
      errorBox.textContent = "Пароли не совпадают";
      errorBox.hidden = false;
      return;
    }
    const accessToken = recoveryAccessToken();
    if (!accessToken) {
      location.replace("/forgot-password");
      return;
    }
    const button = form.querySelector("button");
    button.disabled = true;
    button.textContent = "Сохраняем…";
    errorBox.hidden = true;
    try {
      await updatePassword(accessToken, password);
      clearSession();
      history.replaceState({}, "", "/login?password_reset=1");
      location.reload();
    } catch (error) {
      errorBox.textContent = /expired|invalid|jwt/i.test(error.message) ? "Ссылка истекла. Запросите новую ссылку." : error.message;
      errorBox.hidden = false;
      button.disabled = false;
      button.textContent = "Сохранить новый пароль";
    }
  });
}

function mountRegister() {
  app.innerHTML = registerMarkup();
  mountPasswordToggles(app);
  const form = document.getElementById("register-form"); const errorBox = document.getElementById("register-error");
  form.addEventListener("submit", async (event) => { event.preventDefault(); const button = form.querySelector("button"); const data = new FormData(form); const password = String(data.get("password") || ""); const confirmation = String(data.get("passwordConfirm") || ""); errorBox.hidden = true;
    if (password !== confirmation) { errorBox.textContent = "Пароли не совпадают"; errorBox.hidden = false; return; }
    button.disabled = true; button.textContent = "Создаём аккаунт…";
    try { const result = await signUp(String(data.get("email") || "").trim(), password); if (result.access_token) { location.replace("/language"); return; } app.innerHTML = `<main class="auth-page"><section class="auth-card auth-success"><div class="auth-success-mark">✓</div><div class="auth-kicker">Аккаунт создан</div><h1>Проверьте почту</h1><p>Мы отправили ссылку подтверждения. После подтверждения вернитесь и войдите в Qadam.</p><a class="auth-primary auth-link" href="/login">Перейти ко входу</a></section></main>`; }
    catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; button.disabled = false; button.textContent = "Создать аккаунт"; }
  });
}

async function rpc(name, session, args = {}) { return dataRequest(`rpc/${name}`, session, { method: "POST", body: JSON.stringify(args) }); }
function summaryCard(value, label) { return `<article class="admin-stat"><strong>${Number(value || 0)}</strong><span>${label}</span></article>`; }

function adminShell(session) {
  const roleLabel = isSuperadmin(session) ? "Суперадмин" : "Администратор";
  return `<main class="admin-page"><header class="admin-header"><a class="auth-brand" href="/"><span>Q</span><strong>Qadam</strong></a><nav class="admin-mode-nav" aria-label="Режим аккаунта"><a href="${userDestination()}">Кабинет родителя</a><a class="active" href="/admin">CRM</a></nav><div class="admin-account"><span class="admin-badge">${roleLabel}</span><small>${escapeHtml(session.user?.email || "")}</small><button id="logout-button" type="button">Выйти</button></div></header><section class="admin-content"><div class="admin-title"><div><div class="auth-kicker">Панель управления</div><h1>Qadam CRM</h1><p>Пользователи, детские профили, активность, прогресс и доступы — в одном месте.</p></div><div class="admin-title-actions">${isSuperadmin(session) ? `<a class="auth-secondary admin-parent-link" href="${userDestination()}">Кабинет родителя</a>` : ""}<button id="refresh-admin" class="auth-secondary" type="button">Обновить</button></div></div><div id="admin-status" class="admin-status">Загружаем данные…</div><section id="admin-dashboard" hidden></section></section></main>`;
}

async function functionRequest(name, session, body = {}) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Операция не выполнена");
  return payload;
}

async function hydrateExerciseCatalogue(session) {
  if (!session?.user?.id) return;
  try {
    const rows = await rpc("active_exercises", session);
    const catalogue = Array.isArray(rows) ? rows.map((row) => row.content).filter(Boolean) : [];
    if (!catalogue.length) return;
    const module = await import("./data/exercises.js?v=20260715-superadmin-library");
    module.replaceExercises(catalogue);
  } catch (error) { console.warn("Qadam catalogue:", error.message); }
}

function participantRows(rows) {
  if (!rows.length) return `<div class="admin-empty">Пока нет участников с заполненным профилем ребёнка.</div>`;
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Участник</th><th>Ребёнок</th><th>Уровни</th><th>Результаты</th><th>Дней завершено</th><th>Последняя активность</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.email || "—")}</td><td><strong>${escapeHtml(row.child_name || "—")}</strong><small>${row.child_age ? `${Number(row.child_age)} лет` : ""}</small></td><td>${escapeHtml(JSON.stringify(row.current_levels || {}))}</td><td><small>Сам: ${Number(row.independent_attempts || 0)}</small><small>С помощью: ${Number(row.assisted_attempts || 0)}</small><small>Не получилось: ${Number(row.unable_attempts || 0)}</small><small>Отказ: ${Number(row.refused_attempts || 0)}</small></td><td>${Number(row.completed_days || 0)}</td><td>${row.last_activity_at ? escapeHtml(new Date(row.last_activity_at).toLocaleString("ru-RU")) : "—"}</td></tr>`).join("")}</tbody></table></div>`;
}

function userRows(rows, canManage) {
  if (!rows.length) return `<div class="admin-empty">Зарегистрированных пользователей пока нет.</div>`;
  return `<div class="admin-table-wrap"><table class="admin-table admin-users"><thead><tr><th>Пользователь</th><th>Роль</th><th>Доступ</th><th>Дети</th><th>Активность</th>${canManage ? "<th>Управление</th>" : ""}</tr></thead><tbody>${rows.map((row) => {
    const role = row.account_role === "superadmin" ? "Суперадмин" : row.account_role === "admin" ? "Администратор" : "Родитель";
    const access = row.access_tier === "complimentary" ? `Бесплатно${row.access_until ? ` до ${escapeHtml(row.access_until)}` : " без срока"}` : row.access_tier === "paid" ? `Оплачено${row.access_until ? ` до ${escapeHtml(row.access_until)}` : ""}` : row.access_tier === "blocked" ? "Заблокирован" : "Freemium";
    const controls = canManage && row.account_role !== "superadmin" ? `<div class="admin-row-actions"><button data-admin-action="${row.account_role === "admin" ? "parent" : "admin"}" data-user-id="${row.user_id}">${row.account_role === "admin" ? "Снять роль" : "Сделать админом"}</button><div class="admin-access-grant"><select data-access-period="${row.user_id}" aria-label="Срок полного доступа для ${escapeHtml(row.email || "пользователя")}"><option value="month">1 месяц</option><option value="quarter">3 месяца</option><option value="half_year">6 месяцев</option><option value="year">1 год</option><option value="lifetime">Безлимитно</option></select><button data-admin-action="grant-access" data-user-id="${row.user_id}">Открыть доступ</button></div><button data-admin-action="standard" data-user-id="${row.user_id}">Вернуть Freemium</button></div>` : "";
    return `<tr><td><strong>${escapeHtml(row.email || "—")}</strong><small>${row.created_at ? `Регистрация: ${new Date(row.created_at).toLocaleDateString("ru-RU")}` : ""}</small></td><td><span class="admin-role role-${row.account_role}">${role}</span></td><td>${access}</td><td>${Number(row.children_count || 0)}</td><td><strong>${Number(row.exercise_attempts || 0)}</strong> выполнений<small>${row.last_activity_at ? new Date(row.last_activity_at).toLocaleString("ru-RU") : "Нет активности"}</small></td>${canManage ? `<td>${controls}</td>` : ""}</tr>`;
  }).join("")}</tbody></table></div>`;
}

function exerciseRows(rows, canManage) {
  if (!rows.length) return `<div class="admin-empty">Каталог пока пуст.</div>`;
  return `<div class="admin-table-wrap"><table class="admin-table admin-exercises"><thead><tr><th>Упражнение</th><th>Направление</th><th>Уровень</th><th>Статус</th><th>Источник</th>${canManage ? "<th>Действия</th>" : ""}</tr></thead><tbody>${rows.map((row) => `<tr><td><strong>${escapeHtml(row.content?.ru?.title || row.id)}</strong><small>${escapeHtml(row.content?.kk?.title || "")}</small><small>${escapeHtml(row.id)}</small></td><td>${escapeHtml(row.category)}</td><td>${Number(row.level)}</td><td><span class="admin-role status-${row.status}">${row.status === "active" ? "Активно" : row.status === "draft" ? "Черновик" : "Архив"}</span></td><td>${row.source === "ai" ? "ИИ" : row.source === "import" ? "Базовое" : "Вручную"}</td>${canManage ? `<td><div class="admin-row-actions"><button data-exercise-edit="${row.id}">Редактировать</button><button data-exercise-status="${row.status === "active" ? "archived" : "active"}" data-exercise-id="${row.id}">${row.status === "active" ? "Отключить" : "Опубликовать"}</button></div></td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}

function showAdminModal(title, formMarkup) {
  document.querySelector(".admin-modal")?.remove();
  const modal = document.createElement("div"); modal.className = "admin-modal";
  modal.innerHTML = `<section class="admin-modal-card" role="dialog" aria-modal="true"><header><div><div class="auth-kicker">Qadam CRM</div><h2>${escapeHtml(title)}</h2></div><button type="button" data-close-modal aria-label="Закрыть">×</button></header>${formMarkup}</section>`;
  document.body.append(modal); modal.querySelector("[data-close-modal]").onclick = () => modal.remove();
}

function openCreateUserModal() {
  showAdminModal("Добавить пользователя", `<form class="admin-form" data-admin-form="create-user"><label>Email<input name="email" type="email" required></label><label>Временный пароль<input name="password" type="text" minlength="8" required></label><label>Роль<select name="role"><option value="parent">Родитель</option><option value="admin">Администратор</option></select></label><label class="admin-check"><input name="full_access" type="checkbox" checked> Полный бесплатный доступ без срока</label><p class="admin-form-note">Пользователь сможет сразу войти с указанным паролем. Роль администратора даёт просмотр CRM и каталога, но не управление ролями.</p><button class="auth-primary" type="submit">Создать пользователя</button><p class="auth-error" hidden></p></form>`);
}

function openGenerateModal() {
  const options = CATEGORIES.map((category) => `<option value="${category}">${category}</option>`).join("");
  showAdminModal("Создать упражнение с ИИ", `<form class="admin-form" data-admin-form="generate"><label>Направление<select name="category">${options}</select></label><label>Уровень<select name="level"><option>1</option><option>2</option><option>3</option></select></label><label>Что важно учесть<textarea name="focus" rows="4" placeholder="Например: ребёнок любит машинки, используем только крупные безопасные предметы"></textarea></label><p class="admin-form-note">ИИ создаст двуязычный черновик. Он не попадёт к родителям, пока вы не проверите и не нажмёте «Опубликовать».</p><button class="auth-primary" type="submit">Создать черновик</button><p class="auth-error" hidden></p></form>`);
}

function openExerciseEditor(id) {
  const row = adminExerciseRows.find((item) => item.id === id); if (!row) return;
  const c = row.content; const field = (name, label, value, area = false) => `<label>${label}${area ? `<textarea name="${name}" rows="3">${escapeHtml(value || "")}</textarea>` : `<input name="${name}" value="${escapeHtml(value || "")}" required>`}</label>`;
  showAdminModal(`Редактировать ${id}`, `<form class="admin-form exercise-editor" data-admin-form="edit-exercise" data-exercise-id="${id}"><div class="editor-language"><h3>Русский</h3>${field("ru_title","Название",c.ru?.title)}${field("ru_preparation","Подготовка",c.ru?.preparation,true)}${field("ru_parentWords","Что сказать",c.ru?.parentWords,true)}${field("ru_steps","Три шага — каждый с новой строки",(c.ru?.steps || []).join("\n"),true)}${field("ru_benefit","Польза",c.ru?.benefit,true)}${field("ru_stopRule","Когда остановиться",c.ru?.stopRule,true)}</div><div class="editor-language"><h3>Қазақша</h3>${field("kk_title","Атауы",c.kk?.title)}${field("kk_preparation","Дайындау",c.kk?.preparation,true)}${field("kk_parentWords","Не айту керек",c.kk?.parentWords,true)}${field("kk_steps","Үш қадам — әрқайсысы жаңа жолда",(c.kk?.steps || []).join("\n"),true)}${field("kk_benefit","Пайдасы",c.kk?.benefit,true)}${field("kk_stopRule","Қашан тоқтау керек",c.kk?.stopRule,true)}</div><button class="auth-primary" type="submit">Сохранить изменения</button><p class="auth-error" hidden></p></form>`);
}

async function handleAdminAction(event, session) {
  const receiptButton = event.target.closest("[data-open-payment-receipt]");
  if (receiptButton) {
    const viewer = window.open("about:blank", "_blank");
    if (viewer) viewer.opener = null;
    receiptButton.disabled = true;
    try {
      const result = await functionRequest("qadam-admin-payment-receipt", session, { order_id: receiptButton.dataset.openPaymentReceipt });
      if (viewer) viewer.location = result.url; else window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) { viewer?.close(); alert(error.message); }
    finally { receiptButton.disabled = false; }
    return;
  }
  const editButton = event.target.closest("[data-exercise-edit]");
  if (editButton) { openExerciseEditor(editButton.dataset.exerciseEdit); return; }
  const statusButton = event.target.closest("[data-exercise-status]");
  if (statusButton) { statusButton.disabled = true; try { await rpc("admin_set_exercise_status", session, { p_id: statusButton.dataset.exerciseId, p_status: statusButton.dataset.exerciseStatus }); await loadAdmin(session); } catch (error) { alert(error.message); statusButton.disabled = false; } return; }
  if (event.target.closest("[data-open-create-user]")) { openCreateUserModal(); return; }
  if (event.target.closest("[data-open-generate]")) { openGenerateModal(); return; }
  const button = event.target.closest("[data-admin-action]");
  if (!button) return;
  button.disabled = true;
  const action = button.dataset.adminAction;
  try {
    if (action === "admin" || action === "parent") await rpc("admin_set_user_role", session, { p_user_id: button.dataset.userId, p_role: action });
    else if (action === "grant-access") {
      const period = document.querySelector(`[data-access-period="${CSS.escape(button.dataset.userId)}"]`)?.value;
      await rpc("admin_grant_user_access", session, { p_user_id: button.dataset.userId, p_period: period });
    } else await rpc("admin_set_user_access", session, { p_user_id: button.dataset.userId, p_access_tier: action, p_access_until: null, p_note: null });
    await loadAdmin(session);
  } catch (error) {
    alert(`Не удалось изменить доступ: ${error.message}`);
    button.disabled = false;
  }
}

async function handleAdminForm(event, session) {
  const form = event.target.closest("[data-admin-form]"); if (!form) return;
  event.preventDefault(); const button = form.querySelector("button[type=submit]"); const errorBox = form.querySelector(".auth-error"); const data = new FormData(form); button.disabled = true; errorBox.hidden = true;
  try {
    if (form.dataset.adminForm === "create-user") {
      await functionRequest("qadam-admin-create-user", session, { email: data.get("email"), password: data.get("password"), role: data.get("role"), full_access: data.get("full_access") === "on" });
    } else if (form.dataset.adminForm === "generate") {
      await functionRequest("qadam-generate-exercise", session, { category: data.get("category"), level: Number(data.get("level")), focus: data.get("focus") });
    } else if (form.dataset.adminForm === "edit-exercise") {
      const row = adminExerciseRows.find((item) => item.id === form.dataset.exerciseId); if (!row) throw new Error("Упражнение не найдено");
      const content = structuredClone(row.content);
      for (const language of ["ru", "kk"]) {
        for (const key of ["title", "preparation", "parentWords", "benefit", "stopRule"]) content[language][key] = String(data.get(`${language}_${key}`) || "").trim();
        content[language].steps = String(data.get(`${language}_steps`) || "").split("\n").map((item) => item.trim()).filter(Boolean).slice(0, 3);
        if (content[language].steps.length !== 3) throw new Error("Для каждого языка нужны ровно три шага");
      }
      await rpc("admin_save_exercise", session, { p_content: content, p_status: row.status, p_source: row.source === "import" ? "manual" : row.source });
    }
    document.querySelector(".admin-modal")?.remove(); await loadAdmin(session);
  } catch (error) { errorBox.textContent = error.message; errorBox.hidden = false; button.disabled = false; }
}

function paymentRows(rows) {
  if (!rows.length) return `<div class="admin-empty">Платёжных заявок пока нет.</div>`;
  const labels = { created: "Ожидает чека", verifying: "Проверяется", confirmed: "Подтверждён", manual_review: "Ручная проверка", rejected: "Отклонён", expired: "Истёк", refunded: "Возврат" };
  return `<div class="admin-table-wrap"><table class="admin-table"><thead><tr><th>Пользователь</th><th>Тариф</th><th>Сумма</th><th>Статус</th><th>Чек</th><th>Создан</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.email || "—")}</td><td>${escapeHtml(row.requested_plan_code)}</td><td>${Number(row.actual_amount_kzt || row.requested_amount_kzt || 0).toLocaleString("ru-RU")} ₸</td><td><strong>${labels[row.status] || escapeHtml(row.status)}</strong>${row.review_reason ? `<small>${escapeHtml(row.review_reason)}</small>` : ""}</td><td>${row.receipt_storage_path ? `<button class="auth-secondary" data-open-payment-receipt="${row.id}" type="button">Открыть файл</button>` : escapeHtml(row.kaspi_ext_tran_id || "—")}</td><td>${new Date(row.created_at).toLocaleString("ru-RU")}</td></tr>`).join("")}</tbody></table></div>`;
}

async function loadAdmin(session) {
  const status = document.getElementById("admin-status");
  const dashboard = document.getElementById("admin-dashboard");
  status.hidden = false; status.textContent = "Загружаем данные…"; dashboard.hidden = true;
  try {
    const [summary, participants, users, exerciseList, payments] = await Promise.all([
      rpc("admin_dashboard_summary", session), rpc("admin_participant_progress", session), rpc("admin_users", session), rpc("admin_exercises", session), rpc("admin_payment_orders", session),
    ]);
    adminExerciseRows = Array.isArray(exerciseList) ? exerciseList : [];
    const outcomes = summary.outcomes || {}; const canManage = isSuperadmin(session);
    dashboard.innerHTML = `<div class="admin-stats">${summaryCard(summary.registered_users, "Зарегистрировано")}${summaryCard(summary.participants, "Участников")}${summaryCard(summary.children, "Детских профилей")}${summaryCard(summary.active_participants_30d, "Активны за 30 дней")}${summaryCard(summary.assessments, "Оценок навыков")}${summaryCard(summary.exercise_attempts, "Выполнений упражнений")}${summaryCard(summary.completed_plans, "Завершённых планов")}</div><section class="admin-panel admin-panel-head"><div><div class="auth-kicker">Оплаты Kaspi</div><h2>Платёжные заявки</h2><p>Автоматически подтверждённые чеки и приватная очередь тех, где QR не удалось распознать.</p></div></section><section class="admin-panel admin-panel-flush">${paymentRows(Array.isArray(payments) ? payments : [])}</section><section class="admin-panel admin-panel-head"><div><div class="auth-kicker">Mini CRM</div><h2>Пользователи и доступы</h2><p>Назначайте администраторов и открывайте полный доступ на 1, 3, 6, 12 месяцев или без ограничения срока.</p></div>${canManage ? `<button class="auth-primary" data-open-create-user type="button">Добавить пользователя</button>` : ""}</section><section class="admin-panel admin-panel-flush">${userRows(Array.isArray(users) ? users : [], canManage)}</section><section class="admin-panel admin-panel-head"><div><div class="auth-kicker">Каталог</div><h2>Все упражнения</h2><p>Активные упражнения доступны родителям. Черновики и архивные записи видны только в CRM.</p></div>${canManage ? `<button class="auth-primary" data-open-generate type="button">Создать с ИИ</button>` : ""}</section><section class="admin-panel admin-panel-flush">${exerciseRows(adminExerciseRows, canManage)}</section><section class="admin-panel"><h2>Результаты упражнений</h2><div class="admin-outcomes">${summaryCard(outcomes.independent, "Самостоятельно")}${summaryCard(outcomes.assisted, "С помощью")}${summaryCard(outcomes.unable, "Не получилось")}${summaryCard(outcomes.refused, "Отказ")}</div></section><section class="admin-panel"><h2>Прогресс участников</h2>${participantRows(Array.isArray(participants) ? participants : [])}</section>`;
    dashboard.onclick = (event) => handleAdminAction(event, session); document.onsubmit = (event) => handleAdminForm(event, session); status.hidden = true; dashboard.hidden = false;
  } catch (error) {
    if (/jwt|token|unauthorized/i.test(error.message)) { clearSession(); location.replace("/login"); return; }
    status.textContent = `Не удалось загрузить данные: ${error.message}`;
  }
}

async function renderAdmin() {
  const session = await getSession(); if (!session) { location.replace("/login"); return; }
  if (!isAdmin(session)) { app.innerHTML = `<main class="auth-page"><section class="auth-card"><div class="auth-kicker">Доступ ограничен</div><h1>Это раздел администрации</h1><p>Ваш аккаунт не имеет административных прав.</p><a class="auth-primary auth-link" href="/today">Перейти в приложение</a></section></main>`; return; }
  app.innerHTML = adminShell(session); document.getElementById("logout-button").addEventListener("click", async () => { await signOut(); location.replace("/login"); }); document.getElementById("refresh-admin").addEventListener("click", () => loadAdmin(session)); await loadAdmin(session);
}

function renderAccountMode(session) {
  if (!session) { location.replace("/login"); return; }
  if (!isSuperadmin(session)) { location.replace(isAdmin(session) ? "/admin" : userDestination()); return; }
  app.innerHTML = `<main class="auth-page mode-page"><section class="mode-card"><a class="auth-brand" href="/"><span>Q</span><strong>Qadam</strong></a><div class="auth-kicker">Выберите режим</div><h1>Как хотите войти?</h1><p>Один аккаунт — два независимых рабочих пространства. Родительский прогресс вашего ребёнка сохраняется отдельно от CRM.</p><div class="mode-options"><a class="mode-option parent-mode" href="${userDestination()}"><span class="mode-icon">♡</span><strong>Как родитель</strong><small>Профиль вашего ребёнка, ежедневный план, упражнения и прогресс</small><b>Открыть кабинет родителя →</b></a><a class="mode-option admin-mode" href="/admin"><span class="mode-icon">⌘</span><strong>Как суперадмин</strong><small>Пользователи, аналитика, роли, доступы и общий прогресс</small><b>Открыть CRM →</b></a></div><small class="mode-account">${escapeHtml(session.user?.email || "")}</small></section></main>`;
}

function decorateApp(session) {
  const mount = () => {
    const shell = app.querySelector(".app-shell");
    if (!shell) return;
    const mounts = [...app.querySelectorAll("[data-account-controls-mount]")];
    const targets = mounts.length ? mounts : [shell];
    const labels = accountLabels();
    targets.forEach((target) => {
      if (target.querySelector("[data-account-controls]")) return;
      const controls = document.createElement("div");
      controls.dataset.accountControls = "true";
      controls.className = "account-controls";
      if (!session) controls.innerHTML = `<a href="/login">${labels.login}</a><a class="account-register" href="/register">${labels.register}</a>`;
      else controls.innerHTML = `${isAdmin(session) && !isSuperadmin(session) ? `<a class="admin-badge" href="/admin">${labels.admin}</a>` : ""}<span>${escapeHtml(session.user?.email || "")}</span><button type="button" data-account-logout>${labels.logout}</button>`;
      target.append(controls);
      controls.querySelector("[data-account-logout]")?.addEventListener("click", async () => {
        await signOut();
        location.replace("/");
      });
    });
  };
  mount();
  new MutationObserver(mount).observe(app, { childList: true, subtree: true });
}

document.documentElement.lang = "ru";
const path = location.pathname.replace(/\/$/, "") || "/";
const publicRoutes = new Set(["/", "/login", "/register", "/forgot-password", "/reset-password"]);
const session = await getSession();
if ((path === "/login" || path === "/register") && session) location.replace(isSuperadmin(session) ? "/account-mode" : (isAdmin(session) ? "/admin" : userDestination()));
else if (path === "/login") mountLogin();
else if (path === "/register") mountRegister();
else if (path === "/account-mode") renderAccountMode(session);
else if (path === "/forgot-password") mountForgotPassword();
else if (path === "/reset-password") mountResetPassword();
else if (path === "/admin") await renderAdmin();
else if (!publicRoutes.has(path) && !session) location.replace(`/login?next=${encodeURIComponent(path)}`);
else { if (session) { await Promise.all([hydrateState(session), hydrateAccountAccess(session), hydrateExerciseCatalogue(session)]); } await import("./app.js?v=20260715-superadmin-library"); decorateApp(session); }
