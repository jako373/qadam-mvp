import { assessmentQuestions } from "./data/assessment-questions.js";
import { diagnosisOptions, homeLanguageOptions, wordOptions } from "./data/app-data.js";
import { exerciseCategories, exerciseCategoryOrder } from "./data/exercise-localization.js";
import { calculateSkillLevels } from "./lib/progress-engine.js";

const escape = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const OTHER_DIAGNOSIS = "Басқа / Другое";
const CENTER_AGE_OPTIONS = Array.from({ length: 17 }, (_, index) => index + 2);
const copy = {
  ru: {
    roleAdmin: "Администратор центра", roleSpecialist: "Кабинет специалиста", greeting: "Рабочее пространство", intro: "Ваши группы, ученики и оценки навыков — в одном месте.", logout: "Выйти", switchMode: "Выбрать кабинет",
    overview: "Обзор", schedule: "Расписание", groups: "Группы", students: "Ученики", team: "Команда", settings: "Настройки", groupsCount: "групп", studentsCount: "учеников", assessmentsCount: "оценок", pendingCount: "ждут оценки",
    sessionTitle: "Календарь занятий", sessionIntro: "Запланируйте встречу и отмечайте посещение в один клик.", noSessions: "На этот день занятий нет.", addSession: "Запланировать занятие", sessionTopic: "Тема занятия", sessionDate: "Дата и время", sessionDuration: "Длительность", minutes: "минут", present: "Был", absent: "Не был", cancelled: "Отменено", planned: "Запланировано", chooseChild: "Выберите ребёнка", previousWeek: "Предыдущая неделя", nextWeek: "Следующая неделя", attendance: "Посещаемость", attendanceSaved: "Посещение отмечено", sessionSaved: "Занятие запланировано", sessionDateInvalid: "Проверьте ребёнка, тему, дату и время занятия", sessionSaveFailed: "Не удалось обновить занятие",
    childPlan: "План ребёнка", planTitle: "Цели и заметки", planIntro: "Цели видны семье. Внутренние заметки — только сотрудникам центра.", goalTitle: "Цели по навыкам", noGoals: "Целей пока нет.", newGoal: "Новая цель", goalSkill: "Навык", goalText: "Что ребёнок освоит", goalLevel: "Целевой уровень", goalDate: "Срок (необязательно)", goalStatusActive: "В работе", goalStatusAchieved: "Достигнуто", goalStatusPaused: "Пауза", markAchieved: "Цель достигнута", pauseGoal: "Поставить на паузу", resumeGoal: "Продолжить", currentLevel: "Сейчас", targetLevel: "Цель", goalSaved: "Цель добавлена", goalUpdated: "Статус цели обновлён", notesTitle: "Заметки и рекомендации", noNotes: "Заметок пока нет.", newNote: "Добавить запись", noteText: "Короткая запись", noteAudience: "Кому показывать", teamOnly: "Только команде", familyVisible: "Рекомендация семье", noteSaved: "Запись добавлена", closePlan: "Закрыть план",
    nextStep: "На что обратить внимание", pendingTitle: "Дети без первой оценки", pendingIntro: "Откройте вопросы, чтобы родитель увидел первые результаты.", allDone: "Все зарегистрированные дети уже получили первую оценку.", recent: "Последние оценки", noRecent: "Оценок пока нет — начните с первого ученика.", openStudents: "К ученикам", assess: "Оценить навыки", latest: "Последняя оценка", noAssessment: "Оценка пока не заполнена",
    groupIntro: "Состав и занятия каждой группы", groupEmpty: "Групп пока нет. Администратор может создать первую.", groupStudents: "учеников", groupSpecialists: "специалистов", noSpecialist: "Специалист пока не назначен", noGroupStudents: "В этой группе пока нет учеников.", addSpecialist: "Добавить специалиста", addStudent: "Добавить ученика", chooseStaff: "Выберите сотрудника", chooseStudent: "Выберите ученика", assign: "Назначить", add: "Добавить",
    studentIntro: "Профили и индивидуальные оценки", noStudents: "Учеников пока нет. Зарегистрируйте первого ребёнка — группа не обязательна.", registerChild: "Зарегистрировать ребёнка", registerHint: "Семья получит отдельный вход по ИИН ребёнка. ИИН не показывается в списках центра.", iin: "ИИН ребёнка", name: "Имя ребёнка", age: "Возраст", diagnosis: "Диагноз или отметка", diagnosisDetails: "Уточните вариант «Другое»", diagnosisHint: "До 160 символов. Укажите формулировку специалиста, без лишних персональных данных.", homeLanguage: "Язык дома", words: "Словарный запас", childGroup: "Группа", createProfile: "Создать профиль и доступ", years: "лет", noDiagnosis: "Не указан",
    credentialsTitle: "Доступ для семьи создан", credentialsHint: "Передайте родителю ИИН и временный пароль лично. Попросите сменить пароль после первого входа. Эти данные не сохраняются в вашем кабинете.", resetHint: "Передайте родителю новый временный пароль лично. Для входа он использует ИИН ребёнка. Старый пароль больше не подходит.", reissuePassword: "Выдать новый пароль", reissueConfirm: "Выдать новый временный пароль? Старый пароль перестанет работать для новых входов.", login: "Логин", temporaryPassword: "Временный пароль", hideCredentials: "Скрыть данные",
    assessmentTitle: "Оценка навыков", assessmentHint: "Ответы специалиста сохраняются отдельно от ответов родителя.", close: "Закрыть вопросы", saveAssessment: "Сохранить оценку", answerAll: "Ответьте на все вопросы", noChild: "Ученик не выбран",
    staffTitle: "Сотрудники и роли", staffIntro: "Администратор назначает роли, не удаляя аккаунт сотрудника.", removeRole: "Удалить роль", removeConfirm: "Снять роль сотрудника в этом центре?", staffEmail: "Email сотрудника", fullName: "ФИО", specialty: "Специальность", role: "Роль", specialist: "Специалист", administrator: "Администратор", setRole: "Добавить или изменить роль", staffHint: "Сотрудник сначала регистрируется с этим email.", newGroup: "Новая группа", groupName: "Название группы", createGroup: "Создать группу",
    settingsIntro: "Ваш аккаунт и безопасность", changePassword: "Сменить пароль", newPassword: "Новый пароль", repeatPassword: "Повторите пароль", showPasswords: "Показать пароли", hidePasswords: "Скрыть пароли", savePassword: "Сохранить пароль", passwordSaved: "Пароль обновлён. Используйте его при следующем входе.", passwordMismatch: "Пароли не совпадают или короче 12 символов", noPermission: "Недостаточно прав", saveFailed: "Не удалось сохранить", otherSpecialist: "Другой специалист",
    individual: "Индивидуально, без группы", removeStudent: "Убрать из моих учеников", removeStudentConfirm: "Убрать ученика из вашего списка? Аккаунт семьи и история занятий сохранятся.", studentRemoved: "Ученик убран из вашего списка", archivedStudents: "Убраны из списка", restoreStudent: "Вернуть ученика", studentRestored: "Ученик возвращён", editSession: "Изменить расписание", cancelEdit: "Отменить изменение", saveSession: "Сохранить изменения", sessionUpdated: "Занятие обновлено", completeSession: "Провести занятие", sessionSummary: "Краткий итог для семьи", complete: "Завершить занятие", sessionCompleted: "Занятие проведено", sessionSummaryHint: "Что делали и что получилось? 3–500 символов.",
  },
  kk: {
    roleAdmin: "Орталық әкімшісі", roleSpecialist: "Маман кабинеті", greeting: "Жұмыс кеңістігі", intro: "Топтар, оқушылар және дағды бағалауы — бір жерде.", logout: "Шығу", switchMode: "Кабинетті таңдау",
    overview: "Шолу", schedule: "Кесте", groups: "Топтар", students: "Оқушылар", team: "Команда", settings: "Баптаулар", groupsCount: "топ", studentsCount: "оқушы", assessmentsCount: "бағалау", pendingCount: "бағалауды күтеді",
    sessionTitle: "Сабақ күнтізбесі", sessionIntro: "Кездесуді жоспарлап, қатысуды бір басумен белгілеңіз.", noSessions: "Бұл күні сабақ жоқ.", addSession: "Сабақты жоспарлау", sessionTopic: "Сабақ тақырыбы", sessionDate: "Күні мен уақыты", sessionDuration: "Ұзақтығы", minutes: "минут", present: "Қатысты", absent: "Қатыспады", cancelled: "Болдырылмады", planned: "Жоспарланған", chooseChild: "Баланы таңдаңыз", previousWeek: "Алдыңғы апта", nextWeek: "Келесі апта", attendance: "Қатысу", attendanceSaved: "Қатысу белгіленді", sessionSaved: "Сабақ жоспарланды", sessionDateInvalid: "Баланы, тақырыпты, сабақтың күні мен уақытын тексеріңіз", sessionSaveFailed: "Сабақты жаңарту мүмкін болмады",
    childPlan: "Бала жоспары", planTitle: "Мақсаттар мен жазбалар", planIntro: "Мақсаттар отбасына көрінеді. Ішкі жазбалар тек орталық қызметкерлеріне арналған.", goalTitle: "Дағды мақсаттары", noGoals: "Әзірге мақсат жоқ.", newGoal: "Жаңа мақсат", goalSkill: "Дағды", goalText: "Бала нені үйренеді", goalLevel: "Мақсат деңгейі", goalDate: "Мерзімі (міндетті емес)", goalStatusActive: "Жұмыста", goalStatusAchieved: "Орындалды", goalStatusPaused: "Үзіліс", markAchieved: "Мақсат орындалды", pauseGoal: "Үзіліске қою", resumeGoal: "Жалғастыру", currentLevel: "Қазір", targetLevel: "Мақсат", goalSaved: "Мақсат қосылды", goalUpdated: "Мақсат мәртебесі жаңартылды", notesTitle: "Жазбалар мен ұсыныстар", noNotes: "Әзірге жазба жоқ.", newNote: "Жазба қосу", noteText: "Қысқа жазба", noteAudience: "Кімге көрсетіледі", teamOnly: "Тек командаға", familyVisible: "Отбасыға ұсыныс", noteSaved: "Жазба қосылды", closePlan: "Жоспарды жабу",
    nextStep: "Неге назар аудару керек", pendingTitle: "Алғашқы бағалауы жоқ балалар", pendingIntro: "Ата-ана нәтижені көруі үшін сұрақтарға жауап беріңіз.", allDone: "Тіркелген балалардың барлығы алғашқы бағалаудан өтті.", recent: "Соңғы бағалаулар", noRecent: "Әзірге бағалау жоқ — алғашқы оқушыдан бастаңыз.", openStudents: "Оқушыларға өту", assess: "Дағдыны бағалау", latest: "Соңғы бағалау", noAssessment: "Әзірге бағаланбаған",
    groupIntro: "Әр топтың құрамы мен жұмысы", groupEmpty: "Әзірге топ жоқ. Әкімші бірінші топты құра алады.", groupStudents: "оқушы", groupSpecialists: "маман", noSpecialist: "Маман әлі тағайындалмаған", noGroupStudents: "Бұл топта әзірге оқушы жоқ.", addSpecialist: "Маман қосу", addStudent: "Оқушы қосу", chooseStaff: "Қызметкерді таңдаңыз", chooseStudent: "Оқушыны таңдаңыз", assign: "Тағайындау", add: "Қосу",
    studentIntro: "Жеке профильдер мен бағалау нәтижелері", noStudents: "Әзірге оқушы жоқ. Бірінші баланы тіркеңіз — топ міндетті емес.", registerChild: "Баланы тіркеу", registerHint: "Отбасы баланың ЖСН-і арқылы жеке кіреді. ЖСН орталық тізімдерінде көрсетілмейді.", iin: "Баланың ЖСН-і", name: "Баланың аты", age: "Жасы", diagnosis: "Диагноз немесе белгі", diagnosisDetails: "«Басқа» нұсқасын нақтылаңыз", diagnosisHint: "160 таңбаға дейін. Артық жеке деректерді жазбаңыз.", homeLanguage: "Үйдегі тіл", words: "Сөздік қоры", childGroup: "Топ", createProfile: "Профиль мен кіру деректерін жасау", years: "жаста", noDiagnosis: "Көрсетілмеген",
    credentialsTitle: "Отбасыға кіру деректері жасалды", credentialsHint: "Ата-анаға баланың ЖСН-і мен уақытша құпиясөзді жеке беріңіз. Алғашқы кіргеннен кейін құпиясөзді өзгертуді сұраңыз. Бұл деректер кабинетіңізде сақталмайды.", resetHint: "Жаңа уақытша құпиясөзді ата-анаға жеке беріңіз. Кіру үшін баланың ЖСН-ін қолданады. Ескі құпиясөз жарамсыз болады.", reissuePassword: "Жаңа құпиясөз беру", reissueConfirm: "Жаңа уақытша құпиясөз бересіз бе? Ескі құпиясөзбен қайта кіру мүмкін болмайды.", login: "Логин", temporaryPassword: "Уақытша құпиясөз", hideCredentials: "Деректерді жасыру",
    assessmentTitle: "Дағдыларды бағалау", assessmentHint: "Маманның жауаптары ата-ананың жауаптарынан бөлек сақталады.", close: "Сұрақтарды жабу", saveAssessment: "Бағалауды сақтау", answerAll: "Барлық сұраққа жауап беріңіз", noChild: "Оқушы таңдалмаған",
    staffTitle: "Қызметкерлер және рөлдер", staffIntro: "Әкімші қызметкердің аккаунтын жоймай, рөлін басқарады.", removeRole: "Рөлді алып тастау", removeConfirm: "Осы орталықтағы қызметкердің рөлін алып тастайсыз ба?", staffEmail: "Қызметкердің email-ы", fullName: "Аты-жөні", specialty: "Мамандығы", role: "Рөлі", specialist: "Маман", administrator: "Әкімші", setRole: "Рөлді қосу немесе өзгерту", staffHint: "Қызметкер алдымен осы email-мен тіркелуі керек.", newGroup: "Жаңа топ", groupName: "Топ атауы", createGroup: "Топ құру",
    settingsIntro: "Аккаунтыңыз және қауіпсіздік", changePassword: "Құпиясөзді өзгерту", newPassword: "Жаңа құпиясөз", repeatPassword: "Құпиясөзді қайталаңыз", showPasswords: "Құпиясөздерді көрсету", hidePasswords: "Құпиясөздерді жасыру", savePassword: "Құпиясөзді сақтау", passwordSaved: "Құпиясөз жаңартылды. Келесі кіргенде жаңа құпиясөзді қолданыңыз.", passwordMismatch: "Құпиясөздер сәйкес келмейді немесе 12 таңбадан қысқа", noPermission: "Құқық жеткіліксіз", saveFailed: "Сақтау мүмкін болмады", otherSpecialist: "Басқа маман",
    individual: "Жеке, топсыз", removeStudent: "Оқушыны өз тізімімнен алып тастау", removeStudentConfirm: "Оқушыны тізіміңізден алып тастайсыз ба? Отбасы аккаунты мен сабақ тарихы сақталады.", studentRemoved: "Оқушы тізімнен алынды", archivedStudents: "Тізімнен алынғандар", restoreStudent: "Оқушыны қайтару", studentRestored: "Оқушы қайтарылды", editSession: "Кестені өзгерту", cancelEdit: "Өзгертуді тоқтату", saveSession: "Өзгерістерді сақтау", sessionUpdated: "Сабақ жаңартылды", completeSession: "Сабақты өткізу", sessionSummary: "Отбасыға қысқаша нәтиже", complete: "Сабақты аяқтау", sessionCompleted: "Сабақ өткізілді", sessionSummaryHint: "Не істедіңіздер және не орындалды? 3–500 таңба.",
  },
};

