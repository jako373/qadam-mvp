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
  const scene = SCENE_RULES.find(([, pattern]) => pattern.test(searchable))?.[0]
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
