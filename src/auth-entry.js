const SUPABASE_URL = "https://iismpbsapzmacxqraecx.supabase.co";
const SUPABASE_KEY = "sb_publishable_hFMdiuuIp051vWhUE7IQKg_DczXIfmV";
const SESSION_KEY = "qadam.auth.session.v1";

const app = document.getElementById("app");

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function readSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  } catch {
    return null;
  }
}

function writeSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}

async function authRequest(path, options = {}) {
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    ...options,
    headers: {
      apikey: SUPABASE_KEY,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.msg || payload.message || payload.error_description || "Не удалось выполнить вход");
  return payload;
}

async function refreshSession(session) {
  if (!session?.refresh_token) return null;
  try {
    const refreshed = await authRequest("/auth/v1/token?grant_type=refresh_token", {
      method: "POST",
      body: JSON.stringify({ refresh_token: session.refresh_token }),
    });
    writeSession(refreshed);
    return refreshed;
  } catch {
    clearSession();
    return null;
  }
}

async function getSession() {
  const session = readSession();
  if (!session?.access_token) return null;
  const expiresAt = Number(session.expires_at || 0);
  if (expiresAt && expiresAt * 1000 > Date.now() + 60_000) return session;
  return refreshSession(session);
}

function isSuperadmin(session) {
  return session?.user?.app_metadata?.role === "superadmin";
}

