import {
  ageOptions,
  appUi,
  diagnosisOptions,
  homeLanguageOptions,
  wordOptions,
} from "./data/app-data.js";
import { adaptiveUi } from "./data/adaptive-ui.js";
import {
  applyLibraryFilters,
  getAdaptiveNav,
  guardAdaptiveRoute,
  handleAdaptiveClick,
  handleAdaptiveInput,
  renderAdaptiveRoute,
} from "./adaptive-flow.js";
import { loadState, resetState, saveState } from "./storage.js";

let state = loadState();

const app = document.getElementById("app");

function t() {
  return appUi[state.language];
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function icon(name, className = "button-icon") {
  return `<i class="${className}" data-lucide="${name}" aria-hidden="true"></i>`;
}

function mountIcons() {
  if (!globalThis.lucide?.createIcons) return;
  globalThis.lucide.createIcons({
    attrs: {
      "stroke-width": 2,
      "aria-hidden": "true",
    },
  });
}

function routeTo(path) {
  window.history.pushState({}, "", path);
  render();
}

function setLanguage(language) {
  state.language = language === "ru" ? "ru" : "kk";
  saveState(state);
  document.documentElement.lang = state.language;
  render();
}

function adaptiveContext() {
  return {
    state,
    pageShell,
    escapeHtml,
    icon,
    saveState,
    routeTo,
    render,
  };
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

function renderLanguageSwitcher(compact = false) {
  const labels = t();
  return `
    <div class="lang-switch ${compact ? "compact" : ""}" aria-label="${labels.languageSwitcher}">
      <button class="${state.language === "kk" ? "active" : ""}" data-lang="kk" type="button">Қазақша</button>
      <button class="${state.language === "ru" ? "active" : ""}" data-lang="ru" type="button">Русский</button>
    </div>
  `;
}

function navButton(path, iconName, label) {
  const active = normalizePath(location.pathname) === path;
  return `
    <button class="nav-item ${active ? "active" : ""}" data-route="${path}" type="button" aria-label="${escapeHtml(label)}" ${active ? 'aria-current="page"' : ""}>
      ${icon(iconName, "nav-icon")}
      <span>${escapeHtml(label)}</span>
    </button>
  `;
}

function renderTopNav() {
  const labels = t();
  return `
    <header class="top-nav">
      <button class="brand-mark" data-route="/today" type="button" aria-label="${labels.homeAria}">
        <span>Q</span>
        <strong>${labels.brand}</strong>
      </button>
      <nav aria-label="${labels.primaryNavigation}">
        ${getAdaptiveNav(state.language).map(([path, iconName, label]) => navButton(path, iconName, label)).join("")}
      </nav>
      ${renderLanguageSwitcher(true)}
    </header>
  `;
}

function renderBottomNav() {
  return `
    <nav class="bottom-nav" aria-label="${t().mobileNavigation}">
      ${getAdaptiveNav(state.language).map(([path, iconName, label]) => navButton(path, iconName, label)).join("")}
    </nav>
  `;
}

function normalizePath(path) {
  return path === "" ? "/" : path;
}

function renderLanding() {
  const labels = t();
  const hasProfile = Boolean(state.progress.onboardingCompleted);
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
            <button class="primary" data-route="${hasProfile ? "/today" : "/language"}" type="button">
              <span>${hasProfile ? labels.continue : labels.start}</span>${icon("arrow-right")}
            </button>
            ${hasProfile ? `
              <button class="secondary" data-new-profile type="button">
                ${icon("rotate-ccw")}<span>${labels.resetProfile}</span>
              </button>
            ` : ""}
            ${renderLanguageSwitcher(true)}
          </div>
        </div>
      </section>
      <section class="band benefits-band" aria-label="${labels.benefitsAria}">
        <div class="content-grid three">
          ${labels.benefits.map(([title, text], index) => `
            <article class="benefit-card">
              ${icon(["target", "list-checks", "heart-handshake"][index], "benefit-icon")}
              <strong>${title}</strong>
              <p>${text}</p>
            </article>
          `).join("")}
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

function inputField(name, label, type, value, required) {
  const autocomplete = name === "name" ? "name" : "off";
  const maxLength = name === "name" ? 80 : 160;
  return `
    <label class="field">
      <span>${label}</span>
      <input name="${name}" type="${type}" value="${escapeHtml(value)}" ${required ? "required" : ""} maxlength="${maxLength}" autocomplete="${autocomplete}" />
    </label>
  `;
}

function textareaField(name, label, value) {
  return `
    <label class="field full">
      <span>${label}</span>
      <textarea name="${name}" maxlength="240" rows="3">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function selectField(name, label, options, value) {
  return `
    <label class="field">
      <span>${label}</span>
      <select name="${name}" required>
        <option value=""></option>
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderOnboarding() {
  const labels = t();
  const adaptiveLabels = adaptiveUi[state.language];
  const profile = state.childProfile || {};
  return pageShell(
    `
      <section class="center-panel profile-setup">
        <div class="section-kicker">${labels.brand}</div>
        <h1>${labels.childProfile}</h1>
        <form id="profile-form" class="form-grid">
          ${inputField("name", labels.childName, "text", profile.name || "", true)}
          ${selectField("age", labels.childAge, ageOptions, profile.age || "")}
          ${selectField("diagnosis", labels.diagnosis, diagnosisOptions, profile.diagnosis || "")}
          ${selectField("homeLanguage", labels.homeLanguage, homeLanguageOptions, profile.homeLanguage || "")}
          ${selectField("meaningfulWords", labels.meaningfulWords, wordOptions, profile.meaningfulWords || "")}
          ${textareaField("interests", adaptiveLabels.interests, profile.interests || "")}
          ${textareaField("dislikes", adaptiveLabels.dislikes, profile.dislikes || "")}
          ${inputField("bestTime", adaptiveLabels.bestTime, "text", profile.bestTime || "", false)}
          <label class="check-row full">
            <input id="consent" name="consent" type="checkbox" required />
            <span>${adaptiveLabels.consent}</span>
          </label>
          <button id="profile-submit" class="primary full" type="submit" disabled>
            ${icon("save")}<span>${adaptiveLabels.saveProfile}</span>
          </button>
        </form>
      </section>
    `,
    { nav: false },
  );
}

function renderNotFound() {
  return pageShell(`
    <section class="adaptive-center">
      ${icon("map-pin-off", "empty-state-icon")}
      <h1>${t().notFound}</h1>
      <button class="primary" data-route="/today" type="button">${icon("house")}<span>${t().backHome}</span></button>
    </section>
  `);
}

function guardRoute(pathname) {
  if (["/lessons", "/intro", "/result"].includes(pathname) || pathname.startsWith("/lesson/") || pathname.startsWith("/assessment/")) {
    return state.progress.onboardingCompleted ? "/library" : "/language";
  }
  if (pathname === "/dashboard") return state.progress.onboardingCompleted ? "/today" : "/language";
  if (["/", "/language", "/onboarding"].includes(pathname)) return pathname;
  if (!state.progress.onboardingCompleted) return "/language";
  return guardAdaptiveRoute(pathname, state) || pathname;
}

function render() {
  document.documentElement.lang = state.language;
  const requested = normalizePath(location.pathname);
  const guarded = guardRoute(requested);
  if (guarded !== requested) window.history.replaceState({}, "", guarded);

  const adaptiveHtml = renderAdaptiveRoute(guarded, adaptiveContext());
  if (adaptiveHtml !== null) app.innerHTML = adaptiveHtml;
  else if (guarded === "/") app.innerHTML = renderLanding();
  else if (guarded === "/language") app.innerHTML = renderLanguagePage();
  else if (guarded === "/onboarding") app.innerHTML = renderOnboarding();
  else app.innerHTML = renderNotFound();

  mountProfileForm();
  applyLibraryFilters();
  mountIcons();
}

function mountProfileForm() {
  const form = document.getElementById("profile-form");
  if (!form) return;
  const submit = document.getElementById("profile-submit");
  const validate = () => {
    submit.disabled = !form.checkValidity();
  };
  form.addEventListener("input", validate);
  form.addEventListener("change", validate);
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }
    const data = new FormData(form);
    const age = Number(data.get("age"));
    const diagnosis = String(data.get("diagnosis") || "");
    const homeLanguage = String(data.get("homeLanguage") || "");
    const meaningfulWords = String(data.get("meaningfulWords") || "");
    if (!ageOptions.includes(age) || !diagnosisOptions.includes(diagnosis) || !homeLanguageOptions.includes(homeLanguage) || !wordOptions.includes(meaningfulWords)) return;

    state.childProfile = {
      name: String(data.get("name") || "").trim(),
      age,
      diagnosis,
      homeLanguage,
      meaningfulWords,
      interests: String(data.get("interests") || "").trim(),
      dislikes: String(data.get("dislikes") || "").trim(),
      bestTime: String(data.get("bestTime") || "").trim(),
    };
    state.progress.onboardingCompleted = true;
    saveState(state);
    routeTo(state.adaptive.initialAssessment.completedAt ? "/today" : "/skill-check");
  });
  validate();
}

function normalizeState() {
  if (state.childProfile?.diagnosis === "ОНР") {
    state.childProfile = {
      ...state.childProfile,
      diagnosis: "ОНР 1-4 (нақтылау керек / нужно уточнить)",
    };
  }
  const profile = state.childProfile;
  const valid =
    profile &&
    typeof profile.name === "string" &&
    profile.name.trim().length > 0 &&
    ageOptions.includes(Number(profile.age)) &&
    diagnosisOptions.includes(profile.diagnosis) &&
    homeLanguageOptions.includes(profile.homeLanguage) &&
    wordOptions.includes(profile.meaningfulWords);
  if (!valid) {
    state.childProfile = null;
    state.progress.onboardingCompleted = false;
  }
  saveState(state);
}

function handleClick(event) {
  if (handleAdaptiveClick(event, adaptiveContext())) return;

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
  const pickLanguage = event.target.closest("[data-pick-language]");
  if (pickLanguage) {
    state.language = pickLanguage.dataset.pickLanguage === "ru" ? "ru" : "kk";
    saveState(state);
    routeTo("/onboarding");
    return;
  }
  if (event.target.closest("[data-new-profile], [data-reset-demo]")) {
    if (window.confirm(t().resetConfirm)) {
      resetState();
      state = loadState();
      routeTo("/language");
    }
  }
}

function handleFormInput(event) {
  handleAdaptiveInput(event);
}

window.addEventListener("popstate", render);
document.addEventListener("click", handleClick);
document.addEventListener("change", handleFormInput);
document.addEventListener("input", handleFormInput);

normalizeState();
render();
