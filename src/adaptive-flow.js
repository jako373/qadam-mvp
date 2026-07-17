import { adaptiveUi } from "./data/adaptive-ui.js";
import {
  assessmentQuestions,
  reassessmentQuestions,
} from "./data/assessment-questions.js";
import { exerciseCategories, exerciseCategoryOrder } from "./data/exercise-localization.js";
import { exercises, getExerciseById } from "./data/exercises.js";
import { shiftDateKey, todayKey } from "./lib/adaptive-state.js";
import {
  calculateSkillLevels,
  completeInitialAssessment,
  completionStreak,
  isReassessmentDue,
  markDayCompleted,
  outcomeMessage,
  recordExerciseOutcome,
  skillStatus,
  weeklySummary,
} from "./lib/progress-engine.js";
import {
  adaptNextPlanItem,
  ensureDailyPlan,
  planDuration,
} from "./lib/recommendation-engine.js";
import {
  SUBSCRIPTION_PLANS,
  firstPlanEntry,
  formatKzt,
  freeExerciseIds,
  freemiumRouteRedirect,
  hasFullAccess,
} from "./lib/access-control.js";

const libraryFilter = {
  category: "",
  level: "all",
  search: "",
  favoritesOnly: false,
};

const detailUi = {
  kk: {
    goal: "Мақсаты",
    success: "Қай кезде орындалды деп есептейміз?",
    easier: "Қиын болса",
    harder: "Оңай болса",
    parentTip: "Ата-анаға ескерту",
    preparation: "Дайындық",
    parentWords: "Ата-ананың сөзі",
    repeatPlan: "Үйде қайталау",
    benefit: "Пайдасы",
    stopRule: "Қауіпсіз тоқтау белгісі",
    duration: "Ұзақтығы",
    open: "Ашу",
    close: "Жаттығуларға қайту",
    diagnosisNote: "Диагноз профильде сақталады, бірақ жаттығулар баланың нақты жауабына қарай таңдалады.",
    noData: "Көрсетілмеген",
    levelsReady: "Алғашқы деңгейлер анықталды",
    allDirections: "Барлық бағыт",
    planReason: "Үш қадам баланың әлсіз, қарым-қатынас және сенімді дағдыларын тең қамтиды.",
    completed: "Аяқталды",
    currentLevel: "Қазіргі деңгей",
  },
  ru: {
    goal: "Цель",
    success: "Когда считать упражнение выполненным?",
    easier: "Если сложно",
    harder: "Если легко",
    parentTip: "Подсказка родителю",
    preparation: "Подготовка",
    parentWords: "Слова родителя",
    repeatPlan: "Повторение дома",
    benefit: "Польза",
    stopRule: "Когда безопасно остановиться",
    duration: "Длительность",
    open: "Открыть",
    close: "Вернуться к упражнениям",
    diagnosisNote: "Диагноз сохраняется в профиле, но упражнения выбираются по фактическим ответам ребёнка.",
    noData: "Не указано",
    levelsReady: "Начальные уровни определены",
    allDirections: "Все направления",
    planReason: "Три шага охватывают слабый, коммуникативный и уверенный навык ребёнка.",
    completed: "Завершено",
    currentLevel: "Текущий уровень",
  },
};

function labels(language) {
  return { ...adaptiveUi[language], ...detailUi[language] };
}

function categoryCopy(category, language) {
  return exerciseCategories[category]?.[language] || exerciseCategories[category]?.kk;
}

function categoryIconName(category) {
  return {
    joint_attention: "eye",
    understanding: "ear",
    imitation: "copy",
    communication: "message-circle",
    play_thinking: "puzzle",
    fine_motor: "hand",
    regulation: "heart-pulse",
    daily_social: "house",
  }[category] || "circle";
}

function exerciseCopy(exercise, language) {
  return exercise?.[language] || exercise?.kk;
}

function levelLabel(level, language) {
  const ui = labels(language);
  return [ui.levelOne, ui.levelTwo, ui.levelThree][Number(level) - 1] || ui.levelOne;
}

function routeNumber(path) {
  const value = Number(path.split("/").filter(Boolean).pop());
  return Number.isInteger(value) ? value : 0;
}

function hasAnswer(answers, id) {
  return Object.prototype.hasOwnProperty.call(answers, id);
}

function parseAnswer(value) {
  if (value === "unknown") return null;
  const numeric = Number(value);
  return numeric === 0 || numeric === 1 || numeric === 2 ? numeric : undefined;
}

export function planDayNumber(adaptive, date) {
  return adaptive.completedDates.filter((completedDate) => completedDate < date).length + 1;
}

function planDayLabel(adaptive, date, language) {
  const number = planDayNumber(adaptive, date);
  return language === "ru" ? `День ${number}` : `${number}-күн`;
}

function planHeading(childName, adaptive, date, language, completed = false) {
  const number = planDayNumber(adaptive, date);
  if (language === "ru") {
    return completed
      ? `${childName}: день ${number} завершён`
      : `${childName}: день ${number} · 3 упражнения`;
  }
  return completed
    ? `${childName}: ${number}-күн аяқталды`
    : `${childName}: ${number}-күн · 3 жаттығу`;
}

function readyPlanHeading(childName, adaptive, date, language) {
  const number = planDayNumber(adaptive, date);
  return language === "ru"
    ? `${childName}: план на день ${number} готов`
    : `${childName}: ${number}-күн жоспары дайын`;
}

function activePlanDate(state) {
  const today = todayKey();
  const activeDate = state.adaptive.activePlanDate;
  const activePlan = activeDate ? state.adaptive.dailyPlans[activeDate] : null;
  if (activePlan && (!activePlan.completedAt || activeDate >= today)) return activeDate;
  return today;
}

function ensurePlanForDate(state, saveState, date) {
  const result = ensureDailyPlan(state.adaptive, exercises, date);
  if (result.adaptive !== state.adaptive) {
    state.adaptive = result.adaptive;
    saveState(state);
  }
  return { date, plan: result.plan };
}

function ensureTodayPlan(state, saveState, access = { access_tier: "complimentary" }) {
  if (!hasFullAccess(access)) {
    const first = firstPlanEntry(state.adaptive);
    if (first) {
      if (state.adaptive.activePlanDate !== first.date) {
        state.adaptive = { ...state.adaptive, activePlanDate: first.date };
        saveState(state);
      }
      return first;
    }
  }
  const date = activePlanDate(state);
  const result = ensurePlanForDate(state, saveState, date);
  if (state.adaptive.activePlanDate !== date) {
    state.adaptive = { ...state.adaptive, activePlanDate: date };
    saveState(state);
  }
  return result;
}

function ensureTomorrowPlan(state, saveState, date = activePlanDate(state)) {
  return ensurePlanForDate(state, saveState, shiftDateKey(date, 1));
}

