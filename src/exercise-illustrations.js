const CATEGORY_PALETTES = {
  joint_attention: ["#2f8b80", "#f3b37f", "#d8f0e9"],
  understanding: ["#3975a6", "#efb864", "#dfeefa"],
  imitation: ["#7b67a8", "#ef9a7c", "#eee8f7"],
  communication: ["#c76551", "#efc35d", "#fae8df"],
  play_thinking: ["#347f75", "#d99a55", "#def2ea"],
  fine_motor: ["#9b627f", "#e8af5b", "#f4e5ed"],
  regulation: ["#4c7fa0", "#79b9a7", "#e2f1f4"],
  daily_social: ["#447568", "#d58a62", "#e5f0e9"],
};

const SCENE_RULES = [
  ["hand_wash", /мыть рук|мытья рук/i],
  ["scissors", /ножниц|резат/i],
  ["tweezers", /пинцет/i],
  ["clothespin", /прищеп/i],
  ["button", /пуговиц/i],
  ["screw", /винт|закрут/i],
  ["beads", /бусин|наниз/i],
  ["clay", /пластилин/i],
  ["paper", /бумаг|линии|линию|точк|наклейк/i],
  ["puzzle", /пазл|форму на место|сортер/i],
  ["blocks", /кубик|башн|строить/i],
  ["book", /книг/i],
  ["cards", /картин|фотограф|эмоци|состояни|событи/i],
  ["doll", /кукл/i],
  ["car", /машинк/i],
  ["ball", /мяч|шарик/i],
  ["spoon", /ложк/i],
  ["chair", /стул/i],
  ["box", /короб|контейнер|мешоч/i],
  ["pillow", /подуш/i],
  ["wall", /стен/i],
  ["clothes", /одежд|носок|полотенц|свою вещь/i],
  ["timer", /таймер|подожд|ожидани/i],
  ["table", /стол/i],
  ["sound", /звук|хлоп|ритм|слово|поздоров|до свидания/i],
  ["sorting", /цвет|больш|малень|пар|лишн|признак|правил|разделить|сортир/i],
  ["movement", /прыж|движен|походк|поднять руки|покач|перенести|подойди|пойти/i],
  ["choice", /выб|попрос|показать|кому дать|разрешен|чувств/i],
  ["calm", /успоко|расслаб|медленно дуть|тихий уголок|обнять/i],
  ["toy", /игруш|предмет|игр/i],
];

function hash(value) {
  let result = 17;
  for (const character of String(value)) result = ((result * 31) + character.charCodeAt(0)) >>> 0;
  return result;
}

export function exerciseIllustrationSpec(exercise) {
  const searchable = `${exercise?.ru?.title || ""} ${(exercise?.ru?.materials || []).join(" ")}`;
  const scene = SCENE_RULES.find(([, pattern]) => pattern.test(searchable))?.[0] || "toy";
  const seed = hash(exercise?.id || searchable);
  return {
    scene,
    seed,
    palette: CATEGORY_PALETTES[exercise?.category] || CATEGORY_PALETTES.joint_attention,
    layout: seed % 3,
  };
}

