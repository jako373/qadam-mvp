import { cors, json, requireSuperadmin, serviceHeaders } from "../_shared/admin.ts";

const categories = ["joint_attention","understanding","imitation","communication","play_thinking","fine_motor","regulation","daily_social"];
const languageShape = {
  type: "object",
  additionalProperties: false,
  properties: {
    title: { type: "string" }, goal: { type: "string" }, preparation: { type: "string" },
    materials: { type: "array", items: { type: "string" }, minItems: 1 }, parentWords: { type: "string" },
    steps: { type: "array", items: { type: "string" }, minItems: 3, maxItems: 3 }, repeatPlan: { type: "string" },
    successCriteria: { type: "string" }, easierVersion: { type: "string" }, harderVersion: { type: "string" },
    benefit: { type: "string" }, parentTip: { type: "string" }, stopRule: { type: "string" }
  },
  required: ["title","goal","preparation","materials","parentWords","steps","repeatPlan","successCriteria","easierVersion","harderVersion","benefit","parentTip","stopRule"]
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(req) });
  if (req.method !== "POST") return json(req, { error: "Метод не поддерживается" }, 405);
  try {
    const { user, url, serviceKey } = await requireSuperadmin(req);
    const apiKey = Deno.env.get("GEMINI_API_KEY");
    if (!apiKey) return json(req, { error: "ИИ не настроен: добавьте GEMINI_API_KEY в Secrets Supabase" }, 503);
    const body = await req.json();
    const category = categories.includes(body.category) ? body.category : "communication";
    const level = Math.min(3, Math.max(1, Number(body.level || 1)));
    const focus = String(body.focus || "").slice(0, 300);

    const existingResponse = await fetch(`${url}/rest/v1/exercise_catalog?select=id,content&category=eq.${category}&order=id.asc&limit=200`, { headers: serviceHeaders(serviceKey) });
    const existing = existingResponse.ok ? await existingResponse.json() : [];
    const maxNumber = existing.reduce((max: number, row: { id: string }) => Math.max(max, Number(row.id.split("-").at(-1)) || 0), 0);
    const id = `${category}-${String(maxNumber + 1).padStart(2, "0")}`;
    const titles = existing.slice(-40).map((row: { content?: { ru?: { title?: string } } }) => row.content?.ru?.title).filter(Boolean);

    const prompt = `Создай безопасное домашнее игровое упражнение для ребёнка 2–7 лет. Направление: ${category}. Уровень: ${level}. Дополнительный фокус: ${focus || "нет"}. Не повторяй эти названия и механики: ${titles.join("; ")}. Длительность 3–5 минут. Не ставь диагноз, не обещай лечение, не используй принуждение, удерживание, наказание, опасные мелкие предметы или сенсорную перегрузку. Казахский текст должен быть естественным, русский — естественным. Шагов ровно три.`;
    const model = Deno.env.get("GEMINI_MODEL") || "gemini-3.5-flash";
    const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: "POST",
      headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Ты редактор безопасных двуязычных домашних упражнений Qadam. Возвращай только данные по схеме." }] },
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
          responseFormat: {
            text: {
              mimeType: "application/json",
              schema: { type: "object", additionalProperties: false, properties: { durationMinutes: { type: "integer", minimum: 3, maximum: 5 }, kk: languageShape, ru: languageShape }, required: ["durationMinutes","kk","ru"] }
            }
          }
        }
      }),
    });
    const ai = await aiResponse.json();
    if (!aiResponse.ok) return json(req, { error: ai.error?.message || "ИИ не смог создать упражнение" }, 502);
    const text = ai.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || "").join("");
    if (!text) return json(req, { error: "ИИ вернул пустой результат" }, 502);
    const generated = JSON.parse(text);
    const content = { id, category, level, durationMinutes: generated.durationMinutes, isActive: false, kk: generated.kk, ru: generated.ru };

    const saved = await fetch(`${url}/rest/v1/exercise_catalog`, {
      method: "POST", headers: serviceHeaders(serviceKey, { Prefer: "return=representation" }),
      body: JSON.stringify({ id, category, level, status: "draft", source: "ai", content, created_by: user.id, updated_by: user.id }),
    });
    const rows = await saved.json();
    if (!saved.ok) return json(req, { error: rows.message || "Не удалось сохранить черновик" }, 500);
    return json(req, { ok: true, exercise: rows[0] });
  } catch (error) {
    if (error instanceof Response) return error;
    return json(req, { error: error instanceof Error ? error.message : "Внутренняя ошибка" }, 500);
  }
});