function progressHeader(current, total, language) {
  const ui = labels(language);
  return `
    <div class="adaptive-progress" aria-label="${current} ${ui.of} ${total}">
      <span>${current} ${ui.of} ${total}</span>
      <progress max="${total}" value="${current}">${current} ${ui.of} ${total}</progress>
    </div>
  `;
}

function renderAssessmentIntro(context) {
  const { state, pageShell } = context;
  const ui = labels(state.language);
  return pageShell(
    `
      <section class="adaptive-center">
        <span class="adaptive-eyebrow">Qadam</span>
        <h1>${ui.knowChild}</h1>
        <p class="adaptive-lead">${ui.assessmentIntro}</p>
        <div class="adaptive-time-note">${ui.assessmentTime}</div>
        <button class="primary adaptive-primary" data-route="/skill-check/1" type="button">${ui.beginQuestions}</button>
        <p class="adaptive-disclaimer">${ui.noDiagnosis}</p>
      </section>
    `,
    { nav: false },
  );
}

function renderAssessmentQuestion(context, index, recheck = false) {
  const { state, pageShell, escapeHtml, icon } = context;
  const ui = labels(state.language);
  const questions = recheck ? reassessmentQuestions : assessmentQuestions;
  const question = questions[index - 1];
  if (!question) return null;
  const answers = recheck
    ? state.adaptive.reassessment.answers
    : state.adaptive.initialAssessment.answers;
  const selected = hasAnswer(answers, question.id) ? answers[question.id] : undefined;
  const attribute = recheck ? "data-recheck-answer" : "data-skill-answer";

  return pageShell(
    `
      <section class="adaptive-question">
        ${progressHeader(index, questions.length, state.language)}
        <span class="adaptive-eyebrow">${escapeHtml(categoryCopy(question.category, state.language).title)}</span>
        <h1>${escapeHtml(question[state.language])}</h1>
        <div class="answer-stack">
          ${question.answers
            .map((answer) => {
              const value = answer.value === null ? "unknown" : String(answer.value);
              const isSelected = selected === answer.value;
              return `
                <button
                  class="answer-button ${isSelected ? "selected" : ""}"
                  ${attribute}="${escapeHtml(question.id)}:${value}"
                  type="button"
                ><span>${escapeHtml(answer[state.language])}</span>${icon("chevron-right", "answer-icon")}</button>
              `;
            })
            .join("")}
        </div>
        <p class="adaptive-disclaimer">${ui.noDiagnosis}</p>
      </section>
    `,
    { nav: false },
  );
}

function renderPlanReady(context) {
  const { state, pageShell, icon } = context;
  const ui = labels(state.language);
  return pageShell(
    `
      <section class="adaptive-center plan-ready">
        <div class="ready-mark" aria-hidden="true">${icon("check")}</div>
        <span class="adaptive-eyebrow">${ui.levelsReady}</span>
        <h1>${ui.planReady}</h1>
        <p class="adaptive-lead">${ui.planReadyText}</p>
        <button class="primary adaptive-primary" data-route="/today" type="button"><span>${ui.openToday}</span>${icon("arrow-right")}</button>
        <p class="adaptive-disclaimer">${ui.planReason}</p>
      </section>
    `,
    { nav: false },
  );
}

export function nextDailyRoute(plan) {
  if (plan.completedAt) return "/daily-summary";
  const unanswered = plan.items.findIndex((item) => !hasAnswer(plan.results, item.exerciseId));
  if (unanswered === -1) return "/daily-summary";
  const index = unanswered + 1;
  return Number(plan.viewedCount || 0) >= index
    ? `/daily-results/${index}`
    : `/daily/${index}`;
}

export function formatPlanDate(dateKey, language) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  const calendar = language === "ru"
    ? {
        months: ["января", "февраля", "марта", "апреля", "мая", "июня", "июля", "августа", "сентября", "октября", "ноября", "декабря"],
        weekdays: ["воскресенье", "понедельник", "вторник", "среда", "четверг", "пятница", "суббота"],
      }
    : {
        months: ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"],
        weekdays: ["жексенбі", "дүйсенбі", "сейсенбі", "сәрсенбі", "бейсенбі", "жұма", "сенбі"],
      };
  return `${day} ${calendar.months[month - 1]}, ${calendar.weekdays[date.getDay()]}`;
}

function renderTomorrowPreview(context, date, plan) {
  const { state, escapeHtml, icon } = context;
  const ui = labels(state.language);
  const childName = state.childProfile?.name || ui.childProfile;
  const dayLabel = planDayLabel(state.adaptive, date, state.language);
  return `
    <section class="tomorrow-preview" aria-label="${escapeHtml(dayLabel)}">
      <header>
        ${icon("calendar-check-2", "tomorrow-icon")}
        <div>
          <span class="adaptive-eyebrow">${escapeHtml(dayLabel)} · ${escapeHtml(formatPlanDate(date, state.language))}</span>
          <h2>${escapeHtml(readyPlanHeading(childName, state.adaptive, date, state.language))}</h2>
          <p>${ui.tomorrowText}</p>
        </div>
      </header>
      <div class="tomorrow-list">
        ${plan.items.map((item, index) => {
          const exercise = getExerciseById(item.exerciseId);
          return `
            <div>
              <span>${index + 1}</span>
              <p><strong>${escapeHtml(exerciseCopy(exercise, state.language).title)}</strong><small>${escapeHtml(categoryCopy(exercise.category, state.language).title)} · ${ui.basedOnResult}</small></p>
            </div>
          `;
        }).join("")}
      </div>
      <div class="tomorrow-action">
        <button class="primary adaptive-primary" data-open-plan-date="${escapeHtml(date)}" type="button">
          ${icon("book-open")}<span>${ui.open}</span>
        </button>
      </div>
    </section>
  `;
}

