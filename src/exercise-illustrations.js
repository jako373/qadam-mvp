const CURATED_SCENE_GROUPS = {
  "joint-look": ["joint_attention-01", "joint_attention-03", "joint_attention-12", "joint_attention-13"],
  "name-response": ["joint_attention-02"],
  "sound-search": ["joint_attention-04", "joint_attention-05"],
  ball: ["joint_attention-06"],
  "hide-find": ["joint_attention-07", "understanding-08"],
  book: ["joint_attention-08", "communication-09", "communication-10", "communication-13", "communication-14"],
  waiting: ["joint_attention-09", "regulation-14", "daily_social-09"],
  sorting: ["joint_attention-10", "understanding-10", "understanding-11", "understanding-14", "communication-07", "play_thinking-01", "play_thinking-05", "play_thinking-06", "play_thinking-07", "play_thinking-08", "play_thinking-11", "play_thinking-13", "play_thinking-14", "play_thinking-15"],
  blocks: ["joint_attention-11", "imitation-13", "play_thinking-03", "fine_motor-01"],
  "toy-play": ["joint_attention-14", "regulation-15"],
  "put-in-box": ["joint_attention-15", "understanding-05", "play_thinking-02", "regulation-06", "daily_social-01"],
  "give-object": ["understanding-01", "understanding-04", "communication-08"],
  "approach-parent": ["understanding-02"],
  chair: ["understanding-03"],
  "two-step": ["understanding-06"],
  "body-parts": ["understanding-07"],
  "doll-care": ["understanding-09", "imitation-14"],
  "spatial-position": ["understanding-12"],
  "sequence-cards": ["understanding-13", "imitation-11", "play_thinking-10", "play_thinking-12"],
  "table-care": ["understanding-15", "daily_social-08", "daily_social-13", "daily_social-15"],
  imitation: ["imitation-01", "imitation-02", "imitation-03", "imitation-04", "imitation-06", "imitation-07", "imitation-10", "imitation-12", "imitation-15", "regulation-08"],
  "car-play": ["imitation-05"],
  "animal-sound": ["imitation-08"],
  "spoon-rhythm": ["imitation-09", "fine_motor-07"],
  "request-gesture": ["communication-01", "communication-02", "communication-03", "communication-06", "communication-11", "daily_social-04", "daily_social-14"],
  "say-no": ["communication-04"],
  "help-request": ["communication-05", "daily_social-10"],
  "take-turns": ["communication-12", "daily_social-05"],
  "emotion-talk": ["communication-15", "regulation-11"],
  "button-effect": ["play_thinking-04"],
  "bag-touch": ["play_thinking-09"],
  tweezers: ["fine_motor-02", "fine_motor-15"],
  craft: ["fine_motor-03", "fine_motor-04", "fine_motor-08", "fine_motor-10", "fine_motor-14"],
  "fine-motor": ["fine_motor-05", "fine_motor-06", "fine_motor-09", "fine_motor-13"],
  scissors: ["fine_motor-11"],
  "button-clothes": ["fine_motor-12", "daily_social-03", "daily_social-07", "daily_social-11", "daily_social-12"],
  calm: ["regulation-01", "regulation-02", "regulation-04", "regulation-05", "regulation-09", "regulation-10", "regulation-12", "regulation-13"],
  "wall-push": ["regulation-03"],
  "animal-walk": ["regulation-07"],
  "hand-wash": ["daily_social-02", "daily_social-06"],
};

const SCENE_BY_EXERCISE_ID = new Map(
  Object.entries(CURATED_SCENE_GROUPS).flatMap(([scene, ids]) => ids.map((id) => [id, scene])),
);

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
