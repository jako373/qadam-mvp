import {
  ageOptions,
  appUi,
  diagnosisOptions,
  homeLanguageOptions,
  wordOptions,
} from "./data/app-data.js";
import { landingImages } from "./landing-images.js";
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
import { handlePaymentClick, handlePaymentFile } from "./payments.js";

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
    access: globalThis.qadamAuth?.getAccess?.() || { access_tier: "standard", role: "parent" },
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
  const showUtility = !showNav && options.utility !== false;
  return `
    <div class="app-shell ${showNav ? "with-nav" : showUtility ? "with-utility-nav" : ""}">
      ${showNav ? renderTopNav() : showUtility ? renderUtilityNav() : ""}
      <main class="page">${content}</main>
      ${showNav ? renderBottomNav() : ""}
    </div>
  `;
}

function renderUtilityNav() {
  const labels = t();
  return `
    <header class="utility-nav">
      <a class="utility-home" href="/" aria-label="${labels.homeAria}">
        ${icon("house")}<span>${labels.brand}</span>
      </a>
      <div class="utility-actions">
        ${renderSuperadminModeSwitch()}
        <button class="subscription-chip" data-route="/subscription" type="button">${icon("sparkles")}<span>${state.language === "ru" ? "Подписка" : "Жазылым"}</span></button>
        ${renderLanguageSwitcher(true)}
        <div data-account-controls-mount></div>
      </div>
    </header>
  `;
}