function renderJourneyProgress(context, plan) {
  const { state, access = { access_tier: "complimentary" }, escapeHtml, icon } = context;
  const ui = labels(state.language);
  const completed = plan.items.filter((item) => hasAnswer(plan.results || {}, item.exerciseId)).length;
  const current = Math.min(completed, plan.items.length - 1);
  const full = hasFullAccess(access);
  const copy = state.language === "ru"
    ? { title: "Маршрут на сегодня", done: "шагов завершено", current: "Сейчас", next: "Дальше", free: "Первый день бесплатно", open: "Открыть снова" }
    : { title: "Бүгінгі бағыт", done: "қадам аяқталды", current: "Қазір", next: "Келесі", free: "Бірінші күн тегін", open: "Қайта ашу" };
  return `
    <section class="qadam-journey journey-progress-${completed}">
      <header>
        <div><span class="adaptive-eyebrow">${copy.title}</span><strong>${completed}/${plan.items.length} ${copy.done}</strong></div>
        ${full ? "" : `<span class="freemium-badge">${icon("gift")}<span>${copy.free}</span></span>`}
      </header>
      <div class="journey-rail" aria-label="${completed} ${ui.of} ${plan.items.length}"><i></i><b></b></div>
      <div class="journey-steps">
        ${plan.items.map((item, index) => {
          const exercise = getExerciseById(item.exerciseId);
          const isDone = hasAnswer(plan.results || {}, item.exerciseId);
          const isCurrent = !isDone && index === current;
          const route = isDone ? `/library/${item.exerciseId}` : isCurrent ? `/daily/${index + 1}` : "";
          return `
            <button class="journey-step ${isDone ? "completed" : isCurrent ? "current" : "upcoming"}" ${route ? `data-route="${route}"` : "disabled"} type="button">
              <span>${isDone ? icon("check") : index + 1}</span>
              <strong>${escapeHtml(exerciseCopy(exercise, state.language).title)}</strong>
              <small>${isDone ? copy.open : isCurrent ? copy.current : copy.next}</small>
            </button>
          `;
        }).join("")}
      </div>
    </section>
  `;
}

function renderFreeLimitReached(context) {
  const { state, icon } = context;
  const copy = state.language === "ru"
    ? { eyebrow: "Бесплатный день завершён", title: "Первые три шага уже пройдены", text: "Прогресс сохранён. Подписка откроет новые ежедневные планы и всю библиотеку упражнений.", cta: "Посмотреть подписку", later: "Открыть прогресс" }
    : { eyebrow: "Тегін күн аяқталды", title: "Алғашқы үш қадам орындалды", text: "Нәтиже сақталды. Жазылым жаңа күнделікті жоспарлар мен барлық жаттығулар кітапханасын ашады.", cta: "Жазылымды көру", later: "Прогресті ашу" };
  return `
    <section class="free-limit-card">
      <div class="free-limit-icon">${icon("party-popper")}</div>
      <div><span class="adaptive-eyebrow">${copy.eyebrow}</span><h2>${copy.title}</h2><p>${copy.text}</p></div>
      <div class="free-limit-actions"><button class="primary" data-route="/subscription" type="button">${icon("sparkles")}<span>${copy.cta}</span></button><button class="secondary" data-route="/progress" type="button">${copy.later}</button></div>
    </section>
  `;
}

function renderToday(context) {
  const { state, access = { access_tier: "complimentary" }, pageShell, escapeHtml, saveState, icon } = context;
  const ui = labels(state.language);
  const { date, plan } = ensureTodayPlan(state, saveState, access);
  const summary = weeklySummary(state.adaptive);
  const streak = completionStreak(state.adaptive);
  const done = Boolean(plan.completedAt);
  const full = hasFullAccess(access);
  const tomorrow = done && full ? ensureTomorrowPlan(state, saveState, date) : null;
  const childName = state.childProfile?.name || ui.childProfile;
  const dayLabel = planDayLabel(state.adaptive, date, state.language);

  return pageShell(`
    <section class="adaptive-page-head">
      <div>
        <span class="adaptive-eyebrow">${escapeHtml(dayLabel)}</span>
        <h1>${escapeHtml(planHeading(childName, state.adaptive, date, state.language, done))}</h1>
        <p>${done ? ui.doneTodayText : ui.planReason}</p>
      </div>
      <div class="today-streak"><strong>${streak}</strong><span>${ui.streak}</span></div>
    </section>

    ${isReassessmentDue(state.adaptive) ? `
      <section class="recheck-band">
        <div><strong>${ui.reassessment}</strong><p>${ui.reassessmentText}</p></div>
        <button class="secondary" data-route="/recheck/1" type="button">${icon("clipboard-check")}<span>${ui.startReassessment}</span></button>
      </section>
    ` : ""}

    ${renderJourneyProgress(context, plan)}

    <section class="daily-plan-list" aria-label="${ui.todayThree}">
      ${plan.items.map((item, index) => {
        const exercise = getExerciseById(item.exerciseId);
        const copy = exerciseCopy(exercise, state.language);
        const outcome = plan.results[item.exerciseId];
        return `
          <article class="daily-plan-row">
            <span class="daily-number">${index + 1}</span>
            <div>
              <strong>${escapeHtml(copy.title)}</strong>
              <small>${escapeHtml(categoryCopy(exercise.category, state.language).title)}${item.isNew ? ` · ${ui.newExercise}` : ""}</small>
            </div>
            <span class="daily-state">${outcome ? icon("circle-check", "status-icon") : ""}</span>
          </article>
        `;
      }).join("")}
    </section>

    <section class="today-action">
      <div><span>${ui.totalTime}</span><strong>${planDuration(plan, exercises)} ${ui.minutes}</strong></div>
      <button class="primary adaptive-primary" data-route="${done ? "/progress" : nextDailyRoute(plan)}" type="button">
        <span>${done ? ui.openProgress : plan.viewedCount ? ui.continue : ui.start}</span>${icon(done ? "chart-no-axes-column-increasing" : "arrow-right")}
      </button>
    </section>

    ${tomorrow ? renderTomorrowPreview(context, tomorrow.date, tomorrow.plan) : ""}
    ${done && !full ? renderFreeLimitReached(context) : ""}

    <section class="weekly-strip">
      <div><strong>${summary.completed}</strong><span>${ui.completedExercises}</span></div>
      <div><strong>${summary.newSkills}</strong><span>${ui.newSkills}</span></div>
    </section>
  `);
}