export async function renderCenterDashboard({ app, session, membership, dataRequest, apiRequest, signOut }) {
  const centerId = membership.center_id;
  const admin = membership.role === "admin";
  const state = { language: localStorage.getItem("qadam.center.language") === "kk" ? "kk" : "ru", view: "overview", groups: [], staff: [], students: [], assignments: [], groupStudents: [], groupSpecialists: [], assessments: [], sessions: [], goals: [], notes: [], selectedChild: null, selectedPlanChild: null, selectedDay: new Date(), editingSession: null, completingSession: null, error: "", notice: "", newCredentials: null, passwordChanged: false };
  const t = () => copy[state.language];
  const date = (value) => new Date(value).toLocaleDateString(state.language === "ru" ? "ru-RU" : "kk-KZ");
  const request = (path, options) => dataRequest(path, session, options);
  const write = (table, row) => request(table, { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify(row) });

  async function load() {
    const query = `center_id=eq.${encodeURIComponent(centerId)}`;
    const [groups, staff, students, assignments, groupStudents, groupSpecialists, assessments, sessions, goals, notes] = await Promise.all([
      request(`center_groups?select=id,name,center_id&${query}&order=created_at.asc`),
      request(`center_staff?select=user_id,role,full_name,specialty&${query}&order=created_at.asc`),
      request(`center_students?select=child_id,active&${query}&active=eq.true`),
      request(`center_specialist_students?select=child_id,specialist_id,child_name,active&${query}${admin ? "" : `&specialist_id=eq.${session.user.id}`}`),
      request(`center_group_students?select=group_id,child_id&${query}`),
      request(`center_group_specialists?select=group_id,user_id&${query}`),
      request(`specialist_assessments?select=child_id,completed_at,skill_levels,specialist_name&${query}&order=completed_at.desc&limit=1000`),
      request(`center_sessions?select=id,child_id,specialist_id,starts_at,duration_minutes,topic,status,session_summary,completed_at&${query}&order=starts_at.asc&limit=1000`),
      request(`center_skill_goals?select=id,child_id,created_by,skill_key,summary,target_level,target_date,status,created_at&${query}&order=created_at.desc&limit=1000`),
      request(`center_child_notes?select=id,child_id,audience,content,created_at&${query}&order=created_at.desc&limit=1000`),
    ]);
    Object.assign(state, { groups, staff, assignments, groupStudents, groupSpecialists, assessments, sessions, goals, notes });
    const childIds = students.map((item) => item.child_id);
    state.students = childIds.length ? await request(`children?select=id,name,age,diagnosis,diagnosis_details&id=in.(${childIds.join(",")})`) : [];
    paint();
  }

  function latestAssessment(childId) { return state.assessments.find((item) => item.child_id === childId); }
  function memberName(userId) { return state.staff.find((item) => item.user_id === userId)?.full_name || t().otherSpecialist; }
  function options(values) { return values.map((value) => `<option value="${escape(value)}">${escape(value)}</option>`).join(""); }
  function navButton(view, label) { return `<button type="button" data-view="${view}" class="center-nav-button${state.view === view ? " is-active" : ""}" aria-pressed="${state.view === view}"><span class="center-nav-mark" aria-hidden="true"></span>${label}</button>`; }
  function childRow(child) {
    const last = latestAssessment(child.id);
    const ownIndividual = !admin && state.assignments.some((item) => item.child_id === child.id && item.specialist_id === session.user.id && item.active);
    const sharedGroup = state.groupStudents.some((item) => item.child_id === child.id);
    return `<li><div class="center-student-avatar" aria-hidden="true">${escape(child.name[0] || "•")}</div><span class="center-child-info"><strong>${escape(child.name)}</strong><small>${child.age} ${t().years} · ${escape(child.diagnosis_details || child.diagnosis || t().noDiagnosis)}</small><small>${last ? `${t().latest}: ${date(last.completed_at)}` : t().noAssessment}</small></span><span class="center-child-actions"><button type="button" data-plan="${child.id}">${t().childPlan}</button><button type="button" data-assess="${child.id}">${t().assess}</button>${admin || ownIndividual ? `<button type="button" data-reissue-password="${child.id}">${t().reissuePassword}</button>` : ""}${ownIndividual && !sharedGroup ? `<button type="button" data-remove-student="${child.id}">${t().removeStudent}</button>` : ""}</span></li>`;
  }
  function groupCard(group) {
    const specialists = state.groupSpecialists.filter((item) => item.group_id === group.id);
    const students = state.groupStudents.filter((item) => item.group_id === group.id).map((item) => state.students.find((child) => child.id === item.child_id)).filter(Boolean);
    return `<section class="center-card center-group-card"><div class="center-card-head"><div><h3>${escape(group.name)}</h3><p>${students.length} ${t().groupStudents} · ${specialists.length} ${t().groupSpecialists}</p></div><span class="center-card-orb" aria-hidden="true"></span></div><p class="center-muted">${specialists.map((item) => escape(memberName(item.user_id))).join(", ") || t().noSpecialist}</p>${students.length ? `<ul class="center-children">${students.map(childRow).join("")}</ul>` : `<p class="center-empty">${t().noGroupStudents}</p>`}${admin ? `<div class="center-assign"><form data-action="assign-specialist"><input type="hidden" name="group_id" value="${group.id}"><label>${t().addSpecialist}<select name="user_id" required><option value="">${t().chooseStaff}</option>${state.staff.filter((item) => item.role === "specialist" && !specialists.some((assigned) => assigned.user_id === item.user_id)).map((item) => `<option value="${item.user_id}">${escape(item.full_name)}</option>`).join("")}</select></label><button type="submit">${t().assign}</button></form><form data-action="assign-student"><input type="hidden" name="group_id" value="${group.id}"><label>${t().addStudent}<select name="child_id" required><option value="">${t().chooseStudent}</option>${state.students.filter((item) => !students.some((assigned) => assigned.id === item.id)).map((item) => `<option value="${item.id}">${escape(item.name)}</option>`).join("")}</select></label><button type="submit">${t().add}</button></form></div>` : ""}</section>`;
  }
  function overview() {
    const pending = state.students.filter((child) => !latestAssessment(child.id));
    return `<div class="center-overview-grid"><section class="center-card center-focus-card"><div class="center-card-kicker">${t().nextStep}</div><h2>${t().pendingTitle}</h2><p>${t().pendingIntro}</p>${pending.length ? `<ul class="center-children">${pending.slice(0, 4).map(childRow).join("")}</ul>` : `<p class="center-empty">${t().allDone}</p>`}<button type="button" class="center-plain-action" data-view="students">${t().openStudents} →</button></section><section class="center-card center-recent-card"><div class="center-card-kicker">${t().recent}</div><h2>${t().recent}</h2>${state.assessments.length ? `<ul class="center-recent-list">${state.assessments.slice(0, 5).map((item) => `<li><span>${escape(state.students.find((child) => child.id === item.child_id)?.name || "—")}</span><time datetime="${escape(item.completed_at)}">${date(item.completed_at)}</time></li>`).join("")}</ul>` : `<p class="center-empty">${t().noRecent}</p>`}</section></div>`;
  }
  function dayKey(value) {
    const day = new Date(value);
    return `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
  }
  function weekDays() {
    const monday = new Date(state.selectedDay);
    monday.setHours(12, 0, 0, 0);
    monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    return Array.from({ length: 7 }, (_, offset) => { const day = new Date(monday); day.setDate(monday.getDate() + offset); return day; });
  }
  function sessionStatus(status) { return ({ planned: t().planned, present: t().present, absent: t().absent, cancelled: t().cancelled })[status] || t().planned; }
  function scheduleView() {
    const locale = state.language === "ru" ? "ru-RU" : "kk-KZ";
    const selected = dayKey(state.selectedDay);
    const daily = state.sessions.filter((item) => dayKey(item.starts_at) === selected);
    const week = weekDays();
    const editing = state.sessions.find((item) => item.id === state.editingSession);
    const localTime = (value) => {
      const day = new Date(value);
      const pad = (part) => String(part).padStart(2, "0");
      return `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}T${pad(day.getHours())}:${pad(day.getMinutes())}`;
    };
    const cards = daily.length ? `<ul class="center-session-list">${daily.map((item) => {
      const child = state.students.find((candidate) => candidate.id === item.child_id);
      const canEdit = admin || item.specialist_id === session.user.id;
      return `<li><div class="center-session-time">${new Date(item.starts_at).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" })}</div><div class="center-session-info"><strong>${escape(child?.name || "—")}</strong><span>${escape(item.topic)} · ${item.duration_minutes} ${t().minutes}</span><small>${sessionStatus(item.status)}</small>${item.session_summary ? `<p>${escape(item.session_summary)}</p>` : ""}</div>${canEdit ? `<div class="center-attendance" aria-label="${t().attendance}"><button type="button" data-edit-session="${item.id}">${t().editSession}</button><button type="button" data-complete-session="${item.id}">${t().completeSession}</button>${["absent", "cancelled"].map((status) => `<button type="button" data-session-id="${item.id}" data-session-status="${status}" aria-pressed="${item.status === status}">${sessionStatus(status)}</button>`).join("")}</div>` : ""}${state.completingSession === item.id ? `<form class="center-complete-form" data-action="complete-session"><input type="hidden" name="session_id" value="${item.id}"><label>${t().sessionSummary}<textarea name="session_summary" minlength="3" maxlength="500" required>${escape(item.session_summary || "")}</textarea><small>${t().sessionSummaryHint}</small></label><button type="submit">${t().complete}</button></form>` : ""}</li>`;
    }).join("")}</ul>` : `<p class="center-empty">${t().noSessions}</p>`;
    const form = state.students.length ? `<section class="center-card center-schedule-form"><h2>${editing ? t().editSession : t().addSession}</h2><form class="center-form" data-action="save-session">${editing ? `<input type="hidden" name="session_id" value="${editing.id}">` : ""}<label>${t().chooseChild}<select name="child_id" required ${editing ? "disabled" : ""}><option value="">${t().chooseChild}</option>${state.students.map((child) => `<option value="${child.id}" ${editing?.child_id === child.id ? "selected" : ""}>${escape(child.name)}</option>`).join("")}</select></label><label>${t().sessionTopic}<input name="topic" minlength="2" maxlength="120" value="${escape(editing?.topic || "")}" required></label><label>${t().sessionDate}<input name="starts_at" type="datetime-local" value="${editing ? localTime(editing.starts_at) : ""}" required></label><label>${t().sessionDuration}<select name="duration_minutes">${[30, 45, 60, 90].map((minutes) => `<option value="${minutes}" ${minutes === (editing?.duration_minutes || 45) ? "selected" : ""}>${minutes} ${t().minutes}</option>`).join("")}</select></label><button type="submit">${editing ? t().saveSession : t().addSession}</button>${editing ? `<button type="button" data-cancel-edit>${t().cancelEdit}</button>` : ""}</form></section>` : "";
    return `<section class="center-card center-calendar"><div class="center-card-head"><div><div class="center-card-kicker">${t().schedule}</div><h2>${t().sessionTitle}</h2><p class="center-muted">${t().sessionIntro}</p></div><div class="center-week-actions"><button type="button" data-week="-7" aria-label="${t().previousWeek}">←</button><button type="button" data-week="7" aria-label="${t().nextWeek}">→</button></div></div><div class="center-week">${week.map((day) => { const key = dayKey(day); const count = state.sessions.filter((item) => dayKey(item.starts_at) === key).length; return `<button type="button" data-day="${key}" aria-pressed="${key === selected}" class="${key === selected ? "is-active" : ""}"><small>${day.toLocaleDateString(locale, { weekday: "short" })}</small><strong>${day.getDate()}</strong><span>${count || ""}</span></button>`; }).join("")}</div><h3>${state.selectedDay.toLocaleDateString(locale, { day: "numeric", month: "long", weekday: "long" })}</h3>${cards}</section>${form}`;
  }
  function planMarkup() {
    const child = state.students.find((item) => item.id === state.selectedPlanChild);
    if (!child) return "";
    const goals = state.goals.filter((item) => item.child_id === child.id);
    const notes = state.notes.filter((item) => item.child_id === child.id);
    const levels = latestAssessment(child.id)?.skill_levels || {};
    const skillOptions = exerciseCategoryOrder.map((key) => `<option value="${key}">${escape(exerciseCategories[key][state.language].title)}</option>`).join("");
    return `<section class="center-card center-plan" aria-labelledby="center-plan-title"><div class="center-card-head"><div><div class="center-card-kicker">${t().childPlan}</div><h2 id="center-plan-title">${escape(child.name)} · ${t().planTitle}</h2><p class="center-muted">${t().planIntro}</p></div><button type="button" class="center-close-plan" data-close-plan aria-label="${t().closePlan}">×</button></div><div class="center-plan-grid"><div><h3>${t().goalTitle}</h3>${goals.length ? `<ul class="center-goal-list">${goals.map((goal) => { const current = Number(levels[goal.skill_key]); const editable = admin || goal.created_by === session.user.id; return `<li><strong>${escape(exerciseCategories[goal.skill_key]?.[state.language]?.title || goal.skill_key)}</strong><span class="center-goal-status">${({ active: t().goalStatusActive, achieved: t().goalStatusAchieved, paused: t().goalStatusPaused })[goal.status]}</span><p>${escape(goal.summary)}</p><small>${Number.isInteger(current) && current >= 1 && current <= 3 ? `${t().currentLevel} ${current}/3 · ` : ""}${t().targetLevel} ${goal.target_level}/3${goal.target_date ? ` · ${date(`${goal.target_date}T12:00:00`)}` : ""}</small>${editable && goal.status !== "achieved" ? `<div class="center-goal-actions">${goal.status === "active" ? `<button type="button" data-goal-id="${goal.id}" data-goal-status="achieved">${t().markAchieved}</button><button type="button" data-goal-id="${goal.id}" data-goal-status="paused">${t().pauseGoal}</button>` : `<button type="button" data-goal-id="${goal.id}" data-goal-status="active">${t().resumeGoal}</button>`}</div>` : ""}</li>`; }).join("")}</ul>` : `<p class="center-empty">${t().noGoals}</p>`}<form class="center-form center-plan-form" data-action="add-goal"><label>${t().goalSkill}<select name="skill_key" required>${skillOptions}</select></label><label>${t().goalText}<input name="summary" minlength="5" maxlength="180" required></label><label>${t().goalLevel}<select name="target_level"><option value="1">1/3</option><option value="2">2/3</option><option value="3">3/3</option></select></label><label>${t().goalDate}<input name="target_date" type="date"></label><button type="submit">${t().newGoal}</button></form></div><div><h3>${t().notesTitle}</h3>${notes.length ? `<ul class="center-note-list">${notes.map((note) => `<li><span class="center-note-audience ${note.audience === "family" ? "is-family" : ""}">${note.audience === "family" ? t().familyVisible : t().teamOnly}</span><time datetime="${escape(note.created_at)}">${date(note.created_at)}</time><p>${escape(note.content)}</p></li>`).join("")}</ul>` : `<p class="center-empty">${t().noNotes}</p>`}<form class="center-form center-plan-form" data-action="add-note"><label>${t().noteText}<textarea name="content" minlength="3" maxlength="500" required></textarea></label><label>${t().noteAudience}<select name="audience"><option value="team">${t().teamOnly}</option><option value="family">${t().familyVisible}</option></select></label><button type="submit">${t().newNote}</button></form></div></div></section>`;
  }
  function enrollment() {
    const selectedGroups = state.groups;
    return `<section class="center-card center-enroll-card"><div class="center-card-kicker">${t().registerChild}</div><h2>${t().registerChild}</h2><p class="center-muted">${t().registerHint}</p><form class="center-form center-enroll" data-action="enroll"><label>${t().iin}<input name="iin" inputmode="numeric" pattern="[0-9]{12}" minlength="12" maxlength="12" autocomplete="off" required></label><label>${t().name}<input name="name" minlength="1" maxlength="80" required></label><label>${t().age}<select name="age" required>${options(CENTER_AGE_OPTIONS)}</select></label><label>${t().diagnosis}<select name="diagnosis" required>${options(diagnosisOptions)}</select></label><label class="center-diagnosis-details" data-diagnosis-details hidden>${t().diagnosisDetails}<input name="diagnosis_details" maxlength="160" aria-describedby="center-diagnosis-hint"><small id="center-diagnosis-hint">${t().diagnosisHint}</small></label><label>${t().homeLanguage}<select name="home_language" required>${options(homeLanguageOptions)}</select></label><label>${t().words}<select name="meaningful_words" required>${options(wordOptions)}</select></label><label>${t().childGroup}<select name="group_id"><option value="">${t().individual}</option>${selectedGroups.map((group) => `<option value="${group.id}">${escape(group.name)}</option>`).join("")}</select></label><button type="submit">${t().createProfile}</button></form></section>`;
  }
  function assessmentMarkup() {
    const child = state.students.find((item) => item.id === state.selectedChild);
    if (!child) return "";
    return `<section class="center-card center-assessment" aria-labelledby="assessment-title"><div class="center-card-head"><div><div class="center-card-kicker">${t().assessmentTitle}</div><h2 id="assessment-title">${escape(child.name)}</h2><p>${t().assessmentHint}</p></div><button type="button" data-close-assessment aria-label="${t().close}">×</button></div><form data-action="save-assessment">${assessmentQuestions.map((question, index) => `<fieldset><legend>${index + 1}. ${escape(question[state.language])}</legend>${question.answers.map((answer) => `<label><input type="radio" name="${escape(question.id)}" value="${answer.value === null ? "unknown" : answer.value}" required><span>${escape(answer[state.language])}</span></label>`).join("")}</fieldset>`).join("")}<button class="auth-primary" type="submit">${t().saveAssessment}</button></form></section>`;
  }
  function studentsView() {
    const credentials = state.newCredentials ? `<section class="center-card center-credentials" role="status"><h2>${t().credentialsTitle}</h2><p>${state.newCredentials.reset ? t().resetHint : t().credentialsHint}</p>${state.newCredentials.parent_login ? `<p><strong>${t().login}:</strong> <code>${escape(state.newCredentials.parent_login)}</code></p>` : ""}<p><strong>${t().temporaryPassword}:</strong> <code>${escape(state.newCredentials.temporary_password)}</code></p><p><a href="/login" target="_blank" rel="noopener">${state.language === "ru" ? "Открыть страницу входа" : "Кіру бетін ашу"}</a></p><button type="button" data-dismiss-credentials>${t().hideCredentials}</button></section>` : "";
    const archived = state.assignments.filter((item) => item.specialist_id === session.user.id && !item.active);
    return `${credentials}<section class="center-card center-students-card"><div class="center-card-kicker">${t().students}</div><h2>${t().students}</h2><p class="center-muted">${t().studentIntro}</p>${state.students.length ? `<ul class="center-children">${state.students.map(childRow).join("")}</ul>` : `<p class="center-empty">${t().noStudents}</p>`}</section>${assessmentMarkup()}${planMarkup()}${enrollment()}${archived.length ? `<section class="center-card"><h2>${t().archivedStudents}</h2><ul class="center-children">${archived.map((item) => `<li><strong>${escape(item.child_name)}</strong><button type="button" data-restore-student="${item.child_id}">${t().restoreStudent}</button></li>`).join("")}</ul></section>` : ""}`;
  }
  function teamView() {
    if (!admin) return "";
    return `<section class="center-card"><div class="center-card-kicker">${t().team}</div><h2>${t().staffTitle}</h2><p class="center-muted">${t().staffIntro}</p><ul class="center-staff">${state.staff.map((item) => `<li><span><strong>${escape(item.full_name)}</strong><small>${escape(item.specialty || "")} · ${item.role === "admin" ? t().administrator : t().specialist}</small></span>${item.user_id !== session.user.id ? `<button type="button" data-remove-staff="${item.user_id}">${t().removeRole}</button>` : ""}</li>`).join("")}</ul><form class="center-form" data-action="set-staff"><label>${t().staffEmail}<input name="email" type="email" required></label><label>${t().fullName}<input name="full_name" required minlength="2" maxlength="160"></label><label>${t().specialty}<input name="specialty" maxlength="120"></label><label>${t().role}<select name="role"><option value="specialist">${t().specialist}</option><option value="admin">${t().administrator}</option></select></label><button type="submit">${t().setRole}</button></form><p class="center-muted">${t().staffHint}</p></section><section class="center-card"><h2>${t().newGroup}</h2><form class="center-form" data-action="create-group"><label>${t().groupName}<input name="name" required maxlength="120"></label><button type="submit">${t().createGroup}</button></form></section>`;
  }
  function settingsView() {
    return `<section class="center-card center-settings-card"><div class="center-card-kicker">${t().settings}</div><h2>${t().changePassword}</h2><p class="center-muted">${t().settingsIntro}</p><form class="center-form" data-action="change-password"><label>${t().newPassword}<input name="password" type="password" autocomplete="new-password" minlength="12" maxlength="72" required></label><label>${t().repeatPassword}<input name="confirmation" type="password" autocomplete="new-password" minlength="12" maxlength="72" required></label><button type="button" data-toggle-password aria-pressed="false">${t().showPasswords}</button><button type="submit">${t().savePassword}</button></form></section>`;
  }
  function paint() {
    document.documentElement.lang = state.language;
    const nav = [["overview", t().overview], ["schedule", t().schedule], ["groups", t().groups], ["students", t().students], ...(admin ? [["team", t().team]] : []), ["settings", t().settings]];
    const panel = state.view === "schedule" ? scheduleView() : state.view === "groups" ? `<div class="center-section-head"><h2>${t().groups}</h2><p>${t().groupIntro}</p></div><div class="center-grid">${state.groups.map(groupCard).join("") || `<p class="center-empty">${t().groupEmpty}</p>`}</div>` : state.view === "students" ? studentsView() : state.view === "team" ? teamView() : state.view === "settings" ? settingsView() : overview();
    const pending = state.students.filter((child) => !latestAssessment(child.id)).length;
    app.innerHTML = `<main class="center-page"><a class="center-skip" href="#center-content">${t().overview}</a><header class="center-header"><a href="/" class="auth-brand"><span>Q</span><strong>Qadam</strong></a><div class="center-header-actions"><span class="center-account-name">${escape(membership.full_name || session.user?.email)}</span>${session.user?.app_metadata?.role === "superadmin" ? `<a href="/account-mode">${t().switchMode}</a>` : ""}<div class="center-languages" aria-label="Тіл / Язык"><button type="button" data-language="kk" aria-pressed="${state.language === "kk"}" class="${state.language === "kk" ? "is-active" : ""}">Қазақша</button><button type="button" data-language="ru" aria-pressed="${state.language === "ru"}" class="${state.language === "ru" ? "is-active" : ""}">Русский</button></div><button type="button" data-logout>${t().logout}</button></div></header><div class="center-main" id="center-content"><section class="center-hero"><div><div class="center-hero-kicker">${t().greeting} · ${admin ? t().roleAdmin : t().roleSpecialist}</div><h1>${escape(membership.center_name || "Qadam орталығы")}</h1><p>${t().intro}</p></div><div class="center-hero-shapes" aria-hidden="true"><i></i><i></i><i></i></div></section><nav class="center-nav" aria-label="${t().greeting}">${nav.map(([view, label]) => navButton(view, label)).join("")}</nav>${state.error ? `<p class="auth-error" role="alert">${escape(state.error)}</p>` : ""}${state.notice ? `<p class="center-success" role="status">${escape(state.notice)}</p>` : ""}${state.passwordChanged ? `<p class="center-success" role="status">${t().passwordSaved}</p>` : ""}<div class="center-stats"><span><strong>${state.groups.length}</strong>${t().groupsCount}</span><span><strong>${state.students.length}</strong>${t().studentsCount}</span><span><strong>${state.assessments.length}</strong>${t().assessmentsCount}</span><span><strong>${pending}</strong>${t().pendingCount}</span></div><div class="center-panel-content">${panel}</div></div></main>`;
  }

  app.addEventListener("click", async (event) => {
    const target = event.target.closest("[data-view],[data-language],[data-logout],[data-assess],[data-plan],[data-close-plan],[data-close-assessment],[data-remove-staff],[data-remove-student],[data-restore-student],[data-reissue-password],[data-dismiss-credentials],[data-toggle-password],[data-day],[data-week],[data-session-id],[data-edit-session],[data-complete-session],[data-cancel-edit],[data-goal-id]");
    if (!target) return;
    if (target.hasAttribute("data-view")) { state.view = target.dataset.view; state.selectedChild = null; state.selectedPlanChild = null; state.notice = ""; paint(); app.querySelector(`[data-view="${state.view}"]`)?.focus(); return; }
    if (target.hasAttribute("data-language")) { state.language = target.dataset.language; localStorage.setItem("qadam.center.language", state.language); paint(); app.querySelector(`[data-language="${state.language}"]`)?.focus(); return; }
    if (target.hasAttribute("data-logout")) { await signOut(); location.replace("/login"); return; }
    if (target.hasAttribute("data-dismiss-credentials")) { state.newCredentials = null; paint(); return; }
    if (target.hasAttribute("data-reissue-password")) {
      const childId = target.dataset.reissuePassword;
      if (!state.students.some((child) => child.id === childId) || !confirm(t().reissueConfirm)) return;
      target.disabled = true;
      try {
        const result = await apiRequest("/functions/v1/qadam-center-parent", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: "reissue_password", center_id: centerId, child_id: childId }) });
        state.newCredentials = { ...result, reset: true };
        state.error = "";
        state.view = "students";
        paint();
        app.querySelector(".center-credentials")?.scrollIntoView({ behavior: "smooth" });
      } catch (error) { state.error = error.message || t().saveFailed; paint(); }
      return;
    }
    if (target.hasAttribute("data-week")) { state.selectedDay.setDate(state.selectedDay.getDate() + Number(target.dataset.week)); paint(); return; }
    if (target.hasAttribute("data-day")) { state.selectedDay = new Date(`${target.dataset.day}T12:00:00`); paint(); app.querySelector(`[data-day="${target.dataset.day}"]`)?.focus(); return; }
    if (target.hasAttribute("data-edit-session")) { const item = state.sessions.find((row) => row.id === target.dataset.editSession); if (!item || (!admin && item.specialist_id !== session.user.id)) return; state.editingSession = item.id; state.completingSession = null; paint(); app.querySelector(".center-schedule-form")?.scrollIntoView({ behavior: "smooth" }); return; }
    if (target.hasAttribute("data-complete-session")) { const item = state.sessions.find((row) => row.id === target.dataset.completeSession); if (!item || (!admin && item.specialist_id !== session.user.id)) return; state.completingSession = item.id; paint(); return; }
    if (target.hasAttribute("data-cancel-edit")) { state.editingSession = null; paint(); return; }
    if (target.hasAttribute("data-remove-student") || target.hasAttribute("data-restore-student")) {
      const removing = target.hasAttribute("data-remove-student");
      const childId = target.dataset.removeStudent || target.dataset.restoreStudent;
      const own = state.assignments.find((item) => item.child_id === childId && item.specialist_id === session.user.id);
      if (!own || (removing && (state.groupStudents.some((item) => item.child_id === childId) || !confirm(t().removeStudentConfirm)))) return;
      try { await request(`center_specialist_students?center_id=eq.${centerId}&child_id=eq.${childId}&specialist_id=eq.${session.user.id}`, { method: "PATCH", body: JSON.stringify({ active: !removing }) }); state.notice = removing ? t().studentRemoved : t().studentRestored; await load(); }
      catch (error) { state.error = error.message || t().saveFailed; paint(); }
      return;
    }
    if (target.hasAttribute("data-session-id")) {
      const item = state.sessions.find((row) => row.id === target.dataset.sessionId);
      const status = target.dataset.sessionStatus;
      if (!item || !["present", "absent", "cancelled"].includes(status) || (!admin && item.specialist_id !== session.user.id)) return;
      target.closest(".center-attendance")?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
      try { await request(`center_sessions?id=eq.${item.id}&center_id=eq.${centerId}`, { method: "PATCH", body: JSON.stringify({ status }) }); state.error = ""; state.notice = t().attendanceSaved; await load(); }
      catch (error) { state.error = error.message || t().sessionSaveFailed; paint(); }
      return;
    }
    if (target.hasAttribute("data-goal-id")) {
      const goal = state.goals.find((row) => row.id === target.dataset.goalId);
      const status = target.dataset.goalStatus;
      if (!goal || !["active", "achieved", "paused"].includes(status) || (!admin && goal.created_by !== session.user.id)) return;
      target.closest(".center-goal-actions")?.querySelectorAll("button").forEach((button) => { button.disabled = true; });
      try { await request(`center_skill_goals?id=eq.${goal.id}&center_id=eq.${centerId}`, { method: "PATCH", body: JSON.stringify({ status }) }); state.error = ""; state.notice = t().goalUpdated; await load(); }
      catch (error) { state.error = error.message || t().saveFailed; paint(); }
      return;
    }
    if (target.hasAttribute("data-toggle-password")) { const visible = target.getAttribute("aria-pressed") === "true"; target.closest("form").querySelectorAll('input[name="password"],input[name="confirmation"]').forEach((input) => { input.type = visible ? "password" : "text"; }); target.setAttribute("aria-pressed", String(!visible)); target.textContent = visible ? t().showPasswords : t().hidePasswords; return; }
    if (target.hasAttribute("data-assess")) { state.view = "students"; state.selectedPlanChild = null; state.selectedChild = target.dataset.assess; paint(); app.querySelector(".center-assessment")?.scrollIntoView({ behavior: "smooth" }); return; }
    if (target.hasAttribute("data-plan")) { state.view = "students"; state.selectedChild = null; state.selectedPlanChild = target.dataset.plan; paint(); app.querySelector(".center-plan")?.scrollIntoView({ behavior: "smooth" }); return; }
    if (target.hasAttribute("data-close-plan")) { state.selectedPlanChild = null; paint(); return; }
    if (target.hasAttribute("data-close-assessment")) { state.selectedChild = null; paint(); return; }
    if (target.hasAttribute("data-remove-staff") && admin && confirm(t().removeConfirm)) { try { await request("rpc/center_remove_staff", { method: "POST", body: JSON.stringify({ p_center_id: centerId, p_user_id: target.dataset.removeStaff }) }); await load(); } catch (error) { state.error = error.message; paint(); } }
  });
  app.addEventListener("change", (event) => {
    if (event.target.name !== "diagnosis") return;
    const details = event.target.form.querySelector("[data-diagnosis-details]");
    const other = event.target.value === OTHER_DIAGNOSIS;
    details.hidden = !other;
    details.querySelector("input").required = other;
    if (!other) details.querySelector("input").value = "";
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
        case "change-password": { const password = String(data.get("password") || ""); if (password.length < 12 || password !== data.get("confirmation")) throw new Error(t().passwordMismatch); await apiRequest("/auth/v1/user", { method: "PUT", headers: { Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ password }) }); state.passwordChanged = true; break; }
        case "enroll": { const child = Object.fromEntries(["name", "age", "diagnosis", "diagnosis_details", "home_language", "meaningful_words"].map((key) => [key, data.get(key)])); state.newCredentials = await apiRequest("/functions/v1/qadam-center-parent", { method: "POST", headers: { Authorization: `Bearer ${session.access_token}` }, body: JSON.stringify({ action: "enroll", center_id: centerId, group_id: data.get("group_id"), iin: data.get("iin"), child }) }); state.view = "students"; break; }
        case "save-session": {
          const existing = state.sessions.find((item) => item.id === state.editingSession && item.id === data.get("session_id"));
          const childId = existing?.child_id || String(data.get("child_id") || "");
          const startsAt = new Date(String(data.get("starts_at") || ""));
          const duration = Number(data.get("duration_minutes"));
          const topic = String(data.get("topic") || "").trim();
          if (!state.students.some((child) => child.id === childId) || !Number.isFinite(startsAt.getTime()) || ![30, 45, 60, 90].includes(duration) || topic.length < 2 || topic.length > 120 || (data.get("session_id") && !existing) || (existing && !admin && existing.specialist_id !== session.user.id)) throw new Error(t().sessionDateInvalid);
          const changes = { starts_at: startsAt.toISOString(), duration_minutes: duration, topic };
          if (existing) await request(`center_sessions?id=eq.${existing.id}&center_id=eq.${centerId}`, { method: "PATCH", body: JSON.stringify(changes) });
          else await write("center_sessions", { center_id: centerId, child_id: childId, specialist_id: session.user.id, ...changes });
          state.selectedDay = startsAt; state.editingSession = null; state.notice = existing ? t().sessionUpdated : t().sessionSaved; break;
        }
        case "complete-session": {
          const item = state.sessions.find((row) => row.id === data.get("session_id") && row.id === state.completingSession);
          const summary = String(data.get("session_summary") || "").trim();
          if (!item || (!admin && item.specialist_id !== session.user.id) || summary.length < 3 || summary.length > 500) throw new Error(t().saveFailed);
          await request(`center_sessions?id=eq.${item.id}&center_id=eq.${centerId}`, { method: "PATCH", body: JSON.stringify({ status: "present", session_summary: summary, completed_at: new Date().toISOString() }) });
          state.completingSession = null; state.notice = t().sessionCompleted; break;
        }
        case "add-goal": { const skillKey = String(data.get("skill_key") || ""); const summary = String(data.get("summary") || "").trim(); const targetLevel = Number(data.get("target_level")); const targetDate = String(data.get("target_date") || ""); if (!state.students.some((child) => child.id === state.selectedPlanChild) || !exerciseCategoryOrder.includes(skillKey) || summary.length < 5 || summary.length > 180 || ![1, 2, 3].includes(targetLevel) || (targetDate && !/^\d{4}-\d{2}-\d{2}$/.test(targetDate))) throw new Error(t().saveFailed); await write("center_skill_goals", { center_id: centerId, child_id: state.selectedPlanChild, created_by: session.user.id, skill_key: skillKey, summary, target_level: targetLevel, target_date: targetDate || null }); state.notice = t().goalSaved; break; }
        case "add-note": { const content = String(data.get("content") || "").trim(); const audience = String(data.get("audience") || ""); if (!state.students.some((child) => child.id === state.selectedPlanChild) || content.length < 3 || content.length > 500 || !["team", "family"].includes(audience)) throw new Error(t().saveFailed); await write("center_child_notes", { center_id: centerId, child_id: state.selectedPlanChild, author_id: session.user.id, audience, content }); state.notice = t().noteSaved; break; }
        case "create-group": if (!admin) throw new Error(t().noPermission); await write("center_groups", { center_id: centerId, name: String(data.get("name") || "").trim() }); break;
        case "set-staff": if (!admin) throw new Error(t().noPermission); await request("rpc/center_set_staff", { method: "POST", body: JSON.stringify({ p_center_id: centerId, p_email: data.get("email"), p_role: data.get("role"), p_full_name: data.get("full_name"), p_specialty: data.get("specialty") }) }); break;
        case "assign-specialist": if (!admin) throw new Error(t().noPermission); await write("center_group_specialists", { center_id: centerId, group_id: data.get("group_id"), user_id: data.get("user_id") }); break;
        case "assign-student": if (!admin) throw new Error(t().noPermission); await write("center_group_students", { center_id: centerId, group_id: data.get("group_id"), child_id: data.get("child_id") }); break;
        case "save-assessment": { if (!state.selectedChild) throw new Error(t().noChild); const answers = Object.fromEntries(assessmentQuestions.map((question) => { const value = data.get(question.id); if (value === null) throw new Error(t().answerAll); return [question.id, value === "unknown" ? null : Number(value)]; })); await write("specialist_assessments", { center_id: centerId, child_id: state.selectedChild, specialist_id: session.user.id, specialist_name: membership.full_name, assessment_type: state.assessments.some((item) => item.child_id === state.selectedChild) ? "reassessment" : "initial", answers, skill_levels: calculateSkillLevels(answers, assessmentQuestions) }); state.selectedChild = null; break; }
        default: return;
      }
      state.error = "";
      await load();
    } catch (error) { state.error = error.message || t().saveFailed; paint(); }
    finally { button.disabled = false; }
  });
  await load();
}
