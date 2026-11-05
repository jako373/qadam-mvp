import { exerciseCategories, exerciseCategoryOrder } from "./data/exercise-localization.js";

const escape = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export async function renderFamilyDashboard({ app, session, dataRequest, apiRequest, signOut }) {
  const language = localStorage.getItem("qadam.family.language") === "kk" ? "kk" : "ru";
  const labels = language === "kk"
    ? { eyebrow: "Ата-ана кабинеті", title: "Балаңыздың дамуы", intro: "Маман енгізген бағалау осында көрінеді.", noChild: "Бала профилі табылмады. Орталыққа хабарласыңыз.", noAssessment: "Маман алғашқы бағалауды әлі толтырмады.", stage: "Деңгей", history: "Бағалау тарихы", password: "Құпиясөзді өзгерту", newPassword: "Жаңа құпиясөз", save: "Сақтау", saved: "Құпиясөз жаңартылды", logout: "Шығу" }
    : { eyebrow: "Кабинет родителя", title: "Развитие вашего ребёнка", intro: "Здесь видны оценки, внесённые специалистом.", noChild: "Профиль ребёнка не найден. Обратитесь в центр.", noAssessment: "Специалист ещё не заполнил первую оценку.", stage: "Уровень", history: "История оценок", password: "Сменить пароль", newPassword: "Новый пароль", save: "Сохранить", saved: "Пароль обновлён", logout: "Выйти" };
  const children = await dataRequest(`children?select=id,name,age&parent_id=eq.${session.user.id}&order=created_at.asc`, session);
  const child = children[0];
  const assessments = child ? await dataRequest(`specialist_assessments?select=skill_levels,completed_at,specialist_name&child_id=eq.${child.id}&order=completed_at.desc&limit=20`, session) : [];
  const latest = assessments[0];
  app.innerHTML = `<main class="center-page"><header class="center-header"><a class="auth-brand" href="/"><span>Q</span><strong>Qadam</strong></a><div><button type="button" data-language="${language === "ru" ? "kk" : "ru"}">${language === "ru" ? "Қазақша" : "Русский"}</button><button type="button" data-logout>${labels.logout}</button></div></header><div class="center-main family-main"><div class="auth-kicker">${labels.eyebrow}</div><h1>${labels.title}</h1><p class="center-intro">${labels.intro}</p>${child ? `<section class="center-card"><h2>${escape(child.name)}</h2><p>${child.age} ${language === "ru" ? "лет" : "жаста"}</p>${latest ? `<p>${escape(latest.specialist_name)} · ${new Date(latest.completed_at).toLocaleDateString(language === "ru" ? "ru-RU" : "kk-KZ")}</p><div class="center-progress-skills">${exerciseCategoryOrder.map((category) => { const level = Math.max(1, Math.min(3, Number(latest.skill_levels?.[category]) || 1)); return `<div><span>${escape(exerciseCategories[category][language].title)}</span><progress max="3" value="${level}">${level}/3</progress><strong>${labels.stage} ${level}/3</strong></div>`; }).join("")}</div>` : `<p class="center-empty">${labels.noAssessment}</p>`}</section>${assessments.length ? `<section class="center-card"><h2>${labels.history}</h2><ul class="center-staff">${assessments.map((item) => `<li><strong>${escape(item.specialist_name)}</strong><time datetime="${escape(item.completed_at)}">${new Date(item.completed_at).toLocaleDateString(language === "ru" ? "ru-RU" : "kk-KZ")}</time></li>`).join("")}</ul></section>` : ""}` : `<section class="center-card"><p>${labels.noChild}</p></section>`}<section class="center-card"><h2>${labels.password}</h2><form class="center-form" id="family-password-form"><label>${labels.newPassword}<input name="password" type="password" autocomplete="new-password" minlength="12" required></label><button type="button" data-toggle-password aria-pressed="false">${language === "ru" ? "Показать пароль" : "Құпиясөзді көрсету"}</button><button type="submit">${labels.save}</button></form><p id="family-message" role="status"></p></section></div></main>`;
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
    const button = form.querySelector("button");
    const message = app.querySelector("#family-message");
    button.disabled = true;
    try {
      await apiRequest("/auth/v1/user", { method: "PUT", headers: { Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ password: new FormData(form).get("password") }) });
      form.reset(); message.textContent = labels.saved;
    } catch { message.textContent = language === "ru" ? "Не удалось изменить пароль" : "Құпиясөзді өзгерту мүмкін болмады"; }
    finally { button.disabled = false; }
  });
}
