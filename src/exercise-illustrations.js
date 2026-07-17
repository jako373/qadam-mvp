const EXISTING_EXACT_SCENES = {
  "joint_attention-01": "joint-look",
  "joint_attention-02": "name-response",
  "joint_attention-05": "sound-search",
  "joint_attention-06": "ball",
  "joint_attention-07": "hide-find",
  "joint_attention-08": "book",
  "joint_attention-09": "waiting",
  "joint_attention-10": "sorting",
  "joint_attention-11": "blocks",
  "joint_attention-14": "toy-play",
  "understanding-01": "give-object",
  "understanding-02": "approach-parent",
  "understanding-03": "chair",
  "understanding-05": "put-in-box",
  "understanding-06": "two-step",
  "understanding-07": "body-parts",
  "understanding-09": "doll-care",
  "understanding-12": "spatial-position",
  "imitation-01": "imitation",
  "imitation-05": "car-play",
  "imitation-08": "animal-sound",
  "imitation-09": "spoon-rhythm",
  "communication-02": "request-gesture",
  "communication-04": "say-no",
  "communication-05": "help-request",
  "communication-12": "take-turns",
  "communication-15": "emotion-talk",
  "play_thinking-04": "button-effect",
  "play_thinking-09": "bag-touch",
  "play_thinking-12": "sequence-cards",
  "fine_motor-02": "tweezers",
  "fine_motor-03": "craft",
  "fine_motor-05": "fine-motor",
  "fine_motor-11": "scissors",
  "fine_motor-12": "button-clothes",
  "regulation-03": "wall-push",
  "regulation-07": "animal-walk",
  "regulation-10": "calm",
  "daily_social-02": "hand-wash",
  "daily_social-13": "table-care",
};

const CURRENT_EXERCISE_IDS = [
  "joint_attention",
  "understanding",
  "imitation",
  "communication",
  "play_thinking",
  "fine_motor",
  "regulation",
  "daily_social",
].flatMap((category) => Array.from({ length: 15 }, (_, index) => `${category}-${String(index + 1).padStart(2, "0")}`));

const SCENE_BY_EXERCISE_ID = new Map(CURRENT_EXERCISE_IDS.map((id) => [
  id,
  EXISTING_EXACT_SCENES[id] || id.replaceAll("_", "-"),
]));

const SCENE_RULES = [
  ["chair", /стул|орындық/i],
  ["hand-wash", /мыть рук|мытья рук|мыть руки|қол жуу/i],
  ["ball", /мяч|шар/i],
  ["book", /книг|картин|рассказ|посмотри|что это|событи|кітап/i],
  ["blocks", /кубик|башн|пазл|форму на место|құрастыр/i],
  ["fine-motor", /бусин|пинцет|прищеп|пуговиц|винт|ложк|наниз|ұсақ/i],
  ["craft", /бумаг|наклейк|пластилин|ножниц|лини|точк|қағаз/i],
  ["calm", /успоко|расслаб|подуш|тихий уголок|ожидан|медленно дуть|тыныш/i],
  ["imitation", /повтор|хлоп|ритм|поднять руки|прыж|постуч|покач|походк|движени|қайтала/i],
  ["sorting", /выбр|цвет|больш|малень|сортир|разделить|пары|лишн|признак|правил|таңда/i],
];

const CATEGORY_DEFAULTS = {
  joint_attention: "book",
  understanding: "sorting",
  imitation: "imitation",
  communication: "book",
  play_thinking: "sorting",
  fine_motor: "fine-motor",
  regulation: "calm",
  daily_social: "toy-play",
};

function hash(value) {
  let result = 17;
  for (const character of String(value)) result = ((result * 31) + character.charCodeAt(0)) >>> 0;
  return result;
}

export function exerciseIllustrationSpec(exercise) {
  const searchable = [
    exercise?.ru?.title,
    exercise?.kk?.title,
    ...(exercise?.ru?.materials || []),
    ...(exercise?.kk?.materials || []),
  ].filter(Boolean).join(" ");
  const scene = SCENE_BY_EXERCISE_ID.get(exercise?.id)
    || SCENE_RULES.find(([, pattern]) => pattern.test(searchable))?.[0]
    || CATEGORY_DEFAULTS[exercise?.category]
    || "toy-play";
  return {
    scene,
    seed: hash(exercise?.id || searchable),
    asset: `/public/images/exercises/${scene}.webp`,
  };
}

export function renderExerciseIllustration(exercise, language = "kk", escapeHtml = String, compact = false) {
  const copy = exercise?.[language] || exercise?.kk || exercise?.ru || {};
  const spec = exerciseIllustrationSpec(exercise);
  const safeId = String(exercise?.id || "exercise").replace(/[^a-z0-9_-]/gi, "-");
  const alt = language === "ru"
    ? `Иллюстрация к упражнению «${copy.title || ""}»`
    : `«${copy.title || ""}» жаттығуына иллюстрация`;

  return `<figure class="exercise-illustration ${compact ? "compact" : "full"}" data-illustration-id="${safeId}" data-scene="${spec.scene}">
    <img src="${spec.asset}" alt="${escapeHtml(alt)}" width="1280" height="853" loading="${compact ? "lazy" : "eager"}" decoding="async"${compact ? "" : ' fetchpriority="high"'}>
  </figure>`;
}
