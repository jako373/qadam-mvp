import {
  ageOptions,
  diagnosisOptions,
  getLesson2Activities,
  getNextLessonId,
  homeLanguageOptions,
  lesson1Questions,
  lesson2Questions,
  lessonOrder,
  lessons,
  ui,
  wordOptions,
} from "./data.js";
import { calculatePathway, pathwayMap } from "./pathway.js";
import {
  loadState,
  loadTimers,
  resetState,
  saveState,
  saveTimers,
} from "./storage.js";

let state = loadState();
let timerInterval = null;

const app = document.getElementById("app");

function t() {
  return ui[state.language];
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function routeTo(path) {
  window.history.pushState({}, "", path);
  render();
}

function setLanguage(language) {
  state.language = language;
  saveState(state);
  document.documentElement.lang = language;
  render();
}

function pageShell(content, options = {}) {
  const showNav = options.nav !== false && state.progress.onboardingCompleted;
  return `
    <div class="app-shell ${showNav ? "with-nav" : ""}">
      ${showNav ? renderTopNav() : ""}
      <main class="page">${content}</main>
      ${showNav ? renderBottomNav() : ""}
    </div>
  `;
}

function localizedList(list) {
  if (!list) return [];
  if (Array.isArray(list)) return list;
  return list[state.language] || list.kk || list.ru || [];
}

function renderLanguageSwitcher(compact = false) {
  const labels = t();
  const switcherLabel = labels.languageSwitcher || (state.language === "ru" ? "Переключатель языка" : "Тіл ауыстыру");
  return `
    <div class="lang-switch ${compact ? "compact" : ""}" aria-label="${switcherLabel}">
      <button class="${state.language === "kk" ? "active" : ""}" data-lang="kk" type="button">Қазақша</button>
      <button class="${state.language === "ru" ? "active" : ""}" data-lang="ru" type="button">Русский</button>
    </div>
  `;
}

function renderTopNav() {
  const labels = t();
  const homeAria = labels.homeAria || (state.language === "ru" ? "Главная Qadam" : "Қадам басты бет");
  const navAria = labels.primaryNavigation || (state.language === "ru" ? "Основная навигация" : "Негізгі навигация");
  return `
    <header class="top-nav">
      <button class="brand-mark" data-route="/dashboard" type="button" aria-label="${homeAria}">
        <span>Q</span>
        <strong>${labels.brand}</strong>
      </button>
      <nav aria-label="${navAria}">
        ${navButton("/dashboard", "home", labels.home)}
        ${navButton("/lessons", "list", labels.lessons)}
        ${navButton("/progress", "chart", labels.progress)}
        ${navButton("/profile", "user", labels.profile)}
      </nav>
      ${renderLanguageSwitcher(true)}
    </header>
  `;
}

function renderBottomNav() {
  const labels = t();
  const navAria = labels.mobileNavigation || (state.language === "ru" ? "Нижняя навигация" : "Төменгі навигация");
  return `
    <nav class="bottom-nav" aria-label="${navAria}">
      ${navButton("/dashboard", "home", labels.home)}
      ${navButton("/lessons", "list", labels.lessons)}
      ${navButton("/progress", "chart", labels.progress)}
      ${navButton("/profile", "user", labels.profile)}
    </nav>
  `;
}

function navButton(path, iconName, label) {
  const active = normalizePath(location.pathname) === path;
  return `
    <button class="nav-item ${active ? "active" : ""}" data-route="${path}" type="button" aria-label="${escapeHtml(label)}" ${active ? 'aria-current="page"' : ""}>
      ${renderNavIcon(iconName)}
      <span>${label}</span>
    </button>
  `;
}

function renderNavIcon(name) {
  const icons = {
    home: '<path d="M3 10.5 12 3l9 7.5v8a1.5 1.5 0 0 1-1.5 1.5h-4.25v-6h-6.5v6H4.5A1.5 1.5 0 0 1 3 18.5v-8Z" />',
    list: '<path d="M8 6h13M8 12h13M8 18h13" /><path d="M3.5 6h.01M3.5 12h.01M3.5 18h.01" />',
    chart: '<path d="M4 19V5" /><path d="M4 19h16" /><path d="M8 16v-5" /><path d="M12 16V8" /><path d="M16 16v-8" />',
    user: '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" />',
  };

  return `
    <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${icons[name] || icons.home}
      </g>
    </svg>
  `;
}

function normalizePath(path) {
  return path === "" ? "/" : path;
}

function renderLanding() {
  const labels = t();
  const benefitsAria = labels.benefitsAria || (state.language === "ru" ? "Преимущества" : "Артықшылықтар");
  return pageShell(
    `
      <section class="hero">
        <img class="hero-image" src="/public/images/parent-child-lesson.svg" alt="" />
        <div class="hero-scrim"></div>
        <div class="hero-content">
          <div class="hero-topline">
            <span class="text-logo">${labels.brand}</span>
            <span>${labels.tagline}</span>
          </div>
          <h1>${labels.landingTitle}</h1>
          <p>${labels.landingText}</p>
          <div class="hero-actions">
            <button class="primary" data-route="/language" type="button">${labels.start}</button>
            ${renderLanguageSwitcher(true)}
          </div>
        </div>
      </section>
      <section class="band benefits-band" aria-label="${benefitsAria}">
        <div class="content-grid three">
          ${labels.benefits
            .map(
              ([title, text]) => `
                <article class="benefit-card">
                  <strong>${title}</strong>
                  <p>${text}</p>
                </article>
              `,
            )
            .join("")}
        </div>
        <p class="disclaimer inline">${labels.disclaimer}</p>
      </section>
    `,
    { nav: false },
  );
}

function renderLanguagePage() {
  const labels = t();
  return pageShell(
    `
      <section class="center-panel narrow">
        <div class="section-kicker">${labels.brand}</div>
        <h1>${labels.chooseLanguage}</h1>
        <div class="choice-grid">
          <button class="choice-button" data-pick-language="kk" type="button">
            <span>Қазақша</span>
            ${state.language === "kk" ? `<small>${labels.selected}</small>` : ""}
          </button>
          <button class="choice-button" data-pick-language="ru" type="button">
            <span>Русский</span>
            ${state.language === "ru" ? `<small>${labels.selected}</small>` : ""}
          </button>
        </div>
      </section>
    `,
    { nav: false },
  );
}

function renderOnboarding() {
  const labels = t();
  const profile = state.childProfile || {};
  return pageShell(
    `
      <section class="center-panel">
        <div class="section-kicker">${labels.brand}</div>
        <h1>${labels.childProfile}</h1>
        <form id="profile-form" class="form-grid">
          ${inputField("name", labels.childName, "text", profile.name || "", true)}
          ${selectField("age", labels.childAge, ageOptions, profile.age || "", true)}
          ${selectField("diagnosis", labels.diagnosis, diagnosisOptions, profile.diagnosis || "", true)}
          ${selectField("homeLanguage", labels.homeLanguage, homeLanguageOptions, profile.homeLanguage || "", true)}
          ${selectField("meaningfulWords", labels.meaningfulWords, wordOptions, profile.meaningfulWords || "", true)}
          <label class="check-row full">
            <input id="consent" name="consent" type="checkbox" required />
            <span>${labels.consent}</span>
          </label>
          <button id="profile-submit" class="primary full" type="submit" disabled>${labels.continue}</button>
        </form>
      </section>
    `,
    { nav: false },
  );
}

function inputField(name, label, type, value, required) {
  return `
    <label class="field">
      <span>${label}</span>
      <input name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""} autocomplete="off" />
    </label>
  `;
}

function selectField(name, label, options, value, required) {
  return `
    <label class="field">
      <span>${label}</span>
      <select name="${name}" ${required ? "required" : ""}>
        <option value=""></option>
        ${options
          .map(
            (option) =>
              `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? "selected" : ""}>${escapeHtml(option)}</option>`,
          )
          .join("")}
      </select>
    </label>
  `;
}