function prop(scene, primary, accent) {
  const common = `stroke="#274b48" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`;
  const props = {
    ball: `<circle cx="320" cy="232" r="48" fill="${accent}" ${common}/><path d="M286 206c22 12 50 11 69-3M300 272c7-25 25-50 51-66" fill="none" opacity=".5" ${common}/>` ,
    blocks: `<g ${common}><rect x="270" y="230" width="100" height="62" rx="12" fill="${primary}"/><rect x="285" y="168" width="70" height="62" rx="12" fill="${accent}"/><rect x="300" y="116" width="40" height="52" rx="10" fill="#f2c85b"/></g>`,
    book: `<g ${common}><path d="M245 166q42-24 75 4v116q-35-24-75-4z" fill="#fff7df"/><path d="M395 166q-42-24-75 4v116q35-24 75-4z" fill="#fff7df"/><path d="M320 170v116" fill="none"/><circle cx="352" cy="218" r="24" fill="${primary}"/><path d="M339 246h26"/></g>`,
    cards: `<g ${common}><rect x="260" y="154" width="120" height="140" rx="15" fill="#fffdf7"/><circle cx="320" cy="204" r="28" fill="${accent}"/><path d="M292 267q28-46 56 0" fill="${primary}"/></g>`,
    doll: `<g ${common}><circle cx="320" cy="174" r="31" fill="#efb587"/><path d="M286 215q34-28 68 0l18 78H268z" fill="${accent}"/><path d="M303 175h2m30 0h2M309 190q11 9 22 0"/></g>`,
    car: `<g ${common}><path d="M258 229h124l-17-49h-69l-28 49z" fill="${primary}"/><rect x="246" y="224" width="148" height="48" rx="16" fill="${accent}"/><circle cx="278" cy="274" r="18" fill="#314b49"/><circle cx="362" cy="274" r="18" fill="#314b49"/></g>`,
    spoon: `<g ${common}><ellipse cx="274" cy="246" rx="62" ry="37" fill="${primary}" opacity=".85"/><ellipse cx="366" cy="246" rx="62" ry="37" fill="${accent}" opacity=".85"/><path d="M295 190l52 47"/><ellipse cx="284" cy="180" rx="22" ry="13" transform="rotate(35 284 180)" fill="#f3d7a3"/></g>`,
    chair: `<g ${common}><path d="M282 156v142m76-142v142M282 222h76M292 222v76m56-76v76" fill="none"/><rect x="277" y="145" width="86" height="84" rx="12" fill="${primary}" opacity=".82"/></g>`,
    box: `<g ${common}><path d="M260 194l60-34 60 34-60 34z" fill="#f4d49a"/><path d="M260 194v82l60 38v-86zm120 0v82l-60 38v-86z" fill="${accent}" opacity=".82"/></g>`,
    pillow: `<path d="M258 171q62-27 124 0 25 60 0 120-62 27-124 0-25-60 0-120z" fill="${accent}" ${common}/><path d="M285 202q35-18 70 0" fill="none" opacity=".45" ${common}/>` ,
    wall: `<g ${common}><rect x="275" y="128" width="90" height="174" rx="8" fill="#e9d6bd"/><path d="M295 158h50m-50 36h50m-50 36h50m-50 36h50" opacity=".5"/></g>`,
    clothes: `<g ${common}><path d="M274 177l30-25h32l30 25-18 34-17-12v96h-62v-96l-17 12z" fill="${primary}"/><path d="M290 241h60" opacity=".5"/></g>`,
    timer: `<g ${common}><circle cx="320" cy="224" r="66" fill="#fffaf0"/><path d="M320 224l27-31M300 142h40M320 142v16"/><circle cx="320" cy="224" r="6" fill="${accent}"/></g>`,
    table: `<g ${common}><path d="M250 213h140v34H250z" fill="${primary}"/><path d="M274 247v65m92-65v65" fill="none"/></g>`,
    hand_wash: `<g ${common}><path d="M268 164h104v41H268zM344 164v-27h42v18" fill="${primary}"/><path d="M320 206q-24 34 0 54 24-20 0-54z" fill="#75bfd0"/><path d="M280 274q40-23 80 0" fill="none"/></g>`,
    scissors: `<g ${common}><circle cx="286" cy="251" r="25" fill="none"/><circle cx="344" cy="251" r="25" fill="none"/><path d="M302 232l78-88M330 232l-70-87" fill="none"/></g>`,
    tweezers: `<g ${common}><path d="M276 161l44 111 44-111" fill="none"/><circle cx="320" cy="285" r="19" fill="${accent}"/></g>`,
    clothespin: `<g ${common}><path d="M277 276l86-119M280 157l83 119"/><circle cx="321" cy="218" r="22" fill="${accent}"/></g>`,
    button: `<g ${common}><path d="M258 155q62-24 124 0v139q-62 24-124 0z" fill="${primary}" opacity=".6"/><circle cx="320" cy="224" r="42" fill="${accent}"/><circle cx="306" cy="211" r="5"/><circle cx="334" cy="211" r="5"/><circle cx="306" cy="237" r="5"/><circle cx="334" cy="237" r="5"/></g>`,
    screw: `<g ${common}><rect x="299" y="151" width="42" height="142" rx="18" fill="${accent}"/><path d="M299 177h42m-42 28h42m-42 28h42m-42 28h42M289 151h62"/></g>`,
    beads: `<g ${common}><path d="M249 237q71-96 142 0" fill="none"/><circle cx="276" cy="210" r="19" fill="${primary}"/><circle cx="320" cy="183" r="19" fill="${accent}"/><circle cx="364" cy="210" r="19" fill="#f0c956"/></g>`,
    clay: `<path d="M256 269q6-98 64-110 58 12 64 110-64 38-128 0z" fill="${accent}" ${common}/><path d="M286 238q34-42 68 0" fill="none" opacity=".45" ${common}/>` ,
    paper: `<g ${common}><rect x="253" y="145" width="134" height="160" rx="10" fill="#fffdf8"/><path d="M278 257q38-96 84 0" fill="none" stroke="${primary}"/><circle cx="280" cy="257" r="7" fill="${accent}"/><circle cx="362" cy="257" r="7" fill="${accent}"/></g>`,
    puzzle: `<g ${common}><path d="M260 165h45q-8 28 15 28t15-28h45v48q-28-8-28 15t28 15v48h-48q8-28-15-28t-15 28h-42z" fill="${primary}"/></g>`,
    sound: `<g fill="none" ${common}><path d="M295 264V174l68-17v86"/><circle cx="278" cy="267" r="23" fill="${accent}"/><circle cx="346" cy="246" r="23" fill="${primary}"/><path d="M388 173q28 48 0 96" opacity=".5"/></g>`,
    sorting: `<g ${common}><rect x="248" y="244" width="58" height="54" rx="10" fill="${primary}"/><rect x="334" y="244" width="58" height="54" rx="10" fill="${accent}"/><circle cx="277" cy="187" r="23" fill="${accent}"/><rect x="342" y="165" width="42" height="42" rx="8" fill="${primary}"/><path d="M277 211v23m86-27v27" fill="none"/></g>`,
    movement: `<g fill="none" ${common}><circle cx="320" cy="163" r="30" fill="#efb487"/><path d="M320 194v62m0-32l-47 25m47-25l45-30m-45 62l-38 55m38-55l48 50"/><path d="M250 162q-28 25 0 50M390 148q36 34 2 70" stroke="${accent}"/></g>`,
    choice: `<g ${common}><circle cx="278" cy="224" r="42" fill="${primary}"/><rect x="338" y="182" width="84" height="84" rx="18" fill="${accent}"/><path d="M320 224h18"/><path d="M320 224l-16-15m16 15l-16 15" fill="none"/></g>`,
    calm: `<g ${common}><circle cx="320" cy="164" r="31" fill="#efb487"/><path d="M284 221q36-38 72 0v77h-72z" fill="${primary}"/><path d="M268 204q-35 30 0 58m104-58q35 30 0 58" fill="none" stroke="${accent}"/><path d="M296 170q24 16 48 0" fill="none"/></g>`,
    toy: `<g ${common}><path d="M320 151l22 43 48 7-35 34 8 48-43-22-43 22 8-48-35-34 48-7z" fill="${accent}"/></g>`,
  };
  return props[scene] || props.toy;
}

