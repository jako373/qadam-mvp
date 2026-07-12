import { adaptiveUi } from "./data/adaptive-ui.js";
import {
  assessmentAnswers,
  assessmentQuestions,
  reassessmentQuestions,
} from "./data/assessment-questions.js";
import { exerciseCategories, exerciseCategoryOrder } from "./data/exercise-localization.js";
import { exercises, getExerciseById } from "./data/exercises.js";
import { todayKey } from "./lib/adaptive-state.js";
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
import { ensureDailyPlan, planDuration } from "./lib/recommendation-engine.js";

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
    duration: "Ұзақтығы",
    open: "Ашу",
    close: "Жаттығуларға қайту",
    diagnosisNote: "Диагноз профильде сақталады, бірақ жаттығулар баланың нақты жауабына қарай таңдалады.",
    legacyNote: "Бұрынғы 12 сабақ та сақталған.",
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
    duration: "Длительность",
    open: "Открыть",
    close: "Вернуться к упражнениям",
    diagnosisNote: "Диагноз сохраняется в профиле, но упражнения выбираются по фактическим ответам ребёнка.",
    legacyNote: "Прежняя программа из 12 занятий тоже сохранена.",
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

function ensureTodayPlan(state, saveState) {
  const date = todayKey();
  const result = ensureDailyPlan(state.adaptive, exercises, date);
  if (result.adaptive !== state.adaptive) {
    state.adaptive = result.adaptive;
    saveState(state);
  }
  return { date, plan: result.plan };
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
  const { state, pageShell, escapeHtml } = context;
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
          ${assessmentAnswers
            .map((answer) => {
              const value = answer.value === null ? "unknown" : String(answer.value);
              const isSelected = selected === answer.value;
              return `
                <button
                  class="answer-button ${isSelected ? "selected" : ""}"
                  ${attribute}="${escapeHtml(question.id)}:${value}"
                  type="button"
                >${escapeHtml(answer[state.language])}</button>
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
  const { state, pageShell } = context;
  const ui = labels(state.language);
  return pageShell(
    `
      <section class="adaptive-center plan-ready">
        <div class="ready-mark" aria-hidden="true">✓</div>
        <span class="adaptive-eyebrow">${ui.levelsReady}</span>
        <h1>${ui.planReady}</h1>
        <p class="adaptive-lead">${ui.planReadyText}</p>
        <button class="primary adaptive-primary" data-route="/today" type="button">${ui.openToday}</button>
        <p class="adaptive-disclaimer">${ui.planReason}</p>
      </section>
    `,
    { nav: false },
  );
}

function nextDailyRoute(plan) {
  if (plan.completedAt) return "/daily-summary";
  if (plan.viewedCount < 3) return `/daily/${Math.max(1, plan.viewedCount + 1)}`;
  const unanswered = plan.items.findIndex((item) => !hasAnswer(plan.results, item.exerciseId));
  return unanswered === -1 ? "/daily-summary" : `/daily-results/${unanswered + 1}`;
}

function renderToday(context) {
  const { state, pageShell, escapeHtml, saveState } = context;
  const ui = labels(state.language);
  const { plan } = ensureTodayPlan(state, saveState);
  const summary = weeklySummary(state.adaptive);
  const streak = completionStreak(state.adaptive);
  const done = Boolean(plan.completedAt);

  return pageShell(`
    <section class="adaptive-page-head">
      <div>
        <span class="adaptive-eyebrow">${ui.today}</span>
        <h1>${done ? ui.doneToday : ui.todayThree}</h1>
        <p>${done ? ui.doneTodayText : ui.planReason}</p>
      </div>
      <div class="today-streak"><strong>${streak}</strong><span>${ui.streak}</span></div>
    </section>

    ${isReassessmentDue(state.adaptive) ? `
      <section class="recheck-band">
        <div><strong>${ui.reassessment}</strong><p>${ui.reassessmentText}</p></div>
        <button class="secondary" data-route="/recheck/1" type="button">${ui.startReassessment}</button>
      </section>
    ` : ""}

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
            <span class="daily-state">${outcome ? "✓" : ""}</span>
          </article>
        `;
      }).join("")}
    </section>

    <section class="today-action">
      <div><span>${ui.totalTime}</span><strong>${planDuration(plan, exercises)} ${ui.minutes}</strong></div>
      <button class="primary adaptive-primary" data-route="${done ? "/progress" : nextDailyRoute(plan)}" type="button">
        ${done ? ui.openProgress : plan.viewedCount ? ui.continue : ui.start}
      </button>
    </section>

    <section class="weekly-strip">
      <div><strong>${summary.completed}</strong><span>${ui.completedExercises}</span></div>
      <div><strong>${summary.newSkills}</strong><span>${ui.newSkills}</span></div>
    </section>
  `);
}

function renderDailyExercise(context, index) {
  const { state, pageShell, escapeHtml, saveState } = context;
  const ui = labels(state.language);
  const { plan } = ensureTodayPlan(state, saveState);
  const item = plan.items[index - 1];
  const exercise = item ? getExerciseById(item.exerciseId) : null;
  if (!exercise) return null;
  const copy = exerciseCopy(exercise, state.language);

  return pageShell(
    `
      <section class="daily-exercise">
        ${progressHeader(index, 3, state.language)}
        <h1>${escapeHtml(copy.title)}</h1>
        <section class="needed-box">
          <span>${ui.needed}</span>
          <strong>${escapeHtml(copy.materials.join(", ") || ui.noMaterials)}</strong>
        </section>
        <section class="three-steps">
          <h2>${ui.howTo}</h2>
          <ol>
            ${copy.steps.map((step) => `<li><span>${escapeHtml(step)}</span></li>`).join("")}
          </ol>
        </section>
        <button class="primary adaptive-primary full" data-daily-next="${index}" type="button">
          ${index === 3 ? ui.openSummary : ui.next}
        </button>
      </section>
    `,
    { nav: false },
  );
}

function renderDailyResult(context, index) {
  const { state, pageShell, escapeHtml, saveState } = context;
  const ui = labels(state.language);
  const { plan } = ensureTodayPlan(state, saveState);
  const item = plan.items[index - 1];
  const exercise = item ? getExerciseById(item.exerciseId) : null;
  if (!exercise) return null;
  const copy = exerciseCopy(exercise, state.language);
  const outcomeButtons = [
    ["independent", ui.independent],
    ["assisted", ui.assisted],
    ["unable", ui.unable],
    ["refused", ui.refused],
  ];

  return pageShell(
    `
      <section class="adaptive-question outcome-question">
        ${progressHeader(index, 3, state.language)}
        <span class="adaptive-eyebrow">${ui.resultOne}</span>
        <h1>${escapeHtml(copy.title)}</h1>
        <p class="adaptive-lead">${ui.howWasIt}</p>
        <div class="answer-stack outcome-stack">
          ${outcomeButtons.map(([value, title]) => `
            <button class="answer-button" data-exercise-outcome="${index}:${value}" type="button">
              ${title}
            </button>
          `).join("")}
        </div>
      </section>
    `,
    { nav: false },
  );
}

function renderDailySummary(context) {
  const { state, pageShell, escapeHtml, saveState } = context;
  const ui = labels(state.language);
  const { plan } = ensureTodayPlan(state, saveState);
  return pageShell(
    `
      <section class="adaptive-center daily-summary">
        <div class="ready-mark" aria-hidden="true">✓</div>
        <h1>${ui.summaryTitle}</h1>
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
        <button class="primary adaptive-primary" data-route="/today" type="button">${ui.backToday}</button>
      </section>
    `,
    { nav: false },
  );
}

function renderLibraryCard(exercise, context) {
  const { state, escapeHtml } = context;
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
        >★</button>
        <button class="secondary compact" data-route="/library/${exercise.id}" type="button">${ui.open}</button>
      </div>
    </article>
  `;
}

function renderLibrary(context) {
  const { state, pageShell, escapeHtml } = context;
  const ui = labels(state.language);
  return pageShell(`
    <section class="adaptive-page-head library-head">
      <div><span class="adaptive-eyebrow">${ui.library}</span><h1>${ui.allExercises}</h1><p>${ui.libraryIntro}</p></div>
      <button class="secondary" data-library-favorites type="button">${ui.favorites}</button>
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
            <strong>${escapeHtml(copy.title)}</strong><span>15</span>
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

function renderExerciseDetail(context, exerciseId) {
  const { state, pageShell, escapeHtml } = context;
  const ui = labels(state.language);
  const exercise = getExerciseById(exerciseId);
  if (!exercise) return null;
  const copy = exerciseCopy(exercise, state.language);
  const category = categoryCopy(exercise.category, state.language);
  const favorite = state.adaptive.favoriteExerciseIds.includes(exercise.id);

  return pageShell(`
    <section class="exercise-detail">
      <button class="text-back" data-route="/library" type="button">← ${ui.close}</button>
      <div class="exercise-detail-head">
        <div><span class="adaptive-eyebrow">${escapeHtml(category.title)} · ${levelLabel(exercise.level, state.language)}</span><h1>${escapeHtml(copy.title)}</h1></div>
        <button class="favorite-button ${favorite ? "active" : ""}" data-favorite="${exercise.id}" type="button" aria-label="${favorite ? ui.favoriteRemove : ui.favoriteAdd}">★</button>
      </div>
      <div class="exercise-facts">
        <div><span>${ui.duration}</span><strong>${exercise.durationMinutes} ${ui.minutes}</strong></div>
        <div><span>${ui.goal}</span><strong>${escapeHtml(copy.goal)}</strong></div>
        <div><span>${ui.needed}</span><strong>${escapeHtml(copy.materials.join(", ") || ui.noMaterials)}</strong></div>
      </div>
      <section class="three-steps detail-steps"><h2>${ui.howTo}</h2><ol>${copy.steps.map((step) => `<li><span>${escapeHtml(step)}</span></li>`).join("")}</ol></section>
      <section class="detail-notes">
        <article><strong>${ui.success}</strong><p>${escapeHtml(copy.successCriteria)}</p></article>
        <article><strong>${ui.easier}</strong><p>${escapeHtml(copy.easierVersion)}</p></article>
        <article><strong>${ui.harder}</strong><p>${escapeHtml(copy.harderVersion)}</p></article>
        <article><strong>${ui.parentTip}</strong><p>${escapeHtml(copy.parentTip)}</p></article>
      </section>
    </section>
  `);
}

function renderAdaptiveProgress(context) {
  const { state, pageShell, escapeHtml } = context;
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
        <button class="secondary" data-route="/recheck/1" type="button">${ui.startReassessment}</button>
      </section>
    ` : ""}
  `);
}

function profileFact(label, value, escapeHtml, fallback) {
  return `<article><span>${label}</span><strong>${escapeHtml(value || fallback)}</strong></article>`;
}

function renderAdaptiveProfile(context) {
  const { state, pageShell, escapeHtml } = context;
  const ui = labels(state.language);
  const profile = state.childProfile || {};
  return pageShell(`
    <section class="adaptive-page-head">
      <div><span class="adaptive-eyebrow">${ui.profile}</span><h1>${escapeHtml(profile.name || ui.childProfile)}</h1></div>
      <button class="secondary" data-route="/onboarding" type="button">${ui.editProfile}</button>
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
      <button class="secondary" data-route="/lessons" type="button">${ui.legacyLessons}</button>
      <button class="danger" data-reset-demo type="button">${ui.resetProfile}</button>
    </section>
  `);
}

export function getAdaptiveNav(language) {
  const ui = labels(language);
  return [
    ["/today", "home", ui.today],
    ["/library", "list", ui.library],
    ["/progress", "chart", ui.progress],
    ["/profile", "user", ui.profile],
  ];
}

export function guardAdaptiveRoute(path, state) {
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

  const plan = state.adaptive.dailyPlans[todayKey()];
  if (path.startsWith("/daily-results/") && plan && Number(plan.viewedCount || 0) < 3) {
    return `/daily/${Math.max(1, Number(plan.viewedCount || 0) + 1)}`;
  }
  if (path.startsWith("/daily-results/") && plan) {
    const firstUnanswered = plan.items.findIndex(
      (item) => !hasAnswer(plan.results || {}, item.exerciseId),
    );
    if (firstUnanswered === -1) return "/daily-summary";
    const requested = routeNumber(path);
    if (requested !== firstUnanswered + 1) return `/daily-results/${firstUnanswered + 1}`;
  }
  if (path.startsWith("/daily/") && plan?.completedAt) return "/daily-summary";
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
  const { state, saveState, routeTo } = context;
  const { date, plan } = ensureTodayPlan(state, saveState);
  const nextViewed = Math.max(Number(plan.viewedCount || 0), index);
  state.adaptive = {
    ...state.adaptive,
    dailyPlans: {
      ...state.adaptive.dailyPlans,
      [date]: { ...plan, viewedCount: nextViewed },
    },
  };
  saveState(state);
  routeTo(index >= 3 ? "/daily-results/1" : `/daily/${index + 1}`);
}

function saveOutcome(context, index, outcome) {
  const { state, saveState, routeTo } = context;
  const { date, plan } = ensureTodayPlan(state, saveState);
  const item = plan.items[index - 1];
  const exercise = item ? getExerciseById(item.exerciseId) : null;
  if (!exercise || !["independent", "assisted", "unable", "refused"].includes(outcome)) return;
  if (hasAnswer(plan.results, exercise.id)) {
    routeTo(index >= 3 ? "/daily-summary" : `/daily-results/${index + 1}`);
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
  if (allAnswered) state.adaptive = markDayCompleted(state.adaptive, date);
  saveState(state);
  routeTo(allAnswered ? "/daily-summary" : `/daily-results/${index + 1}`);
}

export function handleAdaptiveClick(event, context) {
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