function renderParentIntro() {
  const labels = t();
  return pageShell(
    `
      <section class="support-screen">
        <div class="support-copy">
          <div class="section-kicker">${labels.brand}</div>
          <h1>${labels.parentIntroTitle}</h1>
          <p>${labels.parentIntroText}</p>
          <button class="primary" data-start-intro type="button">${labels.startFirstLesson}</button>
        </div>
      </section>
    `,
    { nav: false },
  );
}

function nextLessonId() {
  const completed = new Set(state.progress.completedLessonIds);
  return lessonOrder.find((lessonId) => state.progress.unlockedLessonIds.includes(lessonId) && !completed.has(lessonId)) || lessonOrder[lessonOrder.length - 1];
}

function progressPercent() {
  const count = state.progress.completedLessonIds.length;
  return Math.min(100, Math.round((count / lessonOrder.length) * 100));
}

function renderDashboard() {
  const labels = t();
  const childName = escapeHtml(state.childProfile?.name || "");
  const nextId = nextLessonId();
  const lesson = lessons[nextId] || lessons.lesson1;
  const pathway = state.progress.selectedPathway ? pathwayMap[state.progress.selectedPathway] : null;
  const direction = pathway ? pathway[state.language].level : labels.lessonPathway;
  return pageShell(`
    <section class="dashboard-header">
      <div>
        <div class="section-kicker">${labels.home}</div>
        <h1>${childName ? `${childName}, ${labels.todayLesson.toLowerCase()}` : labels.todayLesson}</h1>
      </div>
      <button class="secondary" data-route="/lessons" type="button">${labels.lessons}</button>
    </section>

    <section class="metric-grid">
      ${metricCard(`${progressPercent()}%`, labels.progress, progressBar(progressPercent()))}
      ${metricCard(String(state.progress.completedLessonIds.length), labels.completedLessons, "")}
      ${metricCard(direction, labels.currentDirection, "")}
    </section>

    <section class="lesson-focus">
      <div>
        <span class="pill">${labels.todayLesson}</span>
        <h2>${lesson[state.language].title}</h2>
        <p>${lesson[state.language].description}</p>
      </div>
      <button class="primary" data-route="/lesson/${lesson.id}" type="button">${labels.open}</button>
    </section>

    <section class="band">
      <div class="section-heading">
        <h2>${labels.lessonPathway}</h2>
        <p>${labels.disclaimer}</p>
      </div>
      ${renderLessonList()}
    </section>
  `);
}

