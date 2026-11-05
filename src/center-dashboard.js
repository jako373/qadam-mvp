import { assessmentQuestions } from "./data/assessment-questions.js";
import { calculateSkillLevels } from "./lib/progress-engine.js";

const escape = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

export async function renderCenterDashboard({ app, session, membership, dataRequest, apiRequest, signOut }) {
  const centerId = membership.center_id;
  const admin = membership.role === "admin";
  const state = { groups: [], staff: [], students: [], groupStudents: [], groupSpecialists: [], assessments: [], selectedChild: null, error: "", newCredentials: null, passwordChanged: false };
  const request = (path, options) => dataRequest(path, session, options);
  const write = (table, row) => request(table, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });

  async function load() {
    const query = `center_id=eq.${encodeURIComponent(centerId)}`;
    const [groups, staff, students, groupStudents, groupSpecialists, assessments] = await Promise.all([
      request(`center_groups?select=id,name,center_id&${query}&order=created_at.asc`),
      request(`center_staff?select=user_id,role,full_name,specialty&${query}&order=created_at.asc`),
      request(`center_students?select=child_id,active&${query}&active=eq.true`),
      request(`center_group_students?select=group_id,child_id&${query}`),
      request(`center_group_specialists?select=group_id,user_id&${query}`),
      request(`specialist_assessments?select=child_id,completed_at,skill_levels,specialist_name&${query}&order=completed_at.desc&limit=100`),
    ]);
    state.groups = groups;
    state.staff = staff;
    state.groupStudents = groupStudents;
    state.groupSpecialists = groupSpecialists;
    state.assessments = assessments;
    const childIds = students.map((item) => item.child_id);
    state.students = childIds.length ? await request(`children?select=id,name,age,diagnosis&id=in.(${childIds.join(",")})`) : [];
    paint();
  }

  function memberName(id) { return state.staff.find((item) => item.user_id === id)?.full_name || "—"; }
  function childName(id) { return state.students.find((item) => item.id === id)?.name || "—"; }
  function latestAssessment(id) { return state.assessments.find((item) => item.child_id === id); }

  function groupCard(group) {
    const specialists = state.groupSpecialists.filter((item) => item.group_id === group.id);
    const students = state.groupStudents.filter((item) => item.group_id === group.id && state.students.some((child) => child.id === item.child_id));
    return `<section class="center-card"><div class="center-card-head"><div><h3>${escape(group.name)}</h3><p>${students.length} учеников · ${specialists.length} специалистов</p></div></div>
      <p class="center-muted">${specialists.map((item) => escape(memberName(item.user_id))).join(", ") || "Специалист пока не назначен"}</p>
      ${students.length ? `<ul class="center-children">${students.map((item) => {
        const last = latestAssessment(item.child_id);
        return `<li><span><strong>${escape(childName(item.child_id))}</strong><small>${last ? `Последняя оценка: ${new Date(last.completed_at).toLocaleDateString("ru-RU")}` : "Оценка пока не заполнена"}</small></span><button type="button" data-assess="${item.child_id}">Открыть вопросы</button></li>`;
      }).join("")}</ul>` : `<p class="center-empty">В этой группе пока нет учеников.</p>`}
      ${admin ? `<div class="center-assign"><form data-action="assign-specialist"><input type="hidden" name="group_id" value="${group.id}"><label>Добавить специалиста<select name="user_id" required><option value="">Выберите сотрудника</option>${state.staff.filter((item) => item.role === "specialist" && !specialists.some((assigned) => assigned.user_id === item.user_id)).map((item) => `<option value="${item.user_id}">${escape(item.full_name)}</option>`).join("")}</select></label><button type="submit">Назначить</button></form>
      <form data-action="assign-student"><input type="hidden" name="group_id" value="${group.id}"><label>Добавить ученика<select name="child_id" required><option value="">Выберите ученика</option>${state.students.filter((item) => !students.some((assigned) => assigned.child_id === item.id)).map((item) => `<option value="${item.id}">${escape(item.name)}</option>`).join("")}</select></label><button type="submit">Добавить</button></form></div>` : ""}
    </section>`;
  }

  function assessmentMarkup() {
    const child = state.students.find((item) => item.id === state.selectedChild);
    if (!child) return "";
    return `<section class="center-card center-assessment" aria-labelledby="assessment-title"><div class="center-card-head"><div><div class="auth-kicker">Оценка навыков</div><h2 id="assessment-title">${escape(child.name)}</h2><p>Ответы специалиста сохраняются отдельно от ответов родителя.</p></div><button type="button" data-close-assessment aria-label="Закрыть вопросы">×</button></div>
      <form data-action="save-assessment">${assessmentQuestions.map((question, index) => `<fieldset><legend>${index + 1}. ${escape(question.ru)}</legend>${question.answers.map((answer) => `<label><input type="radio" name="${escape(question.id)}" value="${answer.value === null ? "unknown" : answer.value}" required><span>${escape(answer.ru)}</span></label>`).join("")}</fieldset>`).join("")}<button class="auth-primary" type="submit">Сохранить оценку</button></form></section>`;
  }

  function paint() {
    const credentials = state.newCredentials ? `<section class="center-card center-credentials" role="status"><h2>Доступ для семьи создан</h2><p>Передайте родителю данные лично. Пароль показывается только сейчас.</p><p><strong>Логин:</strong> <code>${escape(state.newCredentials.parent_login)}</code></p><p><strong>Временный пароль:</strong> <code>${escape(state.newCredentials.temporary_password)}</code></p><button type="button" data-dismiss-credentials>Скрыть данные</button></section>` : "";
    const options = (values) => values.map((value) => `<option value="${escape(value)}">${escape(value)}</option>`).join("");
    const enrollment = `<section class="center-card"><h2>Зарегистрировать ребёнка</h2><p class="center-muted">Для семьи создаётся отдельный вход по ИИН ребёнка. ИИН не показывается в списках центра.</p><form class="center-form center-enroll" data-action="enroll"><label>ИИН ребёнка<input name="iin" inputmode="numeric" pattern="[0-9]{12}" minlength="12" maxlength="12" autocomplete="off" required></label><label>Имя ребёнка<input name="name" minlength="1" maxlength="80" required></label><label>Возраст<select name="age" required>${options(["2","3","4","5","6","7"])}</select></label><label>Диагноз или отметка<select name="diagnosis" required>${options(["Диагноз жоқ / Диагноза нет","ЗРР","ЗПР","ЗПРР","ОНР 1","ОНР 2","ОНР 3","ОНР 4","ОНР 1-4 (нақтылау керек / нужно уточнить)","Басқа / Другое"])}</select></label><label>Язык дома<select name="home_language" required>${options(["Қазақша","Русский","Қазақша және Русский","Басқа / Другое"])}</select></label><label>Словарный запас<select name="meaningful_words" required>${options(["Сөз қолданбайды / Не использует слова","1-10 сөз / 1-10 слов","11-30 сөз / 11-30 слов","31-100 сөз / 31-100 слов","100-ден көп / Более 100"])}</select></label><button type="submit">Создать профиль и доступ</button></form></section>`;
    app.innerHTML = `<main class="center-page"><header class="center-header"><a href="/" class="auth-brand"><span>Q</span><strong>Qadam</strong></a><div><span>${escape(membership.full_name || session.user?.email)}</span>${session.user?.app_metadata?.role === "superadmin" ? `<a href="/account-mode">Выбрать кабинет</a>` : ""}<button type="button" data-logout>Выйти</button></div></header>
      <div class="center-main"><div class="auth-kicker">${admin ? "Администратор центра" : "Кабинет специалиста"}</div><h1>${escape(membership.center_name || "Qadam орталығы")}</h1><p class="center-intro">Группы, ученики и оценки навыков в одном месте.</p>
      ${state.error ? `<p class="auth-error" role="alert">${escape(state.error)}</p>` : ""}${state.passwordChanged ? `<p class="center-success" role="status">Пароль обновлён. Используйте его при следующем входе.</p>` : ""}
      <div class="center-stats"><span><strong>${state.groups.length}</strong> групп</span><span><strong>${state.students.length}</strong> учеников</span><span><strong>${state.staff.length}</strong> сотрудников</span></div>${credentials}${enrollment}
      ${admin ? `<section class="center-card"><h2>Сотрудники и роли</h2><ul class="center-staff">${state.staff.map((item) => `<li><span><strong>${escape(item.full_name)}</strong><small>${escape(item.specialty || "")} · ${item.role === "admin" ? "Администратор" : "Специалист"}</small></span>${item.user_id !== session.user.id ? `<button type="button" data-remove-staff="${item.user_id}">Удалить роль</button>` : ""}</li>`).join("")}</ul><form class="center-form" data-action="set-staff"><label>Email сотрудника<input name="email" type="email" required></label><label>ФИО<input name="full_name" required minlength="2" maxlength="160"></label><label>Специальность<input name="specialty" maxlength="120"></label><label>Роль<select name="role"><option value="specialist">Специалист</option><option value="admin">Администратор</option></select></label><button type="submit">Добавить или изменить роль</button></form><p class="center-muted">Сотрудник сначала должен зарегистрироваться с этим email. Удаление роли не удаляет его аккаунт.</p></section>
      <section class="center-card"><h2>Новая группа</h2><form class="center-form" data-action="create-group"><label>Название группы<input name="name" required maxlength="120"></label><button type="submit">Создать группу</button></form></section>` : ""}
      <h2 class="center-section-title">Группы</h2><div class="center-grid">${state.groups.map(groupCard).join("") || `<p class="center-empty">Групп пока нет.</p>`}</div>${assessmentMarkup()}<details class="center-card center-password"><summary>Сменить пароль своего аккаунта</summary><form class="center-form" data-action="change-password"><label>Новый пароль<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="72" required></label><label>Повторите пароль<input name="confirmation" type="password" autocomplete="new-password" minlength="12" maxlength="72" required></label><button type="button" data-toggle-password aria-pressed="false">Показать пароли</button><button type="submit">Сохранить пароль</button></form></details></div></main>`;
  }

  app.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-logout],[data-assess],[data-close-assessment],[data-remove-staff],[data-dismiss-credentials],[data-toggle-password]");
    if (!target) return;
    if (target.hasAttribute("data-logout")) { await signOut(); location.replace("/login"); return; }
    if (target.hasAttribute("data-dismiss-credentials")) { state.newCredentials = null; paint(); return; }
    if (target.hasAttribute("data-toggle-password")) {
      const visible = target.getAttribute("aria-pressed") === "true";
      target.closest("form").querySelectorAll('input[name="password"],input[name="confirmation"]').forEach((input) => { input.type = visible ? "password" : "text"; });
      target.setAttribute("aria-pressed", String(!visible));
      target.textContent = visible ? "Показать пароли" : "Скрыть пароли";
      return;
    }
    if (target.hasAttribute("data-assess")) { state.selectedChild = target.dataset.assess; paint(); document.querySelector(".center-assessment")?.scrollIntoView({ behavior: "smooth" }); return; }
    if (target.hasAttribute("data-close-assessment")) { state.selectedChild = null; paint(); return; }
    if (target.hasAttribute("data-remove-staff") && admin && confirm("Снять роль сотрудника в этом центре?")) {
      try { await request("rpc/center_remove_staff", { method: "POST", body: JSON.stringify({ p_center_id: centerId, p_user_id: target.dataset.removeStaff }) }); await load(); }
      catch (error) { state.error = error.message; paint(); }
    }
  });

  app.addEventListener("submit", async (event) => {
    const form = event.target.closest("form[data-action]");
    if (!form) return;
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const data = new FormData(form);
    button.disabled = true;
    try {
      switch (form.dataset.action) {
        case "change-password": {
          const password = String(data.get("password") || "");
          if (password.length < 12 || password !== data.get("confirmation")) throw new Error("Пароли не совпадают или короче 12 символов");
          await apiRequest("/auth/v1/user", { method: "PUT", headers: { Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ password }) });
          state.passwordChanged = true;
          break;
        }
        case "enroll": {
          const child = Object.fromEntries(["name", "age", "diagnosis", "home_language", "meaningful_words"].map((key) => [key, data.get(key)]));
          state.newCredentials = await apiRequest("/functions/v1/qadam-center-parent", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: "enroll", center_id: centerId, iin: data.get("iin"), child }) });
          break;
        }
        case "create-group":
          if (!admin) throw new Error("Недостаточно прав");
          await write("center_groups", { center_id: centerId, name: String(data.get("name") || "").trim() }); break;
        case "set-staff":
          if (!admin) throw new Error("Недостаточно прав");
          await request("rpc/center_set_staff", { method: "POST", body: JSON.stringify({ p_center_id: centerId, p_email: data.get("email"), p_role: data.get("role"), p_full_name: data.get("full_name"), p_specialty: data.get("specialty") }) }); break;
        case "assign-specialist":
          if (!admin) throw new Error("Недостаточно прав");
          await write("center_group_specialists", { center_id: centerId, group_id: data.get("group_id"), user_id: data.get("user_id") }); break;
        case "assign-student":
          if (!admin) throw new Error("Недостаточно прав");
          await write("center_group_students", { center_id: centerId, group_id: data.get("group_id"), child_id: data.get("child_id") }); break;
        case "save-assessment": {
          if (!state.selectedChild) throw new Error("Ученик не выбран");
          const answers = Object.fromEntries(assessmentQuestions.map((question) => {
            const value = data.get(question.id);
            if (value === null) throw new Error("Ответьте на все вопросы");
            return [question.id, value === "unknown" ? null : Number(value)];
          }));
          await write("specialist_assessments", { center_id: centerId, child_id: state.selectedChild, specialist_id: session.user.id, specialist_name: membership.full_name, assessment_type: state.assessments.some((item) => item.child_id === state.selectedChild) ? "reassessment" : "initial", answers, skill_levels: calculateSkillLevels(answers, assessmentQuestions) });
          state.selectedChild = null; break;
        }
        default: return;
      }
      state.error = "";
      await load();
    } catch (error) { state.error = error.message || "Не удалось сохранить"; paint(); }
    finally { button.disabled = false; }
  });

  await load();
}