function actionOverlay(category, markerId, primary, accent) {
  const line = `fill="none" stroke="${primary}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"`;
  if (category === "joint_attention") return `<g ${line} stroke-dasharray="7 9"><path d="M196 142Q252 178 281 198"/><path d="M444 142Q388 178 359 198"/></g><circle cx="320" cy="118" r="11" fill="${accent}" opacity=".75"/>`;
  if (category === "understanding") return `<path d="M215 196Q264 145 288 188" ${line} marker-end="url(#${markerId})"/>`;
  if (category === "imitation") return `<path d="M223 116Q320 58 417 116" ${line} marker-end="url(#${markerId})"/><path d="M417 141Q320 82 223 141" ${line} opacity=".45"/>`;
  if (category === "communication") return `<path d="M402 85h92q22 0 22 20v38q0 20-22 20h-35l-22 20 5-20h-40q-22 0-22-20v-38q0-20 22-20z" fill="#fff" stroke="${primary}" stroke-width="5"/><circle cx="423" cy="124" r="6" fill="${accent}"/><circle cx="448" cy="124" r="6" fill="${accent}"/><circle cx="473" cy="124" r="6" fill="${accent}"/>`;
  if (category === "play_thinking") return `<path d="M320 105v42m0-20l-34-22m34 22l34-22" ${line}/>`;
  if (category === "fine_motor") return `<circle cx="320" cy="224" r="92" fill="none" stroke="${accent}" stroke-width="5" stroke-dasharray="10 12"/><path d="M232 288q28-24 58-11m118 11q-28-24-58-11" ${line}/>`;
  if (category === "regulation") return `<path d="M245 118q-28 30 0 60m150-60q28 30 0 60M264 310q56 22 112 0" ${line} opacity=".65"/>`;
  return `<g ${line}><circle cx="278" cy="111" r="9" fill="${accent}"/><path d="M291 111h42" marker-end="url(#${markerId})"/><circle cx="360" cy="111" r="9" fill="${accent}"/></g>`;
}