function renderDailyExercise(context, index) {
  const { state, access = { access_tier: "complimentary" }, pageShell, escapeHtml, saveState, icon } = context;
  const ui = labels(state.language);
  const { date, plan } = ensureTodayPlan(state, saveState, access);
  const item = plan.items[index - 1];
  const exercise = item ? getExerciseById(item.exerciseId) : null;
  if (!exercise) return null;
  const copy = exerciseCopy(exercise, state.language);
  const category = categoryCopy(exercise.category, state.language);
  const adjustment = item.variant === "easier"
    ? [ui.easier, copy.easierVersion]
    : item.variant === "guided"
      ? [ui.parentTip, copy.parentTip]
      : item.variant === "progress"
        ? [ui.harder, copy.harderVersion]
        : item.variant === "alternative"
          ? [ui.parentTip, copy.parentTip]
          : null;

  return pageShell(
    `
      <section class="daily-exercise">
        ${progressHeader(index, 3, state.language)}
        <header class="lesson-heading">
          <span class="adaptive-eyebrow">${escapeHtml(planDayLabel(state.adaptive, date, state.language))} · ${escapeHtml(category.title)} · ${exercise.durationMinutes} ${ui.minutes}${item.isNew ? ` · ${ui.newExercise}` : ""}</span>
          <h1>${escapeHtml(copy.title)}</h1>
          <p>${escapeHtml(copy.goal)}</p>
        </header>

        ${adjustment ? `
          <section class="plan-adjustment">
            ${icon(item.variant === "easier" ? "corner-down-left" : item.variant === "progress" ? "trending-up" : "hand-heart")}
            <div><span>${escapeHtml(adjustment[0])}</span><strong>${escapeHtml(adjustment[1])}</strong></div>
          </section>
        ` : ""}

        <section class="parent-script">
          ${icon("message-circle", "instruction-icon")}
          <div><span>${ui.sayThis}</span><blockquote>${escapeHtml(copy.parentWords || copy.title)}</blockquote></div>
        </section>

        <section class="lesson-preparation">
          <div>
            ${icon("package-open")}
            <span>${ui.needed}</span>
            <strong>${escapeHtml(copy.materials.join(", ") || ui.noMaterials)}</strong>
          </div>
          <div>
            ${icon("move-horizontal")}
            <span>${ui.prepare}</span>
            <strong>${escapeHtml(copy.preparation || copy.steps[0])}</strong>
          </div>
        </section>

        <section class="three-steps">
          <h2>${ui.howTo}</h2>
          <ol>
            ${copy.steps.map((step) => `<li><span>${escapeHtml(step)}</span></li>`).join("")}
          </ol>
        </section>

        <section class="lesson-detail-grid">
          <article>
            ${icon("repeat-2")}
            <div><strong>${ui.repeatPlan}</strong><p>${escapeHtml(copy.repeatPlan)}</p></div>
          </article>
          <article>
            ${icon("badge-check")}
            <div><strong>${ui.success}</strong><p>${escapeHtml(copy.successCriteria)}</p></div>
          </article>
          <article>
            ${icon("sparkles")}
            <div><strong>${ui.whyUseful}</strong><p>${escapeHtml(copy.benefit)}</p></div>
          </article>
          <article>
            ${icon("octagon-pause")}
            <div><strong>${ui.stopRule}</strong><p>${escapeHtml(copy.stopRule)}</p></div>
          </article>
        </section>

        <button class="primary adaptive-primary full" data-daily-next="${index}" type="button">
          <span>${ui.markResult}</span>${icon("arrow-right")}
        </button>
      </section>
    `,
    { nav: false },
  );
}

function renderDailyResult(context, index) {
  const { state, access = { access_tier: "complimentary" }, pageShell, escapeHtml, saveState, icon } = context;
  const ui = labels(state.language);
  const { date, plan } = ensureTodayPlan(state, saveState, access);
  const item = plan.items[index - 1];
  const exercise = item ? getExerciseById(item.exerciseId) : null;
  if (!exercise) return null;
  const copy = exerciseCopy(exercise, state.language);
  const outcomeButtons = [
    ["independent", ui.independent, "circle-check"],
    ["assisted", ui.assisted, "hand-helping"],
    ["unable", ui.unable, "circle-minus"],
    ["refused", ui.refused, "circle-pause"],
  ];

  return pageShell(
    `
      <section class="adaptive-question outcome-question">
        ${progressHeader(index, 3, state.language)}
        <span class="adaptive-eyebrow">${escapeHtml(planDayLabel(state.adaptive, date, state.language))} · ${ui.resultOne}</span>
        <h1>${escapeHtml(copy.title)}</h1>
        <p class="adaptive-lead">${ui.howWasIt}</p>
        <div class="answer-stack outcome-stack">
          ${outcomeButtons.map(([value, title, iconName]) => `
            <button class="answer-button" data-exercise-outcome="${index}:${value}" type="button">
              ${icon(iconName)}<span>${title}</span>
            </button>
          `).join("")}
        </div>
      </section>
    `,
    { nav: false },
  );
}

function renderDailySummary(context) {
  const { state, access = { access_tier: "complimentary" }, pageShell, escapeHtml, saveState, icon } = context;
  const ui = labels(state.language);
  const { date, plan } = ensureTodayPlan(state, saveState, access);
  const tomorrow = hasFullAccess(access) ? ensureTomorrowPlan(state, saveState, date) : null;
  return pageShell(
    `
      <section class="adaptive-center daily-summary">
        <div class="ready-mark" aria-hidden="true">${icon("check")}</div>
        <h1>${escapeHtml(planDayLabel(state.adaptive, date, state.language))} ${state.language === "ru" ? "завершён" : "аяқталды"}</h1>
        <p class="adaptive-lead">${ui.summaryText}</p>
        <div class="summary-results">
          ${plan.items.map((item) => {
            const exercise = getExerciseById(item.exerciseId);
            const outcome = plan.results[item.exerciseId];
            return `
              <div>
                <strong>${escapeHtml(exerciseCopy(exercise, state.language).title)}</strong>
                <span>${escapeHtml(outcomeMessage(outcome, state.language))}</span>
              </div>
            `;
          }).join("")}
        </div>
        ${tomorrow ? renderTomorrowPreview(context, tomorrow.date, tomorrow.plan) : renderFreeLimitReached(context)}
        <button class="primary adaptive-primary" data-route="/today" type="button">${icon("house")}<span>${ui.backToday}</span></button>
      </section>
    `,
    { nav: false },
  );
}

function renderLibraryCard(exercise, context) {
  const { state, escapeHtml, icon } = context;
  const ui = labels(state.language);
  const copy = exerciseCopy(exercise, state.language);
  const category = categoryCopy(exercise.category, state.language);
  const favorite = state.adaptive.favoriteExerciseIds.includes(exercise.id);
  const searchText = `${copy.title} ${category.title} ${copy.materials.join(" ")}`.toLocaleLowerCase(state.language);
  return `
    <article
      class="exercise-library-card"
      data-exercise-card
      data-category="${exercise.category}"
      data-level="${exercise.level}"
      data-search="${escapeHtml(searchText)}"
      data-is-favorite="${favorite ? "true" : "false"}"
      hidden
    >
      <div>
        <span>${escapeHtml(category.title)} · ${escapeHtml(levelLabel(exercise.level, state.language))}</span>
        <h3>${escapeHtml(copy.title)}</h3>
      </div>
      <div class="library-card-actions">
        <button
          class="favorite-button ${favorite ? "active" : ""}"
          data-favorite="${exercise.id}"
          type="button"
          aria-label="${favorite ? ui.favoriteRemove : ui.favoriteAdd}"
          title="${favorite ? ui.favoriteRemove : ui.favoriteAdd}"
        >${icon("heart")}</button>
        <button class="secondary compact" data-route="/library/${exercise.id}" type="button">${icon("arrow-up-right")}<span>${ui.open}</span></button>
      </div>
    </article>
  `;
}