function metricCard(value, label, extra) {
  return `
    <article class="metric-card">
      <strong>${value}</strong>
      <span>${label}</span>
      ${extra}
    </article>
  `;
}

function progressBar(percent) {
  return `
    <div class="progress-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${percent}">
      <span style="width:${percent}%"></span>
    </div>
  `;
}

function renderLessonList() {
  const labels = t();
  const currentId = nextLessonId();
  return `
    <div class="lesson-grid">
      ${lessonOrder
        .map((lessonId) => {
          const lesson = lessons[lessonId];
          const unlocked = state.progress.unlockedLessonIds.includes(lessonId);
          const completed = state.progress.completedLessonIds.includes(lessonId);
          const current = lessonId === currentId && !completed;
          return `
            <article class="lesson-card ${unlocked ? "" : "locked"} ${current ? "assigned" : ""}">
              <div class="lesson-card-top">
                <span class="lesson-number">${lesson.order}</span>
                <span class="pill small">${lesson.duration} ${labels.minutes}</span>
                ${completed ? `<span class="pill small">${labels.done}</span>` : current ? `<span class="pill small">${labels.nextLesson}</span>` : ""}
              </div>
              <h3>${lesson[state.language].title}</h3>
              <p>${unlocked ? lesson[state.language].description : labels.lockedMessage}</p>
              <div class="card-actions">
                ${
                  unlocked
                    ? `<button class="secondary" data-route="/lesson/${lessonId}" type="button">${labels.open}</button>`
                    : `<span class="lock" aria-label="${labels.locked}">&#8981; ${labels.locked}</span>`
                }
              </div>
            </article>
          `;
        })
        .join("")}
    </div>
  `;
}

function renderLessonsPage() {
  const labels = t();
  return pageShell(`
    <section class="section-heading">
      <div>
        <div class="section-kicker">${labels.lessons}</div>
        <h1>${labels.lessonPathway}</h1>
      </div>
    </section>
    ${renderLessonList()}
  `);
}

function renderPhoneFreeGuide() {
  if (state.language === "ru") {
    return `
      <section class="prep-card phone-free-card">
        <strong>Как заниматься без телефона в руках</strong>
        <p>Сначала прочитайте занятие 1-2 минуты. Потом включите таймер, отложите телефон экраном вниз и занимайтесь с ребёнком; галочки и звёзды отметьте только после упражнения.</p>
      </section>
    `;
  }

  return `
    <section class="prep-card phone-free-card">
      <strong>Телефонға үңіліп отырмайсыз</strong>
      <p>Алдымен сабақты 1-2 минут оқып алыңыз. Сосын таймерді қосып, телефонды экранмен төмен қойыңыз да, балаға қараңыз; белгі мен жұлдызшаны жаттығудан кейін ғана қоясыз.</p>
    </section>
  `;
}