async function signIn(email, password) {
  const session = await authRequest("/auth/v1/token?grant_type=password", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  writeSession(session);
  return session;
}

async function signOut() {
  const session = readSession();
  clearSession();
  if (!session?.access_token) return;
  await authRequest("/auth/v1/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch(() => {});
}

async function rpc(name, session) {
  return authRequest(`/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: "{}",
  });
}

function loginMarkup() {
  return `
    <main class="auth-page">
      <section class="auth-card" aria-labelledby="login-title">
        <a class="auth-brand" href="/" aria-label="Qadam, на главную"><span>Q</span><strong>Qadam</strong></a>
        <div class="auth-kicker">Личный кабинет</div>
        <h1 id="login-title">Вход в Qadam</h1>
        <p>Введите email и пароль. Для суперадмина после входа откроется административная панель.</p>
        <form id="login-form" class="auth-form">
          <label><span>Email</span><input name="email" type="email" autocomplete="username" required /></label>
          <label><span>Пароль</span><input name="password" type="password" autocomplete="current-password" required minlength="6" /></label>
          <p id="login-error" class="auth-error" role="alert" hidden></p>
          <button class="auth-primary" type="submit">Войти</button>
        </form>
        <a class="auth-back" href="/">Вернуться на главную</a>
      </section>
    </main>`;
}

function renderLogin() {
  document.documentElement.lang = "ru";
  app.innerHTML = loginMarkup();
  const form = document.getElementById("login-form");
  const errorBox = document.getElementById("login-error");
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector("button");
    const data = new FormData(form);
    button.disabled = true;
    button.textContent = "Входим…";
    errorBox.hidden = true;
    try {
      const session = await signIn(String(data.get("email") || "").trim(), String(data.get("password") || ""));
      location.replace(isSuperadmin(session) ? "/admin" : "/today");
    } catch (error) {
      errorBox.textContent = error.message === "Invalid login credentials" ? "Неверный email или пароль" : error.message;
      errorBox.hidden = false;
      button.disabled = false;
      button.textContent = "Войти";
    }
  });
}

function summaryCard(value, label) {
  return `<article class="admin-stat"><strong>${Number(value || 0)}</strong><span>${label}</span></article>`;
}

function adminShell(session) {
  const email = escapeHtml(session.user?.email || "");
  return `
    <main class="admin-page">
      <header class="admin-header">
        <a class="auth-brand" href="/"><span>Q</span><strong>Qadam</strong></a>
        <div class="admin-account"><span class="admin-badge">Суперадмин</span><small>${email}</small><button id="logout-button" type="button">Выйти</button></div>
      </header>
      <section class="admin-content">
        <div class="admin-title"><div><div class="auth-kicker">Панель управления</div><h1>Обзор Qadam</h1><p>Регистрации и прогресс всех участников.</p></div><button id="refresh-admin" class="auth-secondary" type="button">Обновить</button></div>
        <div id="admin-status" class="admin-status">Загружаем данные…</div>
        <section id="admin-dashboard" hidden></section>
      </section>
    </main>`;
}

function participantRows(rows) {
  if (!rows.length) return `<div class="admin-empty">Пока нет участников с заполненным профилем ребёнка.</div>`;
  return `
    <div class="admin-table-wrap"><table class="admin-table">
      <thead><tr><th>Участник</th><th>Ребёнок</th><th>Уровни</th><th>Результаты</th><th>Дней завершено</th><th>Последняя активность</th></tr></thead>
      <tbody>${rows.map((row) => `<tr>
        <td>${escapeHtml(row.participant_email || "—")}</td>
        <td><strong>${escapeHtml(row.child_name || "—")}</strong><small>${row.child_age ? `${Number(row.child_age)} лет` : ""}</small></td>
        <td>${escapeHtml(JSON.stringify(row.skill_levels || {}))}</td>
        <td>${escapeHtml(JSON.stringify(row.outcomes || {}))}</td>
        <td>${Number(row.completed_days || 0)}</td>
        <td>${row.last_activity_at ? escapeHtml(new Date(row.last_activity_at).toLocaleString("ru-RU")) : "—"}</td>
      </tr>`).join("")}</tbody>
    </table></div>`;
}

async function loadAdmin(session) {
  const status = document.getElementById("admin-status");
  const dashboard = document.getElementById("admin-dashboard");
  status.hidden = false;
  status.textContent = "Загружаем данные…";
  dashboard.hidden = true;
  try {
    const [summary, participants] = await Promise.all([
      rpc("admin_dashboard_summary", session),
      rpc("admin_participant_progress", session),
    ]);
    const outcomes = summary.outcomes || {};
    dashboard.innerHTML = `
      <div class="admin-stats">
        ${summaryCard(summary.registered_users, "Зарегистрировано")}
        ${summaryCard(summary.participants, "Участников")}
        ${summaryCard(summary.children, "Детских профилей")}
        ${summaryCard(summary.active_participants_30d, "Активны за 30 дней")}
        ${summaryCard(summary.assessments, "Оценок навыков")}
        ${summaryCard(summary.exercise_attempts, "Выполнений упражнений")}
        ${summaryCard(summary.completed_plans, "Завершённых планов")}
      </div>
      <section class="admin-panel"><h2>Результаты упражнений</h2><div class="admin-outcomes">
        ${summaryCard(outcomes.independent, "Самостоятельно")}
        ${summaryCard(outcomes.assisted, "С помощью")}
        ${summaryCard(outcomes.unable, "Не получилось")}
        ${summaryCard(outcomes.refused, "Отказ")}
      </div></section>
      <section class="admin-panel"><h2>Прогресс участников</h2>${participantRows(Array.isArray(participants) ? participants : [])}</section>`;
    status.hidden = true;
    dashboard.hidden = false;
  } catch (error) {
    if (/jwt|token|unauthorized/i.test(error.message)) {
      clearSession();
      location.replace("/login");
      return;
    }
    status.textContent = `Не удалось загрузить данные: ${error.message}`;
  }
}

async function renderAdmin() {
  document.documentElement.lang = "ru";
  const session = await getSession();
  if (!session) {
    location.replace("/login");
    return;
  }
  if (!isSuperadmin(session)) {
    app.innerHTML = `<main class="auth-page"><section class="auth-card"><div class="auth-kicker">Доступ ограничен</div><h1>Это раздел суперадмина</h1><p>Ваш аккаунт не имеет административных прав.</p><a class="auth-primary auth-link" href="/today">Перейти в приложение</a></section></main>`;
    return;
  }
  app.innerHTML = adminShell(session);
  document.getElementById("logout-button").addEventListener("click", async () => {
    await signOut();
    location.replace("/login");
  });
  document.getElementById("refresh-admin").addEventListener("click", () => loadAdmin(session));
  await loadAdmin(session);
}

function decorateAdmin(session) {
  if (!isSuperadmin(session)) return;
  const addBadge = () => {
    const topNav = document.querySelector(".top-nav");
    if (!topNav || topNav.querySelector("[data-admin-link]")) return;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "admin-nav-link";
    button.dataset.adminLink = "true";
    button.innerHTML = `<span class="admin-badge">Суперадмин</span><span>Админ-панель</span>`;
    button.addEventListener("click", () => { location.href = "/admin"; });
    topNav.insertBefore(button, topNav.lastElementChild);
  };
  addBadge();
  new MutationObserver(addBadge).observe(app, { childList: true, subtree: true });
}

const path = location.pathname.replace(/\/$/, "") || "/";
if (path === "/login") {
  const session = await getSession();
  if (session && isSuperadmin(session)) location.replace("/admin");
  else renderLogin();
} else if (path === "/admin") {
  await renderAdmin();
} else {
  const session = await getSession();
  await import("./app.js");
  decorateAdmin(session);
}