function renderLibrary(context) {
  const { state, access = { access_tier: "complimentary" }, pageShell, escapeHtml, saveState, icon } = context;
  const ui = labels(state.language);
  if (!hasFullAccess(access)) {
    ensureTodayPlan(state, saveState, access);
    libraryFilter.category = "";
    libraryFilter.level = "all";
    libraryFilter.search = "";
    libraryFilter.favoritesOnly = false;
    const first = firstPlanEntry(state.adaptive);
    const unlocked = freeExerciseIds(state.adaptive).map((id) => getExerciseById(id)).filter(Boolean);
    const free = state.language === "ru"
      ? { eyebrow: "Freemium", title: "Три упражнения первого дня", text: "Они останутся доступны для повторения. Подписка откроет новые ежедневные планы и всю библиотеку.", cta: "Открыть подписку", note: "Ваш бесплатный доступ" }
      : { eyebrow: "Freemium", title: "Бірінші күннің үш жаттығуы", text: "Оларды кейін де қайталай аласыз. Жазылым жаңа күнделікті жоспарлар мен барлық кітапхананы ашады.", cta: "Жазылымды ашу", note: "Сіздің тегін қолжетімділігіңіз" };
    return pageShell(`
      <section class="adaptive-page-head library-head">
        <div><span class="adaptive-eyebrow">${free.eyebrow}</span><h1>${free.title}</h1><p>${free.text}</p></div>
        <button class="primary" data-route="/subscription" type="button">${icon("sparkles")}<span>${free.cta}</span></button>
      </section>
      <section class="free-library-note">${icon("unlock")}<div><strong>${free.note}</strong><span>3/3</span></div></section>
      <section class="library-results free-library-results" data-library-results hidden>
        ${unlocked.map((exercise) => renderLibraryCard(exercise, context)).join("")}
      </section>
      ${first?.plan?.completedAt ? renderFreeLimitReached(context) : `<section class="free-library-upsell">${icon("lock-keyhole")}<div><strong>${free.cta}</strong><p>${free.text}</p></div><button class="secondary" data-route="/subscription" type="button">${free.cta}</button></section>`}
    `);
  }
  return pageShell(`
    <section class="adaptive-page-head library-head">
      <div><span class="adaptive-eyebrow">${ui.library}</span><h1>${ui.allExercises}</h1><p>${ui.libraryIntro}</p></div>
      <button class="secondary" data-library-favorites type="button">${icon("heart")}<span>${ui.favorites}</span></button>
    </section>

    <section class="library-tools">
      <label class="library-search">
        <span>${ui.search}</span>
        <input data-library-search type="search" value="${escapeHtml(libraryFilter.search)}" placeholder="${ui.searchPlaceholder}" />
      </label>
      <label>
        <span>${ui.level}</span>
        <select data-library-level>
          <option value="all">${ui.allLevels}</option>
          ${[1, 2, 3].map((level) => `<option value="${level}" ${libraryFilter.level === String(level) ? "selected" : ""}>${levelLabel(level, state.language)}</option>`).join("")}
        </select>
      </label>
    </section>

    <section class="category-grid" aria-label="${ui.chooseDirection}">
      ${exerciseCategoryOrder.map((category) => {
        const copy = categoryCopy(category, state.language);
        return `
          <button class="category-button ${libraryFilter.category === category ? "active" : ""}" data-library-category="${category}" type="button">
            ${icon(categoryIconName(category), "category-icon")}<strong>${escapeHtml(copy.title)}</strong>${icon("chevron-right", "category-chevron")}
          </button>
        `;
      }).join("")}
    </section>

    <section class="library-results" data-library-results hidden>
      ${exercises.map((exercise) => renderLibraryCard(exercise, context)).join("")}
      <p class="library-empty" data-library-empty hidden>${ui.noResults}</p>
    </section>
  `);
}

function renderSubscription(context) {
  const { state, access = { access_tier: "complimentary" }, pageShell, icon } = context;
  const selectedCode = new URLSearchParams(location.search).get("plan");
  const selected = SUBSCRIPTION_PLANS.find((plan) => plan.code === selectedCode);
  const full = hasFullAccess(access);
  const copy = state.language === "ru"
    ? {
        eyebrow: "Подписка Qadam",
        title: "Новые шаги каждый день",
        intro: "Один пакет для всей семьи: персональные планы, полная библиотека и сохранение прогресса ребёнка.",
        active: "Полный доступ активен",
        activeText: access?.access_until ? `Доступ действует до ${access.access_until}.` : "У доступа нет ограничения по сроку.",
        popular: "Выгодный выбор",
        save: "Экономия",
        monthEquivalent: "в месяц",
        choose: "Выбрать",
        selected: "Вы выбрали",
        paymentPending: "Тариф сохранён. Оплату подключим после выбора платёжного партнёра; сейчас списаний не будет.",
        continueFree: "Продолжить бесплатно",
        features: ["Новый адаптивный план каждый день", "Вся библиотека упражнений", "История результатов и динамика навыков", "Казахский и русский языки"],
        periods: { month: "1 месяц", quarter: "3 месяца", half_year: "6 месяцев", year: "1 год" },
      }
    : {
        eyebrow: "Qadam жазылымы",
        title: "Күн сайын жаңа қадам",
        intro: "Бүкіл отбасыға арналған бір пакет: жеке жоспарлар, толық кітапхана және баланың прогресін сақтау.",
        active: "Толық қолжетімділік белсенді",
        activeText: access?.access_until ? `Қолжетімділік ${access.access_until} дейін жарамды.` : "Қолжетімділік мерзімсіз берілген.",
        popular: "Тиімді таңдау",
        save: "Үнем",
        monthEquivalent: "айына",
        choose: "Таңдау",
        selected: "Сіз таңдадыңыз",
        paymentPending: "Тариф сақталды. Төлем серіктесі таңдалғаннан кейін төлемді қосамыз; қазір қаражат алынбайды.",
        continueFree: "Тегін жалғастыру",
        features: ["Күн сайын жаңа бейімделген жоспар", "Барлық жаттығулар кітапханасы", "Нәтижелер тарихы мен дағдылар динамикасы", "Қазақ және орыс тілдері"],
        periods: { month: "1 ай", quarter: "3 ай", half_year: "6 ай", year: "1 жыл" },
      };
  return pageShell(`
    <section class="subscription-page">
      <header class="subscription-hero">
        <div><span class="adaptive-eyebrow">${copy.eyebrow}</span><h1>${copy.title}</h1><p>${copy.intro}</p></div>
        <div class="subscription-spark" aria-hidden="true">${icon("sparkles")}</div>
      </header>
      ${full ? `<section class="active-access-banner">${icon("badge-check")}<div><strong>${copy.active}</strong><span>${copy.activeText}</span></div></section>` : ""}
      <ul class="subscription-features">${copy.features.map((feature) => `<li>${icon("check")}<span>${feature}</span></li>`).join("")}</ul>
      <section class="pricing-grid">
        ${SUBSCRIPTION_PLANS.map((plan) => {
          const saving = (SUBSCRIPTION_PLANS[0].priceKzt * plan.months) - plan.priceKzt;
          const equivalent = Math.round(plan.priceKzt / plan.months);
          const isSelected = selected?.code === plan.code;
          return `<article class="pricing-card ${plan.featured ? "featured" : ""} ${isSelected ? "selected" : ""}">
            ${plan.featured ? `<span class="pricing-popular">${copy.popular}</span>` : ""}
            <span class="pricing-period">${copy.periods[plan.code]}</span>
            <strong class="pricing-price">${formatKzt(plan.priceKzt)}</strong>
            <small>${formatKzt(equivalent)} ${copy.monthEquivalent}</small>
            ${saving > 0 ? `<span class="pricing-saving">${copy.save}: ${formatKzt(saving)}</span>` : `<span class="pricing-saving neutral">4990 ₸ ${copy.monthEquivalent}</span>`}
            <button class="${plan.featured ? "primary" : "secondary"}" data-subscription-plan="${plan.code}" type="button">${icon(isSelected ? "check" : "arrow-right")}<span>${copy.choose}</span></button>
          </article>`;
        }).join("")}
      </section>
      ${selected ? `<section class="payment-status">${icon("shield-check")}<div><strong>${copy.selected}: ${copy.periods[selected.code]} — ${formatKzt(selected.priceKzt)}</strong><p>${copy.paymentPending}</p></div></section>` : ""}
      <button class="subscription-escape" data-route="/today" type="button">${copy.continueFree}</button>
    </section>
  `);
}