function renderLessonPage(lessonId) {
  const labels = t();
  const lesson = lessons[lessonId];
  if (!lesson) return renderNotFound();
  const lessonData = lesson[state.language];
  const activities = lesson.activities || getLesson2Activities(lessonId, state.language);
  const checks = state.activityChecks[lessonId] || {};
  const allDone = activities.every((activity) => checks[activity.id]);
  const objects = localizedList(lesson.objects);
  return pageShell(`
    <section class="lesson-page">
      <div class="lesson-hero">
        <div>
          <span class="pill">${lesson.order}/${lessonOrder.length} ${labels.lessonOf} · ${lesson.duration} ${labels.minutes}</span>
          <h1>${lessonData.title}</h1>
          <p>${lessonData.description}</p>
        </div>
        ${renderTimer(lessonId, activities)}
      </div>

      ${renderPhoneFreeGuide()}

      ${
        lessonData.prep
          ? `<section class="prep-card"><strong>${labels.prepare}</strong><p>${lessonData.prep}</p></section>`
          : ""
      }

      ${
        objects.length
          ? `<section class="objects-row"><strong>${labels.objects}</strong>${objects
              .map((item) => `<span>${escapeHtml(item)}</span>`)
              .join("")}</section>`
          : ""
      }

      ${
        lessonData.objectsUse
          ? `<section class="prep-card"><strong>${labels.objectsHow}</strong><p>${lessonData.objectsUse}</p></section>`
          : ""
      }

      <section class="activity-list">
        ${activities.map((activity, index) => renderActivity(lessonId, activity, index, checks[activity.id])).join("")}
      </section>

      ${
        lessonData.repeatPlan
          ? `<section class="prep-card"><strong>${labels.repeatAtHome}</strong><p>${lessonData.repeatPlan}</p></section>`
          : ""
      }

      <section class="lesson-complete">
        <p>${labels.allDoneHint}</p>
        <button class="primary" data-finish-lesson="${lessonId}" type="button" ${allDone ? "" : "disabled"}>
          ${labels.openAssessment}
        </button>
      </section>
    </section>
  `);
}

function renderActivity(lessonId, activity, index, checked) {
  const labels = t();
  const langData = activity[state.language];
  const fallbackData = activity.kk || activity.ru || {};
  const activityObjects = localizedList(activity.objects);
  const steps = langData?.steps || fallbackData.steps || [];
  const benefit = langData?.benefit || fallbackData.benefit || [];
  const repeat = langData?.repeat || fallbackData.repeat || labels.activityRepeatDefault;
  return `
    <article class="activity-card" data-activity-card="${lessonId}-${activity.id}">
      <div class="activity-head">
        <span class="activity-index">${index + 1}</span>
        <div>
          <h2>${langData?.title || fallbackData.title}</h2>
          <p>${activity.duration || 4} ${labels.minutes}</p>
        </div>
      </div>
      ${langData?.prep ? `<div class="activity-note"><strong>${labels.prepare}</strong><p>${langData.prep}</p></div>` : ""}
      ${activityObjects.length ? `<div class="objects-row small">${activityObjects.map((item) => `<span>${escapeHtml(item)}</span>`).join("")}</div>` : ""}
      <div class="activity-steps">
        <strong>${labels.howTo}</strong>
        <ol>
          ${steps.map((step) => `<li>${step}</li>`).join("")}
        </ol>
      </div>
      ${benefit.length ? `<div class="activity-note benefit"><strong>${labels.whyUseful}</strong>${benefit.map((line) => `<p>${line}</p>`).join("")}</div>` : ""}
      <div class="activity-note"><strong>${labels.repeatAtHome}</strong><p>${repeat}</p></div>
      <label class="check-row">
        <input data-activity-check="${lessonId}:${activity.id}" type="checkbox" ${checked ? "checked" : ""} />
        <span>${labels.done}</span>
      </label>
    </article>
  `;
}

function renderTimer(lessonId, activities) {
  const labels = t();
  const timer = getTimer(lessonId);
  const remaining = getRemaining(timer);
  const activeIndex = getActiveActivityIndex(timer, activities);
  const isLocal = ["localhost", "127.0.0.1", ""].includes(location.hostname);
  return `
    <aside class="timer-panel" data-timer="${lessonId}">
      <div>
        <span>${labels.activeActivity}</span>
        <strong data-timer-active>${activeIndex + 1}</strong>
      </div>
      <div class="timer-clock" data-timer-clock>${formatTime(remaining)}</div>
      <div class="timer-actions">
        ${
          !timer.started
            ? `<button class="secondary" data-timer-start="${lessonId}" type="button">${labels.startTimer}</button>`
            : timer.paused
              ? `<button class="secondary" data-timer-resume="${lessonId}" type="button">${labels.resume}</button>`
              : `<button class="secondary" data-timer-pause="${lessonId}" type="button">${labels.pause}</button>`
        }
        ${isLocal ? `<button class="ghost tiny" data-timer-skip="${lessonId}" type="button">${labels.demoSkip}</button>` : ""}
      </div>
    </aside>
  `;
}