function renderSuperadminModeSwitch() {
  if (globalThis.qadamAuth?.getAccess?.().role !== "superadmin") return "";
  const label = state.language === "ru" ? "Кабинет суперадмина" : "Суперадмин кабинеті";
  return `<a class="superadmin-mode-switch" href="/admin" aria-label="${label}">${icon("layout-dashboard")}<span>${label}</span></a>`;
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

function renderHeaderActions(scope = "app") {
  const labels = t();
  const menuId = `${scope}-mobile-menu`;
  return `
    <div class="header-actions-desktop">
      ${renderSuperadminModeSwitch()}
      <button class="subscription-chip" data-route="/subscription" type="button">${icon("sparkles")}<span>${state.language === "ru" ? "Подписка" : "Жазылым"}</span></button>
      ${renderLanguageSwitcher(true)}
      <div data-account-controls-mount></div>
    </div>
    <button
      class="header-menu-toggle"
      data-header-menu-toggle
      type="button"
      aria-expanded="false"
      aria-controls="${menuId}"
      aria-label="${escapeHtml(labels.mobileNavigation)}"
    >${icon("menu", "header-menu-icon")}</button>
    <div id="${menuId}" class="header-mobile-menu" data-header-menu-panel hidden>
      ${renderSuperadminModeSwitch()}
      <button class="subscription-chip" data-route="/subscription" type="button">${icon("sparkles")}<span>${state.language === "ru" ? "Подписка" : "Жазылым"}</span></button>
      ${renderLanguageSwitcher(true)}
      <div data-account-controls-mount></div>
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
      ${renderHeaderActions("app")}
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
  const landing = labels.landing;
  const hasProfile = Boolean(state.progress.onboardingCompleted);
  const heroImageAlt = state.language === "kk"
    ? "Ата-анасымен бірге үйде ойын жаттығуын орындап отырған бала"
    : "Ребёнок выполняет игровое упражнение дома вместе с родителем";
  const activityImageAlt = state.language === "kk"
    ? "Ата-ана мен бала түрлі түсті бөлшектермен бірге ойнап отыр"
    : "Родитель и ребёнок вместе играют с цветными деталями";
  const howImageAlt = state.language === "kk"
    ? "Әкесі мен баласы үйдегі ойынға керек заттарды бірге дайындап отыр"
    : "Отец и ребёнок вместе готовят материалы для домашней игры";
  const progressImageAlt = state.language === "kk"
    ? "Бала ата-анасымен бірге шағын жетістігін белгілеп отыр"
    : "Ребёнок вместе с родителем отмечает небольшой прогресс";
  const trustImageAlt = state.language === "kk"
    ? "Анасы баласын оның көз деңгейінде мұқият тыңдап отыр"
    : "Мама внимательно слушает ребёнка на уровне его глаз";
  const ctaImageAlt = state.language === "kk"
    ? "Отбасы үйде бірге қысқа ойын жаттығуын орындап отыр"
    : "Семья вместе выполняет короткое игровое упражнение дома";
  return pageShell(
    `
      <div class="landing-page">
        <section class="landing-hero" aria-labelledby="landing-title">
          <div class="landing-orb landing-orb-one" aria-hidden="true"></div>
          <div class="landing-orb landing-orb-two" aria-hidden="true"></div>
          <div class="landing-container">
            <header class="landing-brand-row">
              <a class="landing-brand" href="/" aria-label="${labels.homeAria}"><span>Q</span><strong>${labels.brand}</strong></a>
              ${renderHeaderActions("landing")}
            </header>
            <div class="landing-hero-grid">
              <div class="landing-hero-copy">
              <div class="landing-eyebrow">${icon("heart-handshake", "landing-eyebrow-icon")}<span>${landing.eyebrow}</span></div>
              <div class="landing-proof-badge">${icon("badge-check", "landing-proof-icon")}<span>${landing.proofBadge}</span></div>
              <h1 id="landing-title">${labels.landingTitle}</h1>
              <p class="landing-lead">${labels.landingText}</p>
              <div class="landing-hero-actions">
                <a class="landing-primary" href="${hasProfile ? "/today" : "/register"}"><span>${hasProfile ? labels.continue : labels.start}</span>${icon("arrow-right")}</a>
                <a class="landing-secondary" href="#how-it-works">${landing.secondaryCta}${icon("arrow-down", "landing-link-icon")}</a>
              </div>
              <div class="landing-reassurance" aria-label="${landing.noCard}. ${landing.calmStart}">
                <span>${icon("shield-check", "landing-check-icon")}${landing.noCard}</span>
                <span>${icon("clock-3", "landing-check-icon")}${landing.calmStart}</span>
              </div>
            </div>
            <div class="landing-preview" aria-label="${landing.previewLabel}">
              <div class="preview-glow" aria-hidden="true"></div>
              <figure class="landing-family-visual">
                <img src="${landingImages.hero}" alt="${heroImageAlt}" width="1122" height="1402" fetchpriority="high" decoding="async">
              </figure>
              <article class="plan-preview-card">
                <header>
                  <div><span>${landing.previewLabel}</span><h2>${landing.previewTitle}</h2></div>
                  <div class="preview-day">1</div>
                </header>
                <div class="preview-progress"><i></i></div>
                <ol>
                  ${landing.previewItems.map((item, index) => `<li><span>${index + 1}</span><div><strong>${item}</strong><small>${landing.previewMeta[index]}</small></div>${icon(index === 0 ? "play" : "lock-keyhole", "preview-row-icon")}</li>`).join("")}
                </ol>
                <div class="preview-parent-note">${icon("message-circle-heart", "preview-note-icon")}<span>${labels.benefits[1][1]}</span></div>
              </article>
            </div>
          </div>
          </div>
        </section>

        <section class="landing-stats" aria-label="${landing.proofBadge}">
          <div class="landing-container landing-stats-grid">
            ${landing.stats.map(([value, label]) => `<div><strong>${value}</strong><span>${label}</span></div>`).join("")}
          </div>
        </section>

        <section class="landing-section landing-reveal">
          <div class="landing-container pain-grid">
            <div class="landing-section-copy">
              <span class="landing-kicker">${landing.painEyebrow}</span>
              <h2>${landing.painTitle}</h2>
              <p>${landing.painText}</p>
            </div>
            <div class="contrast-visual-stack">
              <figure class="landing-activity-visual">
                <img src="${landingImages.activity}" alt="${activityImageAlt}" width="1536" height="1024" loading="lazy" decoding="async">
              </figure>
              <div class="contrast-cards">
                ${landing.painCards.map(([title, text], index) => `<article class="contrast-card ${index === 1 ? "is-after" : ""}">${icon(index === 0 ? "circle-help" : "sparkles", "contrast-icon")}<div><span>${title}</span><p>${text}</p></div></article>`).join("")}
              </div>
            </div>
          </div>
        </section>

        <section id="how-it-works" class="landing-section landing-section-tint landing-reveal" aria-labelledby="how-title">
          <div class="landing-container">
            <div class="landing-section-head"><span class="landing-kicker">${landing.howEyebrow}</span><h2 id="how-title">${landing.howTitle}</h2></div>
            <figure class="landing-wide-visual how-visual">
              <img src="${landingImages.how}" alt="${howImageAlt}" width="1536" height="1024" loading="lazy" decoding="async">
            </figure>
            <div class="landing-steps">
              ${landing.steps.map(([number, title, text]) => `<article><span class="step-number">${number}</span><h3>${title}</h3><p>${text}</p></article>`).join("")}
            </div>
          </div>
        </section>

        <section class="landing-section landing-reveal">
          <div class="landing-container value-layout">
            <div class="landing-section-copy">
              <span class="landing-kicker">${landing.valueEyebrow}</span>
              <h2>${landing.valueTitle}</h2>
              <p>${landing.valueText}</p>
              <a class="landing-text-link" href="/register">${landing.finalCta}${icon("arrow-up-right", "landing-link-icon")}</a>
            </div>
            <div class="value-visual-stack">
              <figure class="landing-wide-visual progress-visual">
                <img src="${landingImages.progress}" alt="${progressImageAlt}" width="1536" height="1024" loading="lazy" decoding="async">
              </figure>
              <div class="value-cards">
                ${landing.values.map(([iconName, title, text]) => `<article>${icon(iconName, "value-icon")}<div><h3>${title}</h3><p>${text}</p></div></article>`).join("")}
              </div>
            </div>
          </div>
        </section>

        <section class="landing-trust landing-reveal">
          <div class="landing-container trust-card">
            <figure class="trust-visual">
              <img src="${landingImages.trust}" alt="${trustImageAlt}" width="1536" height="1024" loading="lazy" decoding="async">
            </figure>
            <div class="trust-copy"><div class="trust-icon-wrap">${icon("shield-plus", "trust-icon")}</div><div><h2>${landing.trustTitle}</h2><p>${landing.trustText}</p></div></div>
          </div>
        </section>

        <section class="landing-section landing-reveal" aria-labelledby="faq-title">
          <div class="landing-container faq-layout">
            <div class="landing-section-copy"><span class="landing-kicker">${landing.faqEyebrow}</span><h2 id="faq-title">${landing.faqTitle}</h2><p>${labels.disclaimer}</p></div>
            <div class="faq-list">
              ${landing.faq.map(([question, answer]) => `<details><summary><span>${question}</span>${icon("plus", "faq-icon")}</summary><p>${answer}</p></details>`).join("")}
            </div>
          </div>
        </section>

        <section class="landing-final landing-reveal">
          <div class="landing-container final-card">
            <figure class="final-visual">
              <img src="${landingImages.cta}" alt="${ctaImageAlt}" width="1672" height="941" loading="lazy" decoding="async">
            </figure>
            <div class="final-copy"><span class="landing-kicker">${landing.finalEyebrow}</span><h2>${landing.finalTitle}</h2><p>${landing.finalText}</p><div class="landing-final-actions"><a class="landing-primary landing-primary-light" href="/register"><span>${landing.finalCta}</span>${icon("arrow-right")}</a><span>${landing.noCard}</span></div></div>
          </div>
        </section>
      </div>
    `,
    { nav: false, utility: false },
  );
}

function mountLandingMotion() {
  const items = [...document.querySelectorAll(".landing-reveal")];
  if (!items.length) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add("is-visible");
      observer.unobserve(entry.target);
    });
  }, { threshold: 0.12 });
  items.forEach((item) => observer.observe(item));
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
  const fieldIcons = { name: "user-round", bestTime: "sun-medium" };
  const placeholders = state.language === "ru"
    ? { name: "Например, Айсултан", bestTime: "Например, утром или после дневного сна" }
    : { name: "Мысалы, Айсұлтан", bestTime: "Мысалы, таңертең немесе түскі ұйқыдан кейін" };
  return `
    <label class="field">
      <span class="field-label">${icon(fieldIcons[name] || "circle", "field-label-icon")}<b>${label}</b></span>
      <input name="${name}" type="${type}" value="${escapeHtml(value)}" placeholder="${escapeHtml(placeholders[name] || "")}" ${required ? "required" : ""} maxlength="${maxLength}" autocomplete="${autocomplete}" />
    </label>
  `;
}

function textareaField(name, label, value) {
  const fieldIcons = { interests: "sparkles", dislikes: "shield-alert" };
  const placeholders = state.language === "ru"
    ? { interests: "Игрушки, музыка, любимые занятия…", dislikes: "Громкие звуки, ожидание, новые места…" }
    : { interests: "Ойыншықтар, әуендер, сүйікті істері…", dislikes: "Қатты дыбыс, күту, жаңа орындар…" };
  return `
    <label class="field">
      <span class="field-label">${icon(fieldIcons[name] || "message-square", "field-label-icon")}<b>${label}</b></span>
      <textarea name="${name}" maxlength="240" rows="3" placeholder="${escapeHtml(placeholders[name] || "")}">${escapeHtml(value)}</textarea>
    </label>
  `;
}

function selectField(name, label, options, value) {
  const fieldIcons = { age: "cake-slice", diagnosis: "clipboard-heart", homeLanguage: "languages", meaningfulWords: "message-circle-more" };
  const emptyLabel = state.language === "ru" ? "Выберите вариант" : "Нұсқаны таңдаңыз";
  return `
    <label class="field">
      <span class="field-label">${icon(fieldIcons[name] || "list-filter", "field-label-icon")}<b>${label}</b></span>
      <select name="${name}" required>
        <option value="">${emptyLabel}</option>
        ${options.map((option) => `<option value="${escapeHtml(option)}" ${String(value) === String(option) ? "selected" : ""}>${escapeHtml(option)}</option>`).join("")}
      </select>
    </label>
  `;
}

function renderOnboarding() {
  const labels = t();
  const adaptiveLabels = adaptiveUi[state.language];
  const profile = state.childProfile || {};
  const copy = state.language === "ru"
    ? {
        kicker: "Основа персонального плана",
        intro: "Ответьте на несколько вопросов — и мы подберём подходящий старт.",
        progress: "Профиль заполнен",
        mainTitle: "Основные сведения",
        mainText: "Только то, что нужно для первого плана",
        comfortTitle: "Дополнить профиль",
        comfortText: "Интересы, сложности и удобное время",
        optional: "Необязательно",
        privacyTitle: "Данные под вашим контролем",
        privacyText: "Используем только для личного плана.",
      }
    : {
        kicker: "Жеке жоспардың негізі",
        intro: "Бірнеше сұраққа жауап беріңіз — біз қолайлы бастауды таңдаймыз.",
        progress: "Профиль толтырылды",
        mainTitle: "Негізгі мәліметтер",
        mainText: "Алғашқы жоспарға қажет мәліметтер",
        comfortTitle: "Профильді толықтыру",
        comfortText: "Қызығушылық, қиындық және ыңғайлы уақыт",
        optional: "Міндетті емес",
        privacyTitle: "Деректер сіздің бақылауыңызда",
        privacyText: "Тек жеке жоспар үшін қолданамыз.",
      };
  const hasComfortDetails = Boolean(profile.interests || profile.dislikes || profile.bestTime);
  return pageShell(
    `
      <section class="center-panel profile-setup">
        <header class="profile-setup-head">
          <div class="profile-setup-copy">
            <div class="section-kicker">${copy.kicker}</div>
            <h1>${labels.childProfile}</h1>
            <p>${copy.intro}</p>
          </div>
          <div class="child-profile-orb" aria-hidden="true">
            <span>${icon("heart-handshake")}</span>
            <i></i><i></i>
          </div>
        </header>
        <div class="profile-progress" role="status" aria-live="polite">
          <div><span>${copy.progress}</span><strong data-profile-progress-value>0/6</strong></div>
          <div class="profile-progress-track"><span data-profile-progress-bar></span></div>
        </div>
        <form id="profile-form" class="profile-form">
          <fieldset class="profile-form-section">
            <legend>
              <span>${icon("contact-round")}</span>
              <span><strong>${copy.mainTitle}</strong><small>${copy.mainText}</small></span>
            </legend>
            <div class="profile-core-grid">
              ${inputField("name", labels.childName, "text", profile.name || "", true)}
              ${selectField("age", labels.childAge, ageOptions, profile.age || "")}
              ${selectField("diagnosis", labels.diagnosis, diagnosisOptions, profile.diagnosis || "")}
              ${selectField("homeLanguage", labels.homeLanguage, homeLanguageOptions, profile.homeLanguage || "")}
              <div class="profile-words-field">${selectField("meaningfulWords", labels.meaningfulWords, wordOptions, profile.meaningfulWords || "")}</div>
            </div>
          </fieldset>
          <details class="profile-form-section profile-comfort-section" ${hasComfortDetails ? "open" : ""}>
            <summary>
              <span>${icon("wand-sparkles")}</span>
              <span><strong>${copy.comfortTitle}</strong><small>${copy.comfortText}</small></span>
              <em>${copy.optional}</em>
              ${icon("chevron-down", "profile-disclosure-chevron")}
            </summary>
            <div class="profile-insight-grid">
              ${textareaField("interests", adaptiveLabels.interests, profile.interests || "")}
              ${textareaField("dislikes", adaptiveLabels.dislikes, profile.dislikes || "")}
              <div class="profile-best-time">${inputField("bestTime", adaptiveLabels.bestTime, "text", profile.bestTime || "", false)}</div>
            </div>
          </details>
          <div class="profile-form-footer">
            <label class="profile-consent">
              <input id="consent" name="consent" type="checkbox" required />
              <span class="profile-consent-icon">${icon("shield-check")}</span>
              <span><strong>${copy.privacyTitle}</strong><small>${copy.privacyText} ${adaptiveLabels.consent}</small></span>
            </label>
            <button id="profile-submit" class="primary profile-submit" type="submit" disabled>
              ${icon("arrow-right")}<span>${adaptiveLabels.saveProfile}</span>
            </button>
          </div>
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
  const superadminCatalogAccess = Boolean(
    globalThis.qadamAuth?.canBrowseCatalogWithoutOnboarding?.()
      && (pathname === "/library" || pathname.startsWith("/library/")),
  );
  if (["/lessons", "/intro", "/result"].includes(pathname) || pathname.startsWith("/lesson/") || pathname.startsWith("/assessment/")) {
    return state.progress.onboardingCompleted ? "/library" : "/language";
  }
  if (pathname === "/dashboard") return state.progress.onboardingCompleted ? "/today" : "/language";
  if (["/", "/language", "/onboarding"].includes(pathname)) return pathname;
  if (superadminCatalogAccess) return pathname;
  if (!state.progress.onboardingCompleted) return "/language";
  return guardAdaptiveRoute(pathname, state, globalThis.qadamAuth?.getAccess?.() || {}) || pathname;
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
  mountLandingMotion();
}

function mountProfileForm() {
  const form = document.getElementById("profile-form");
  if (!form) return;
  const submit = document.getElementById("profile-submit");
  const validate = () => {
    submit.disabled = !form.checkValidity();
    const requiredFields = [...form.querySelectorAll("[required]")];
    const completed = requiredFields.filter((field) => field.type === "checkbox" ? field.checked : Boolean(field.value.trim())).length;
    const progressValue = form.parentElement.querySelector("[data-profile-progress-value]");
    const progressBar = form.parentElement.querySelector("[data-profile-progress-bar]");
    if (progressValue) progressValue.textContent = `${completed}/${requiredFields.length}`;
    if (progressBar) progressBar.style.width = `${(completed / requiredFields.length) * 100}%`;
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

async function handleClick(event) {
  const menuToggle = event.target.closest("[data-header-menu-toggle]");
  if (menuToggle) {
    const menuId = menuToggle.getAttribute("aria-controls");
    const panel = menuId ? document.getElementById(menuId) : null;
    if (!panel) return;
    const willOpen = panel.hidden;
    panel.hidden = !willOpen;
    menuToggle.setAttribute("aria-expanded", String(willOpen));
    return;
  }

  if (await handlePaymentClick(event, adaptiveContext())) return;
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

async function handleFormInput(event) {
  if (await handlePaymentFile(event, adaptiveContext())) return;
  handleAdaptiveInput(event);
}

window.addEventListener("popstate", render);
document.addEventListener("click", handleClick);
document.addEventListener("change", handleFormInput);
document.addEventListener("input", handleFormInput);

normalizeState();
render();