function renderExerciseDetail(context, exerciseId) {
  const { state, pageShell, escapeHtml, icon } = context;
  const ui = labels(state.language);
  const exercise = getExerciseById(exerciseId);
  if (!exercise) return null;
  const copy = exerciseCopy(exercise, state.language);
  const category = categoryCopy(exercise.category, state.language);
  const favorite = state.adaptive.favoriteExerciseIds.includes(exercise.id);

  return pageShell(`
    <section class="exercise-detail">
      <button class="text-back" data-route="/library" type="button">${icon("arrow-left")}<span>${ui.close}</span></button>
      <div class="exercise-detail-head">
        <div><span class="adaptive-eyebrow">${escapeHtml(category.title)} · ${levelLabel(exercise.level, state.language)}</span><h1>${escapeHtml(copy.title)}</h1></div>
        <button class="favorite-button ${favorite ? "active" : ""}" data-favorite="${exercise.id}" type="button" aria-label="${favorite ? ui.favoriteRemove : ui.favoriteAdd}">${icon("heart")}</button>
      </div>
      <div class="exercise-facts">
        <div><span>${ui.duration}</span><strong>${exercise.durationMinutes} ${ui.minutes}</strong></div>
        <div><span>${ui.goal}</span><strong>${escapeHtml(copy.goal)}</strong></div>
        <div><span>${ui.needed}</span><strong>${escapeHtml(copy.materials.join(", ") || ui.noMaterials)}</strong></div>
      </div>
      <section class="parent-script detail-parent-script">${icon("message-circle", "instruction-icon")}<div><span>${ui.sayThis}</span><blockquote>${escapeHtml(copy.parentWords)}</blockquote></div></section>
      <section class="three-steps detail-steps"><h2>${ui.howTo}</h2><ol>${copy.steps.map((step) => `<li><span>${escapeHtml(step)}</span></li>`).join("")}</ol></section>
      <section class="detail-notes">
        <article><strong>${ui.repeatPlan}</strong><p>${escapeHtml(copy.repeatPlan)}</p></article>
        <article><strong>${ui.success}</strong><p>${escapeHtml(copy.successCriteria)}</p></article>
        <article><strong>${ui.easier}</strong><p>${escapeHtml(copy.easierVersion)}</p></article>
        <article><strong>${ui.harder}</strong><p>${escapeHtml(copy.harderVersion)}</p></article>
        <article><strong>${ui.whyUseful}</strong><p>${escapeHtml(copy.benefit)}</p></article>
        <article><strong>${ui.stopRule}</strong><p>${escapeHtml(copy.stopRule)}</p></article>
      </section>
    </section>
  `);
}

function renderAdaptiveProgress(context) {
  const { state, pageShell, escapeHtml, icon } = context;
  const ui = labels(state.language);
  const summary = weeklySummary(state.adaptive);
  const streak = completionStreak(state.adaptive);
  return pageShell(`
    <section class="adaptive-page-head">
      <div><span class="adaptive-eyebrow">${ui.progress}</span><h1>${ui.weeklyResult}</h1><p>${ui.childOwnPace}</p></div>
    </section>
    <section class="progress-summary">
      <div><strong>${summary.completed}</strong><span>${ui.completedExercises}</span></div>
      <div><strong>${summary.independent}</strong><span>${ui.didIndependently}</span></div>
      <div><strong>${summary.assisted}</strong><span>${ui.didWithHelp}</span></div>
      <div><strong>${streak}</strong><span>${ui.streak}</span></div>
    </section>
    <section class="skill-levels">
      <div class="section-line"><h2>${ui.skillDirections}</h2></div>
      ${exerciseCategoryOrder.map((category) => {
        const level = state.adaptive.skillLevels[category] || 1;
        return `
          <article>
            <div><strong>${escapeHtml(categoryCopy(category, state.language).title)}</strong><span>${escapeHtml(skillStatus(level, state.language))}</span></div>
            <div class="level-track level-${level}"><i></i></div>
          </article>
        `;
      }).join("")}
    </section>
    ${isReassessmentDue(state.adaptive) ? `
      <section class="recheck-band">
        <div><strong>${ui.reassessment}</strong><p>${ui.reassessmentText}</p></div>
        <button class="secondary" data-route="/recheck/1" type="button">${icon("clipboard-check")}<span>${ui.startReassessment}</span></button>
      </section>
    ` : ""}
  `);
}

function profileFact(label, value, escapeHtml, fallback) {
  return `<article><span>${label}</span><strong>${escapeHtml(value || fallback)}</strong></article>`;
}