function getTimer(lessonId) {
  const timers = loadTimers();
  const durationSeconds = getLessonDurationSeconds(lessonId);
  const saved = timers[lessonId];
  if (saved && saved.durationSeconds === durationSeconds) return saved;
  return {
    started: false,
    paused: true,
    durationSeconds,
    remainingWhenPaused: durationSeconds,
    startedAt: null,
  };
}

function getLessonDurationSeconds(lessonId) {
  return (lessons[lessonId]?.duration || 15) * 60;
}

function setTimer(lessonId, timer) {
  const timers = loadTimers();
  timers[lessonId] = timer;
  saveTimers(timers);
}

function getRemaining(timer) {
  if (!timer.started || timer.paused) return Math.max(0, timer.remainingWhenPaused);
  const elapsed = Math.floor((Date.now() - timer.startedAt) / 1000);
  return Math.max(0, timer.remainingWhenPaused - elapsed);
}

function getActiveActivityIndex(timer, activities) {
  if (!activities.length) return 0;
  const elapsed = (timer.durationSeconds || 900) - getRemaining(timer);
  let cumulative = 0;
  for (let index = 0; index < activities.length; index += 1) {
    cumulative += (activities[index].duration || 4) * 60;
    if (elapsed < cumulative) return index;
  }
  return activities.length - 1;
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function tickTimer() {
  const panel = document.querySelector("[data-timer]");
  if (!panel) return;
  const lessonId = panel.dataset.timer;
  const timer = getTimer(lessonId);
  const activities = lessons[lessonId]?.activities || [];
  const clock = panel.querySelector("[data-timer-clock]");
  const active = panel.querySelector("[data-timer-active]");
  if (clock) clock.textContent = formatTime(getRemaining(timer));
  if (active) active.textContent = String(getActiveActivityIndex(timer, activities) + 1);
}

function renderAssessment(lessonId) {
  const labels = t();
  const lesson = lessons[lessonId];
  const questions = lessonId === "lesson1" ? lesson1Questions[state.language] : lesson2Questions[state.language];
  const saved = state.assessments[lessonId]?.answers || {};
  return pageShell(`
    <section class="assessment-page">
      <div class="section-heading">
        <div>
          <span class="pill">${lesson[state.language].title}</span>
          <h1>${labels.parentObservation}</h1>
        </div>
        <p>${labels.requiredQuestions}</p>
      </div>
      <form id="assessment-form" data-assessment="${lessonId}">
        ${questions
          .map((question, index) => renderStarQuestion(index + 1, question, saved[index + 1]))
          .join("")}
        <div class="scale-note">
          <span>1 - ${labels.starLabels.one}</span>
          <span>3 - ${labels.starLabels.three}</span>
          <span>5 - ${labels.starLabels.five}</span>
        </div>
        <button id="assessment-submit" class="primary" type="submit" disabled>${lessonId === "lesson1" ? labels.showResult : labels.backDashboard}</button>
      </form>
    </section>
  `);
}

function renderStarQuestion(index, question, selected) {
  return `
    <fieldset class="star-question" data-question="${index}">
      <legend>${question}</legend>
      <div class="stars" role="radiogroup" aria-label="${escapeHtml(question)}">
        ${[1, 2, 3, 4, 5]
          .map(
            (value) => `
              <button class="star ${Number(selected) >= value ? "active" : ""}" data-star="${index}:${value}" type="button" role="radio" aria-checked="${Number(selected) === value}" aria-label="${starAriaLabel(value)}">&#9733;</button>
            `,
          )
          .join("")}
      </div>
    </fieldset>
  `;
}

function starAriaLabel(value) {
  const labels = t();
  const meaning = value <= 2 ? labels.starLabels.one : value === 3 ? labels.starLabels.three : labels.starLabels.five;
  return `${value}/5 - ${meaning}`;
}

function renderResult() {
  const labels = t();
  const pathwayKey = state.progress.selectedPathway;
  if (!pathwayKey) return renderDashboard();
  const pathway = pathwayMap[pathwayKey];
  return pageShell(`
    <section class="result-page">
      <div class="result-visual">
        <span class="pill">${labels.resultTitle}</span>
        <h1>${pathway[state.language].level}</h1>
        <p>${pathway[state.language].explanation}</p>
      </div>
      <div class="result-details">
        <article class="metric-card">
          <span>${escapeHtml(state.childProfile?.name || "")}</span>
          <strong>${pathway[state.language].lesson}</strong>
        </article>
        ${progressBar(progressPercent())}
        <p class="disclaimer">${labels.resultDisclaimer}</p>
        <button class="primary" data-route="/lesson/${pathway.lessonId}" type="button">${labels.openLesson2}</button>
      </div>
    </section>
  `);
}

function renderProgressPage() {
  const labels = t();
  const pathway = state.progress.selectedPathway ? pathwayMap[state.progress.selectedPathway] : null;
  const completedCount = state.progress.completedLessonIds.length;
  const answeredQuestions = Object.values(state.assessments).reduce((sum, assessment) => {
    return sum + Object.keys(assessment.answers || {}).length;
  }, 0);
  const direction = pathway ? pathway[state.language].level : labels.lessonPathway;
  const nextId = nextLessonId();
  const next = completedCount >= lessonOrder.length ? null : lessons[nextId];
  const remaining = Math.max(0, lessonOrder.length - completedCount);
  const journeyTitle = completedCount >= lessonOrder.length
    ? labels.progressAfterTwelveTitle
    : completedCount >= 5
      ? labels.progressAfterFiveTitle
      : labels.progressJourneyTitle;
  const journeyText = completedCount >= lessonOrder.length
    ? labels.progressAfterTwelveText
    : completedCount >= 5
      ? labels.progressAfterFiveText
      : labels.progressJourneyText;
  return pageShell(`
    <section class="section-heading">
      <div>
        <div class="section-kicker">${labels.progress}</div>
        <h1>${labels.participation}</h1>
      </div>
    </section>
    <section class="metric-grid">
      ${metricCard(`${completedCount}/${lessonOrder.length}`, labels.completedTasks, progressBar(progressPercent()))}
      ${metricCard(next ? `${next.order}. ${next[state.language].title}` : "-", labels.nextLesson, "")}
      ${metricCard(direction, labels.currentDirection, "")}
    </section>
    <section class="timeline progress-journey">
      <div>
        <span class="pill">${labels.weeklyActivity}</span>
        <h2>${journeyTitle}</h2>
        <p>${journeyText}</p>
      </div>
      <div class="journey-stats">
        <span>${answeredQuestions} ${labels.parentObservation.toLowerCase()}</span>
        <span>${remaining} ${labels.remainingLessons.toLowerCase()}</span>
      </div>
      <div class="roadmap-grid" aria-label="${labels.roadmapTitle}">
        ${labels.roadmap
          .map(
            ([title, duration, text]) => `<article><strong>${title}</strong><span>${duration}</span><p>${text}</p></article>`,
          )
          .join("")}
      </div>
    </section>
    ${renderLessonList()}
  `);
}

function renderProfilePage() {
  const labels = t();
  const profile = state.childProfile;
  return pageShell(`
    <section class="section-heading">
      <div>
        <div class="section-kicker">${labels.profile}</div>
        <h1>${profile ? escapeHtml(profile.name) : labels.noProfile}</h1>
      </div>
      <button class="secondary" data-route="/onboarding" type="button">${labels.childProfile}</button>
    </section>
    ${
      profile
        ? `<section class="profile-grid">
            ${profileFact(labels.childAge, profile.age)}
            ${profileFact(labels.diagnosis, profile.diagnosis)}
            ${profileFact(labels.homeLanguage, profile.homeLanguage)}
            ${profileFact(labels.meaningfulWords, profile.meaningfulWords)}
          </section>`
        : ""
    }
    <section class="settings-band">
      <button class="danger" data-reset-demo type="button">${labels.resetDemo}</button>
    </section>
  `);
}

function profileFact(label, value) {
  return `
    <article class="metric-card">
      <span>${label}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `;
}

function renderNotFound() {
  return pageShell(`
    <section class="center-panel narrow">
      <h1>404</h1>
      <button class="primary" data-route="/dashboard" type="button">${t().backDashboard}</button>
    </section>
  `);
}

function guardRoute(pathname) {
  if (pathname === "/" || pathname === "/language") return pathname;
  if (!state.progress.onboardingCompleted && pathname !== "/onboarding") return "/language";
  if (pathname === "/lesson/lesson1" && !state.progress.parentIntroCompleted) return "/intro";
  if (pathname.startsWith("/lesson/")) {
    const lessonId = pathname.split("/").pop();
    if (!lessons[lessonId]) return "/dashboard";
    if (!state.progress.unlockedLessonIds.includes(lessonId)) return "/dashboard";
  }
  if (pathname === "/result" && !state.progress.lesson1AssessmentCompleted) return "/dashboard";
  if (pathname.startsWith("/assessment/")) {
    const lessonId = pathname.split("/").pop();
    if (!lessons[lessonId]) return "/dashboard";
    if (!state.progress.unlockedLessonIds.includes(lessonId)) return "/dashboard";
    if (lessonId === "lesson1" && !state.progress.lesson1Completed) return "/lesson/lesson1";
    const checks = state.activityChecks[lessonId] || {};
    const activities = lessons[lessonId]?.activities || [];
    if (!activities.every((activity) => checks[activity.id])) return `/lesson/${lessonId}`;
  }
  return pathname;
}

function render() {
  clearInterval(timerInterval);
  document.documentElement.lang = state.language;
  const requested = normalizePath(location.pathname);
  const guarded = guardRoute(requested);
  if (guarded !== requested) {
    window.history.replaceState({}, "", guarded);
  }
  const path = guarded;
  if (path === "/") app.innerHTML = renderLanding();
  else if (path === "/language") app.innerHTML = renderLanguagePage();
  else if (path === "/onboarding") app.innerHTML = renderOnboarding();
  else if (path === "/intro") app.innerHTML = renderParentIntro();
  else if (path === "/dashboard") app.innerHTML = renderDashboard();
  else if (path === "/lessons") app.innerHTML = renderLessonsPage();
  else if (path.startsWith("/lesson/")) app.innerHTML = renderLessonPage(path.split("/").pop());
  else if (path.startsWith("/assessment/")) app.innerHTML = renderAssessment(path.split("/").pop());
  else if (path === "/result") app.innerHTML = renderResult();
  else if (path === "/progress") app.innerHTML = renderProgressPage();
  else if (path === "/profile") app.innerHTML = renderProfilePage();
  else app.innerHTML = renderNotFound();

  mountForms();
  if (document.querySelector("[data-timer]")) {
    tickTimer();
    timerInterval = window.setInterval(tickTimer, 1000);
  }
}

function mountForms() {
  const form = document.getElementById("profile-form");
  if (form) {
    const submit = document.getElementById("profile-submit");
    const validate = () => {
      submit.disabled = !form.checkValidity();
    };
    form.addEventListener("input", validate);
    form.addEventListener("change", validate);
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const data = new FormData(form);
      state.childProfile = {
        name: String(data.get("name") || "").trim(),
        age: Number(data.get("age")),
        diagnosis: String(data.get("diagnosis") || ""),
        homeLanguage: String(data.get("homeLanguage") || ""),
        meaningfulWords: String(data.get("meaningfulWords") || ""),
      };
      state.progress.onboardingCompleted = true;
      saveState(state);
      routeTo("/intro");
    });
    validate();
  }

  const assessmentForm = document.getElementById("assessment-form");
  if (assessmentForm) {
    refreshAssessmentSubmit(assessmentForm);
    assessmentForm.addEventListener("submit", (event) => {
      event.preventDefault();
      submitAssessment(assessmentForm.dataset.assessment);
    });
  }
}

