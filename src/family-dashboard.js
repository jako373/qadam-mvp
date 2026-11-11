import { exerciseCategories, exerciseCategoryOrder } from "./data/exercise-localization.js";

const escape = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export async function renderFamilyDashboard({ app, session, dataRequest, apiRequest, signOut }) {
  const language = localStorage.getItem("qadam.family.language") === "kk" ? "kk" : "ru";
  const locale = language === "ru" ? "ru-RU" : "kk-KZ";
  const labels = language === "kk"
    ? { eyebrow: "Ата-ана кабинеті", title: "Балаңыздың дамуы", intro: "Маман енгізген бағалау, мақсаттар және ұсыныстар осында көрінеді.", noChild: "Бала профилі табылмады. Орталыққа хабарласыңыз.", noAssessment: "Маман алғашқы бағалауды әлі толтырмады.", stage: "Деңгей", history: "Бағалау тарихы", password: "Құпиясөзді өзгерту", newPassword: "Жаңа құпиясөз", save: "Сақтау", saved: "Құпиясөз жаңартылды", logout: "Шығу", sessions: "Сабақтар және қатысу", noSessions: "Әзірге сабақ жоспарланбаған.", planned: "Жоспарланған", present: "Қатысты", absent: "Қатыспады", cancelled: "Болдырылмады", goals: "Дағды мақсаттары", noGoals: "Маман әлі мақсат қоспады.", active: "Жұмыста", achieved: "Орындалды", paused: "Үзіліс", current: "Қазір", target: "Мақсат", recommendations: "Үйде не істеп көруге болады", noRecommendations: "Маманның ұсыныстары осында пайда болады." }
    : { eyebrow: "Кабинет родителя", title: "Развитие вашего ребёнка", intro: "Здесь видны оценки, цели и рекомендации специалиста.", noChild: "Профиль ребёнка не найден. Обратитесь в центр.", noAssessment: "Специалист ещё не заполнил первую оценку.", stage: "Уровень", history: "История оценок", password: "Сменить пароль", newPassword: "Новый пароль", save: "Сохранить", saved: "Пароль обновлён", logout: "Выйти", sessions: "Занятия и посещаемость", noSessions: "Занятий пока нет.", planned: "Запланировано", present: "Был", absent: "Не был", cancelled: "Отменено", goals: "Цели по навыкам", noGoals: "Специалист ещё не добавил цели.", active: "В работе", achieved: "Достигнуто", paused: "Пауза", current: "Сейчас", target: "Цель", recommendations: "Что попробовать дома", noRecommendations: "Рекомендации специалиста появятся здесь." };
  const children = await dataRequest(`children?select=id,name,age&parent_id=eq.${session.user.id}&order=created_at.asc`, session);
  const child = children[0];
  const [assessments, sessions, goals, recommendations] = child ? await Promise.all([
    dataRequest(`specialist_assessments?select=skill_levels,completed_at,specialist_name&child_id=eq.${child.id}&order=completed_at.desc&limit=20`, session),
    dataRequest(`center_sessions?select=starts_at,duration_minutes,topic,status,session_summary&child_id=eq.${child.id}&order=starts_at.desc&limit=200`, session),
    dataRequest(`center_skill_goals?select=skill_key,summary,target_level,target_date,status&child_id=eq.${child.id}&order=created_at.desc&limit=100`, session),
    dataRequest(`center_child_notes?select=content,created_at&child_id=eq.${child.id}&audience=eq.family&order=created_at.desc&limit=30`, session),
  ]) : [[], [], [], []];
  const latest = assessments[0];
  const formatDate = (value) => new Date(value).toLocaleDateString(locale, { day: "numeric", month: "long", year: "numeric" });
  const upcoming = sessions.filter((item) => item.status === "planned" && new Date(item.starts_at).getTime() >= Date.now()).sort((a, b) => new Date(a.starts_at) - new Date(b.starts_at)).slice(0, 4);
  const recent = sessions.filter((item) => !upcoming.includes(item)).slice(0, 4);
  const shownSessions = [...upcoming, ...recent];
  const statusLabel = (status) => ({ planned: labels.planned, present: labels.present, absent: labels.absent, cancelled: labels.cancelled })[status] || labels.planned;
  const childMarkup = child ? `<section class="center-card family-progress-card"><h2>${escape(child.name)}</h2><p>${child.age} ${language === "ru" ? "лет" : "жаста"}</p>${latest ? `<p>${escape(latest.specialist_name)} · ${formatDate(latest.completed_at)}</p><div class="center-progress-skills">${exerciseCategoryOrder.map((category) => { const raw = latest.skill_levels?.[category]; const level = raw == null ? null : Math.max(1, Math.min(3, Number(raw) || 1)); return `<div><span>${escape(exerciseCategories[category][language].title)}</span>${level === null ? `<strong>${language === "kk" ? "Бағаланбады" : "Не оценено"}</strong>` : `<progress max="3" value="${level}">${level}/3</progress><strong>${labels.stage} ${level}/3</strong>`}</div>`; }).join("")}</div>` : `<p class="center-empty">${labels.noAssessment}</p>`}</section>
    <div class="family-plan-grid"><section class="center-card family-sessions-card"><div class="center-card-kicker">${labels.sessions}</div><h2>${labels.sessions}</h2>${shownSessions.length ? `<ul class="family-list">${shownSessions.map((item) => `<li><div><strong>${escape(item.topic)}</strong><small>${formatDate(item.starts_at)} · ${new Date(item.starts_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })} · ${item.duration_minutes} ${language === "ru" ? "мин" : "мин"}</small>${item.session_summary ? `<p class="family-session-summary">${escape(item.session_summary)}</p>` : ""}</div><span class="family-status family-status-${item.status}">${statusLabel(item.status)}</span></li>`).join("")}</ul>` : `<p class="center-empty">${labels.noSessions}</p>`}</section>
    <section class="center-card family-goals-card"><div class="center-card-kicker">${labels.goals}</div><h2>${labels.goals}</h2>${goals.length ? `<ul class="family-list">${goals.map((goal) => { const current = Number(latest?.skill_levels?.[goal.skill_key]); return `<li><div><strong>${escape(exerciseCategories[goal.skill_key]?.[language]?.title || goal.skill_key)}</strong><p>${escape(goal.summary)}</p><small>${Number.isInteger(current) && current >= 1 && current <= 3 ? `${labels.current} ${current}/3 · ` : ""}${labels.target} ${goal.target_level}/3${goal.target_date ? ` · ${formatDate(`${goal.target_date}T12:00:00`)}` : ""}</small></div><span class="family-status family-status-${goal.status}">${({ active: labels.active, achieved: labels.achieved, paused: labels.paused })[goal.status]}</span></li>`; }).join("")}</ul>` : `<p class="center-empty">${labels.noGoals}</p>`}</section></div>
    <section class="center-card family-recommendations"><div class="center-card-kicker">${labels.recommendations}</div><h2>${labels.recommendations}</h2>${recommendations.length ? `<ul class="family-recommendation-list">${recommendations.map((note) => `<li><p>${escape(note.content)}</p><time datetime="${escape(note.created_at)}">${formatDate(note.created_at)}</time></li>`).join("")}</ul>` : `<p class="center-empty">${labels.noRecommendations}</p>`}</section>
    ${assessments.length ? `<section class="center-card"><h2>${labels.history}</h2><ul class="center-staff">${assessments.map((item) => `<li><strong>${escape(item.specialist_name)}</strong><time datetime="${escape(item.completed_at)}">${formatDate(item.completed_at)}</time></li>`).join("")}</ul></section>` : ""}` : `<section class="center-card"><p>${labels.noChild}</p></section>`;
  app.innerHTML = `<main class="center-page"><header class="center-header"><a class="auth-brand" href="/"><span>Q</span><strong>Qadam</strong></a><div class="center-header-actions"><button type="button" data-language="${language === "ru" ? "kk" : "ru"}">${language === "ru" ? "Қазақша" : "Русский"}</button><button type="button" data-logout>${labels.logout}</button></div></header><div class="center-main family-main"><div class="auth-kicker">${labels.eyebrow}</div><h1>${labels.title}</h1><p class="center-intro">${labels.intro}</p>${childMarkup}<section class="center-card family-password-card"><h2>${labels.password}</h2><form class="center-form" id="family-password-form"><label>${labels.newPassword}<input name="password" type="password" autocomplete="new-password" minlength="12" required></label><button type="button" data-toggle-password aria-pressed="false">${language === "ru" ? "Показать пароль" : "Құпиясөзді көрсету"}</button><button type="submit">${labels.save}</button></form><p id="family-message" role="status"></p></section></div></main>`;
  app.querySelector("[data-logout]").addEventListener("click", async () => { await signOut(); location.replace("/login"); });
  app.querySelector("[data-language]").addEventListener("click", (event) => { localStorage.setItem("qadam.family.language", event.currentTarget.dataset.language); location.reload(); });
  app.querySelector("[data-toggle-password]").addEventListener("click", (event) => {
    const button = event.currentTarget;
    const input = app.querySelector('#family-password-form input[name="password"]');
    const visible = input.type === "text";
    input.type = visible ? "password" : "text";
    button.setAttribute("aria-pressed", String(!visible));
    button.textContent = visible ? (language === "ru" ? "Показать пароль" : "Құпиясөзді көрсету") : (language === "ru" ? "Скрыть пароль" : "Құпиясөзді жасыру");
  });
  app.querySelector("#family-password-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    const message = app.querySelector("#family-message");
    button.disabled = true;
    try {
      await apiRequest("/auth/v1/user", { method: "PUT", headers: { Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ password: new FormData(form).get("password") }) });
      form.reset(); message.textContent = labels.saved;
    } catch { message.textContent = language === "ru" ? "Не удалось изменить пароль" : "Құпиясөзді өзгерту мүмкін болмады"; }
    finally { button.disabled = false; }
  });
}