function renderAdaptiveProfile(context) {
  const { state, pageShell, escapeHtml, icon } = context;
  const ui = labels(state.language);
  const profile = state.childProfile || {};
  return pageShell(`
    <section class="adaptive-page-head">
      <div><span class="adaptive-eyebrow">${ui.profile}</span><h1>${escapeHtml(profile.name || ui.childProfile)}</h1></div>
      <button class="secondary" data-route="/onboarding" type="button">${icon("pencil")}<span>${ui.editProfile}</span></button>
    </section>
    <section class="adaptive-profile-grid">
      ${profileFact(ui.childAge, profile.age, escapeHtml, ui.noData)}
      ${profileFact(ui.diagnosis, profile.diagnosis, escapeHtml, ui.noData)}
      ${profileFact(ui.homeLanguage, profile.homeLanguage, escapeHtml, ui.noData)}
      ${profileFact(ui.meaningfulWords, profile.meaningfulWords, escapeHtml, ui.noData)}
      ${profileFact(ui.interests, profile.interests, escapeHtml, ui.noData)}
      ${profileFact(ui.dislikes, profile.dislikes, escapeHtml, ui.noData)}
      ${profileFact(ui.bestTime, profile.bestTime, escapeHtml, ui.noData)}
    </section>
    <p class="profile-note">${ui.diagnosisNote}</p>
    <section class="profile-actions">
      <button class="danger" data-reset-demo type="button">${icon("rotate-ccw")}<span>${ui.resetProfile}</span></button>
    </section>
  `);
}

export function getAdaptiveNav(language) {
  const ui = labels(language);
  return [
    ["/today", "house", ui.today],
    ["/library", "list-checks", ui.library],
    ["/progress", "chart-no-axes-column-increasing", ui.progress],
    ["/profile", "user-round", ui.profile],
  ];
}

export function guardAdaptiveRoute(path, state, access = {}) {
  const publicPaths = new Set(["/", "/language", "/onboarding"]);
  if (publicPaths.has(path) || !state.progress.onboardingCompleted) return null;
  const assessed = Boolean(state.adaptive.initialAssessment.completedAt);

  if (!assessed) {
    if (path === "/skill-check") return null;
    if (path.startsWith("/skill-check/")) {
      const requested = routeNumber(path);
      const firstMissing = assessmentQuestions.findIndex(
        (question) => !hasAnswer(state.adaptive.initialAssessment.answers, question.id),
      );
      const allowed = firstMissing === -1 ? assessmentQuestions.length : firstMissing + 1;
      return requested > allowed || requested < 1 || requested > assessmentQuestions.length
        ? `/skill-check/${allowed}`
        : null;
    }
    return "/skill-check";
  }

  if (path === "/dashboard") return "/today";
  if (path === "/skill-check" || path.startsWith("/skill-check/")) return "/today";

  const paywallRedirect = freemiumRouteRedirect(path, state, access);
  if (paywallRedirect) return paywallRedirect;

  const plan = state.adaptive.dailyPlans[activePlanDate(state)];
  if (path.startsWith("/daily-results/") && plan) {
    const firstUnanswered = plan.items.findIndex(
      (item) => !hasAnswer(plan.results || {}, item.exerciseId),
    );
    if (firstUnanswered === -1) return "/daily-summary";
    const requested = routeNumber(path);
    const expected = firstUnanswered + 1;
    if (requested !== expected) return nextDailyRoute(plan);
    if (Number(plan.viewedCount || 0) < expected) return `/daily/${expected}`;
  }
  if (path.startsWith("/daily/") && plan) {
    const expected = nextDailyRoute(plan);
    if (expected !== path) return expected;
  }
  if (path === "/daily-summary" && !plan?.completedAt) return "/today";
  if (path.startsWith("/recheck/")) {
    const number = routeNumber(path);
    return number < 1 || number > reassessmentQuestions.length ? "/progress" : null;
  }
  return null;
}

export function renderAdaptiveRoute(path, context) {
  if (path === "/today" || path === "/dashboard") return renderToday(context);
  if (path === "/skill-check") return renderAssessmentIntro(context);
  if (path.startsWith("/skill-check/")) return renderAssessmentQuestion(context, routeNumber(path));
  if (path === "/plan-ready") return renderPlanReady(context);
  if (path.startsWith("/daily/")) return renderDailyExercise(context, routeNumber(path));
  if (path.startsWith("/daily-results/")) return renderDailyResult(context, routeNumber(path));
  if (path === "/daily-summary") return renderDailySummary(context);
  if (path === "/library") return renderLibrary(context);
  if (path.startsWith("/library/")) return renderExerciseDetail(context, path.split("/").pop());
  if (path === "/progress") return renderAdaptiveProgress(context);
  if (path === "/profile") return renderAdaptiveProfile(context);
  if (path === "/subscription") return renderSubscription(context);
  if (path.startsWith("/recheck/")) return renderAssessmentQuestion(context, routeNumber(path), true);
  return null;
}

function saveInitialAnswer(context, id, rawValue) {
  const { state, saveState, routeTo } = context;
  const questionIndex = assessmentQuestions.findIndex((question) => question.id === id);
  const value = parseAnswer(rawValue);
  if (questionIndex === -1 || value === undefined) return;
  const answers = { ...state.adaptive.initialAssessment.answers, [id]: value };
  state.adaptive = {
    ...state.adaptive,
    initialAssessment: { ...state.adaptive.initialAssessment, answers },
  };

  const complete = assessmentQuestions.every((question) => hasAnswer(answers, question.id));
  if (complete) {
    state.adaptive = completeInitialAssessment(
      state.adaptive,
      answers,
      assessmentQuestions,
      exercises,
    );
    saveState(state);
    routeTo("/plan-ready");
    return;
  }
  saveState(state);
  const nextMissing = assessmentQuestions.findIndex((question) => !hasAnswer(answers, question.id));
  routeTo(`/skill-check/${nextMissing + 1}`);
}

function saveReassessmentAnswer(context, id, rawValue) {
  const { state, saveState, routeTo } = context;
  const questionIndex = reassessmentQuestions.findIndex((question) => question.id === id);
  const value = parseAnswer(rawValue);
  if (questionIndex === -1 || value === undefined) return;
  const answers = { ...state.adaptive.reassessment.answers, [id]: value };
  state.adaptive = {
    ...state.adaptive,
    reassessment: {
      answers,
      startedAt: state.adaptive.reassessment.startedAt || new Date().toISOString(),
    },
  };

  const complete = reassessmentQuestions.every((question) => hasAnswer(answers, question.id));
  if (complete) {
    const measured = calculateSkillLevels(answers, reassessmentQuestions);
    const skillLevels = { ...state.adaptive.skillLevels };
    for (const question of reassessmentQuestions) {
      if (answers[question.id] === 0 || answers[question.id] === 1 || answers[question.id] === 2) {
        skillLevels[question.category] = measured[question.category];
      }
    }
    state.adaptive = {
      ...state.adaptive,
      skillLevels,
      lastReassessmentAt: new Date().toISOString(),
      reassessment: { answers: {}, startedAt: null },
    };
    saveState(state);
    routeTo("/progress");
    return;
  }
  saveState(state);
  const nextMissing = reassessmentQuestions.findIndex((question) => !hasAnswer(answers, question.id));
  routeTo(`/recheck/${nextMissing + 1}`);
}