function refreshAssessmentSubmit(form) {
  const lessonId = form.dataset.assessment;
  const questions = form.querySelectorAll("[data-question]").length;
  const answers = state.assessments[lessonId]?.answers || {};
  const submit = document.getElementById("assessment-submit");
  if (submit) submit.disabled = Object.keys(answers).length < questions;
}

function submitAssessment(lessonId) {
  const answers = state.assessments[lessonId]?.answers || {};
  const next = getNextLessonId(lessonId);

  if (lessonId === "lesson1") {
    const scores = {
      interactionScore: Number(answers[1]),
      understandingScore: Number(answers[2]),
      requestScore: Number(answers[3]),
      speechScore: Number(answers[4]),
      regulationScore: Number(answers[5]),
    };
    const pathway = calculatePathway(scores);
    state.assessments.lesson1 = {
      ...state.assessments.lesson1,
      scores,
      selectedPathway: pathway,
      completedAt: new Date().toISOString(),
    };
    state.progress.lesson1AssessmentCompleted = true;
    state.progress.selectedPathway = pathway;
    state.progress.assignedLesson2 = next;
    state.progress.completedLessonIds = unique([...state.progress.completedLessonIds, lessonId]);
    state.progress.unlockedLessonIds = unique([...state.progress.unlockedLessonIds, next].filter(Boolean));
    saveState(state);
    routeTo("/result");
    return;
  }

  state.assessments[lessonId] = {
    ...state.assessments[lessonId],
    completedAt: new Date().toISOString(),
  };
  state.progress.completedLessonIds = unique([...state.progress.completedLessonIds, lessonId]);
  state.progress.unlockedLessonIds = unique([...state.progress.unlockedLessonIds, next].filter(Boolean));
  saveState(state);
  routeTo("/progress");
}