function person(x, isAdult, primary, mirrored = false, variant = 0) {
  const skin = variant % 2 ? "#e7ad7e" : "#efb98d";
  const shirt = isAdult ? primary : (variant % 2 ? "#e98468" : "#efb84f");
  const scale = isAdult ? 1 : 0.82;
  const transform = `translate(${x} 0) scale(${mirrored ? -scale : scale} ${scale})`;
  return `<g transform="${transform}" stroke="#274b48" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"><circle cx="0" cy="112" r="34" fill="${skin}"/><path d="M-31 104q6-43 42-39 28 4 28 35-22-13-48-12z" fill="#263d3b"/><path d="M-4 118h2m22 0h2M3 134q8 7 16 0"/><path d="M-42 188q42-47 84 0v103h-84z" fill="${shirt}"/><path d="M-36 196l-42 47m114-47l42 47M-23 291l-29 44m75-44l29 44" fill="none"/></g>`;
}

export function renderExerciseIllustration(exercise, language = "kk", escapeHtml = String, compact = false) {
  const copy = exercise?.[language] || exercise?.kk || exercise?.ru || {};
  const spec = exerciseIllustrationSpec(exercise);
  const [primary, accent, background] = spec.palette;
  const safeId = String(exercise?.id || "exercise").replace(/[^a-z0-9_-]/gi, "-");
  const gradientId = `illustration-bg-${safeId}`;
  const markerId = `illustration-arrow-${safeId}`;
  const aria = language === "ru"
    ? `Иллюстрация к упражнению «${copy.title || ""}»: ${copy.parentWords || ""}`
    : `«${copy.title || ""}» жаттығуына иллюстрация: ${copy.parentWords || ""}`;
  const adultX = spec.layout === 1 ? 500 : 132;
  const childX = spec.layout === 1 ? 130 : 506;
  return `<figure class="exercise-illustration ${compact ? "compact" : "full"}" data-illustration-id="${safeId}" data-scene="${spec.scene}" role="img" aria-label="${escapeHtml(aria)}">
    <svg viewBox="0 0 640 360" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="${gradientId}" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${background}"/><stop offset="1" stop-color="#fff9ee"/></linearGradient>
        <marker id="${markerId}" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0l8 4-8 4z" fill="${primary}"/></marker>
      </defs>
      <rect width="640" height="360" rx="34" fill="url(#${gradientId})"/>
      <circle cx="76" cy="62" r="34" fill="#fff" opacity=".35"/><circle cx="575" cy="74" r="48" fill="${accent}" opacity=".12"/>
      <path d="M44 319q276-48 552 0v41H44z" fill="#e9d9bf" opacity=".62"/>
      ${person(adultX, true, primary, adultX > 320, spec.seed)}
      ${person(childX, false, primary, childX > 320, spec.seed + 1)}
      ${prop(spec.scene, primary, accent)}
      ${actionOverlay(exercise?.category, markerId, primary, accent)}
    </svg>
  </figure>`;
}