function completeDailyStep(context, index) {
  const { state, access = { access_tier: "complimentary" }, saveState, routeTo } = context;
  const { date, plan } = ensureTodayPlan(state, saveState, access);
  const nextViewed = Math.max(Number(plan.viewedCount || 0), index);
  state.adaptive = {
    ...state.adaptive,
    dailyPlans: {
      ...state.adaptive.dailyPlans,
      [date]: { ...plan, viewedCount: nextViewed },
    },
  };
  saveState(state);
  routeTo(`/daily-results/${index}`);
}

function saveOutcome(context, index, outcome) {
  const { state, access = { access_tier: "complimentary" }, saveState, routeTo } = context;
  const { date, plan } = ensureTodayPlan(state, saveState, access);
  const item = plan.items[index - 1];
  const exercise = item ? getExerciseById(item.exerciseId) : null;
  if (!exercise || !["independent", "assisted", "unable", "refused"].includes(outcome)) return;
  if (hasAnswer(plan.results, exercise.id)) {
    if (index < plan.items.length) {
      state.adaptive = adaptNextPlanItem(state.adaptive, exercises, date, index).adaptive;
      saveState(state);
    }
    routeTo(index >= plan.items.length ? "/daily-summary" : `/daily/${index + 1}`);
    return;
  }

  state.adaptive = recordExerciseOutcome(state.adaptive, exercise, outcome, date, exercises);
  const currentPlan = state.adaptive.dailyPlans[date];
  const results = { ...currentPlan.results, [exercise.id]: outcome };
  state.adaptive = {
    ...state.adaptive,
    dailyPlans: {
      ...state.adaptive.dailyPlans,
      [date]: { ...currentPlan, results },
    },
  };

  const allAnswered = currentPlan.items.every((planItem) => hasAnswer(results, planItem.exerciseId));
  if (allAnswered) {
    state.adaptive = markDayCompleted(state.adaptive, date);
    if (hasFullAccess(access)) {
      const tomorrow = ensureDailyPlan(state.adaptive, exercises, shiftDateKey(date, 1));
      state.adaptive = tomorrow.adaptive;
    }
  } else {
    state.adaptive = adaptNextPlanItem(state.adaptive, exercises, date, index).adaptive;
  }
  saveState(state);
  routeTo(allAnswered ? "/daily-summary" : `/daily/${index + 1}`);
}

export function handleAdaptiveClick(event, context) {
  const subscriptionPlan = event.target.closest("[data-subscription-plan]");
  if (subscriptionPlan) {
    const plan = SUBSCRIPTION_PLANS.find((item) => item.code === subscriptionPlan.dataset.subscriptionPlan);
    if (!plan) return true;
    localStorage.setItem("qadam.subscription.selection.v1", JSON.stringify({ code: plan.code, selectedAt: new Date().toISOString() }));
    window.history.replaceState({}, "", `/subscription?plan=${encodeURIComponent(plan.code)}`);
    context.render();
    return true;
  }

  const skill = event.target.closest("[data-skill-answer]");
  if (skill) {
    const [id, value] = skill.dataset.skillAnswer.split(":");
    saveInitialAnswer(context, id, value);
    return true;
  }

  const recheck = event.target.closest("[data-recheck-answer]");
  if (recheck) {
    const [id, value] = recheck.dataset.recheckAnswer.split(":");
    saveReassessmentAnswer(context, id, value);
    return true;
  }

  const dailyNext = event.target.closest("[data-daily-next]");
  if (dailyNext) {
    completeDailyStep(context, Number(dailyNext.dataset.dailyNext));
    return true;
  }

  const outcome = event.target.closest("[data-exercise-outcome]");
  if (outcome) {
    const [index, value] = outcome.dataset.exerciseOutcome.split(":");
    saveOutcome(context, Number(index), value);
    return true;
  }

  const openPlan = event.target.closest("[data-open-plan-date]");
  if (openPlan) {
    const date = openPlan.dataset.openPlanDate;
    const plan = context.state.adaptive.dailyPlans[date];
    if (!plan) return true;
    const first = firstPlanEntry(context.state.adaptive);
    if (!hasFullAccess(context.access ?? { access_tier: "complimentary" }) && first?.date !== date) {
      context.routeTo("/subscription");
      return true;
    }
    context.state.adaptive = { ...context.state.adaptive, activePlanDate: date };
    context.saveState(context.state);
    context.routeTo(nextDailyRoute(plan));
    return true;
  }

  const category = event.target.closest("[data-library-category]");
  if (category) {
    libraryFilter.category =
      libraryFilter.category === category.dataset.libraryCategory
        ? ""
        : category.dataset.libraryCategory;
    libraryFilter.favoritesOnly = false;
    context.render();
    return true;
  }

  if (event.target.closest("[data-library-favorites]")) {
    libraryFilter.favoritesOnly = !libraryFilter.favoritesOnly;
    libraryFilter.category = "";
    context.render();
    return true;
  }

  const favorite = event.target.closest("[data-favorite]");
  if (favorite) {
    const id = favorite.dataset.favorite;
    const current = new Set(context.state.adaptive.favoriteExerciseIds);
    if (current.has(id)) current.delete(id);
    else current.add(id);
    context.state.adaptive = {
      ...context.state.adaptive,
      favoriteExerciseIds: [...current],
    };
    context.saveState(context.state);
    context.render();
    return true;
  }

  return false;
}

export function applyLibraryFilters() {
  const cards = [...document.querySelectorAll("[data-exercise-card]")];
  if (!cards.length) return false;
  const search = libraryFilter.search.trim().toLocaleLowerCase();
  const hasFilter = Boolean(
    libraryFilter.category ||
    libraryFilter.favoritesOnly ||
    search ||
    libraryFilter.level !== "all",
  );
  let visible = 0;
  for (const card of cards) {
    const matches =
      (!libraryFilter.category || card.dataset.category === libraryFilter.category) &&
      (libraryFilter.level === "all" || card.dataset.level === libraryFilter.level) &&
      (!libraryFilter.favoritesOnly || card.dataset.isFavorite === "true") &&
      (!search || card.dataset.search.includes(search));
    card.hidden = !hasFilter || !matches;
    if (hasFilter && matches) visible += 1;
  }
  const results = document.querySelector("[data-library-results]");
  const empty = document.querySelector("[data-library-empty]");
  if (results) results.hidden = !hasFilter;
  if (empty) empty.hidden = !hasFilter || visible > 0;
  return true;
}

export function handleAdaptiveInput(event) {
  const search = event.target.closest("[data-library-search]");
  if (search) {
    libraryFilter.search = search.value;
    applyLibraryFilters();
    return true;
  }
  const level = event.target.closest("[data-library-level]");
  if (level) {
    libraryFilter.level = level.value;
    applyLibraryFilters();
    return true;
  }
  return false;
}