function unique(values) {
  return [...new Set(values)];
}

function normalizeState() {
  const valid = new Set(lessonOrder);
  state.progress.completedLessonIds = (state.progress.completedLessonIds || []).filter((lessonId) => valid.has(lessonId));
  state.progress.unlockedLessonIds = (state.progress.unlockedLessonIds || []).filter((lessonId) => valid.has(lessonId));
  if (!state.progress.unlockedLessonIds.includes("lesson1")) {
    state.progress.unlockedLessonIds.unshift("lesson1");
  }
  for (const lessonId of state.progress.completedLessonIds) {
    const next = getNextLessonId(lessonId);
    if (next) state.progress.unlockedLessonIds.push(next);
  }
  state.progress.unlockedLessonIds = unique(state.progress.unlockedLessonIds);
}

function handleClick(event) {
  const route = event.target.closest("[data-route]");
  if (route) {
    event.preventDefault();
    routeTo(route.dataset.route);
    return;
  }

  const lang = event.target.closest("[data-lang]");
  if (lang) {
    setLanguage(lang.dataset.lang);
    return;
  }

  const pickLang = event.target.closest("[data-pick-language]");
  if (pickLang) {
    setLanguage(pickLang.dataset.pickLanguage);
    routeTo("/onboarding");
    return;
  }

  if (event.target.closest("[data-start-intro]")) {
    state.progress.parentIntroCompleted = true;
    saveState(state);
    routeTo("/lesson/lesson1");
    return;
  }

  const star = event.target.closest("[data-star]");
  if (star) {
    const [question, value] = star.dataset.star.split(":");
    const form = star.closest("[data-assessment]");
    const lessonId = form.dataset.assessment;
    state.assessments[lessonId] = state.assessments[lessonId] || { answers: {} };
    state.assessments[lessonId].answers[question] = Number(value);
    saveState(state);
    render();
    return;
  }

  const start = event.target.closest("[data-timer-start]");
  if (start) {
    setTimer(start.dataset.timerStart, {
      started: true,
      paused: false,
      durationSeconds: getLessonDurationSeconds(start.dataset.timerStart),
      remainingWhenPaused: getLessonDurationSeconds(start.dataset.timerStart),
      startedAt: Date.now(),
    });
    render();
    return;
  }

  const pause = event.target.closest("[data-timer-pause]");
  if (pause) {
    const lessonId = pause.dataset.timerPause;
    const timer = getTimer(lessonId);
    setTimer(lessonId, {
      ...timer,
      paused: true,
      remainingWhenPaused: getRemaining(timer),
      startedAt: null,
    });
    render();
    return;
  }

  const resume = event.target.closest("[data-timer-resume]");
  if (resume) {
    const lessonId = resume.dataset.timerResume;
    const timer = getTimer(lessonId);
    setTimer(lessonId, { ...timer, paused: false, startedAt: Date.now() });
    render();
    return;
  }

  const skip = event.target.closest("[data-timer-skip]");
  if (skip) {
    const lessonId = skip.dataset.timerSkip;
    setTimer(lessonId, {
      started: true,
      paused: true,
      durationSeconds: getLessonDurationSeconds(lessonId),
      remainingWhenPaused: 0,
      startedAt: null,
    });
    render();
    return;
  }

  const finish = event.target.closest("[data-finish-lesson]");
  if (finish && !finish.disabled) {
    const lessonId = finish.dataset.finishLesson;
    if (lessonId === "lesson1") {
      state.progress.lesson1Completed = true;
      saveState(state);
      routeTo("/assessment/lesson1");
      return;
    }
    routeTo(`/assessment/${lessonId}`);
    return;
  }

  if (event.target.closest("[data-reset-demo]")) {
    if (window.confirm(t().resetConfirm)) {
      resetState();
      state = loadState();
      routeTo("/");
    }
  }
}

function handleChange(event) {
  const check = event.target.closest("[data-activity-check]");
  if (!check) return;
  const [lessonId, activityId] = check.dataset.activityCheck.split(":");
  state.activityChecks[lessonId] = state.activityChecks[lessonId] || {};
  state.activityChecks[lessonId][activityId] = check.checked;
  saveState(state);
  render();
}

window.addEventListener("popstate", render);
document.addEventListener("click", handleClick);
document.addEventListener("change", handleChange);

normalizeState();
render();
