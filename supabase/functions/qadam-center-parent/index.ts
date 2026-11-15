const allowedOrigins = new Set(["https://qadam-mvp.vercel.app", "https://qadam-mvp-git-agent-center-records-jako373s-projects.vercel.app", "http://localhost:3000"]);
const previewOrigin = /^https:\/\/qadam-[a-z0-9]+-jako373s-projects\.vercel\.app$/;
const url = Deno.env.get("SUPABASE_URL") || "";
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || "";

function headers(req) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) || previewOrigin.test(origin) ? origin : "https://qadam-mvp.vercel.app",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
}

function respond(req, payload, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: headers(req) });
}

function serviceHeaders(extra = {}) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...extra };
}

async function service(path, options = {}) {
  const response = await fetch(`${url}${path}`, { ...options, headers: serviceHeaders(options.headers) });
  const result = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) throw new Error(`service request failed: ${response.status}`);
  return result;
}

async function hashIin(iin) {
  return service("/rest/v1/rpc/child_iin_hash", { method: "POST", body: JSON.stringify({ p_iin: iin }) });
}

function validIin(iin) {
  if (!/^[0-9]{12}$/.test(iin)) return false;
  const digits = [...iin].map(Number);
  const first = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];
  const second = [3, 4, 5, 6, 7, 8, 9, 10, 11, 1, 2];
  let checksum = digits.slice(0, 11).reduce((sum, digit, index) => sum + digit * first[index], 0) % 11;
  if (checksum === 10) checksum = digits.slice(0, 11).reduce((sum, digit, index) => sum + digit * second[index], 0) % 11;
  return checksum !== 10 && checksum === digits[11];
}

async function actorFromRequest(req, centerId) {
  const authorization = req.headers.get("authorization") || "";
  if (!authorization.startsWith("Bearer ")) return null;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: authorization } });
  if (!response.ok) return null;
  const actor = await response.json();
  if (actor?.app_metadata?.role === "superadmin") return { ...actor, center_role: "admin" };
  const rows = await service(`/rest/v1/center_staff?select=user_id,role&center_id=eq.${encodeURIComponent(centerId)}&user_id=eq.${actor.id}&limit=1`);
  return rows.length ? { ...actor, center_role: rows[0].role } : null;
}

async function login(req, body) {
  const iin = String(body.iin || "").trim();
  const password = String(body.password || "");
  if (!validIin(iin) || !password || password.length > 256) return respond(req, { error: "Неверный ИИН или пароль" }, 401);
  const digest = await hashIin(iin);
  const accounts = await service(`/rest/v1/child_login_accounts?select=parent_id&iin_hash=eq.${digest}&limit=1`);
  if (!accounts.length) return respond(req, { error: "Неверный ИИН или пароль" }, 401);
  const allowed = await service("/rest/v1/rpc/child_login_allow", { method: "POST", body: JSON.stringify({ p_hash: digest }) });
  if (!allowed) return respond(req, { error: "Слишком много попыток. Повторите через 15 минут." }, 429);

  const email = `parent-${digest.slice(0, 24)}@login.qadam.invalid`;
  const response = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST", headers: { apikey: anonKey, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) return respond(req, { error: "Неверный ИИН или пароль" }, 401);
  const session = await response.json();
  if (session.user?.id !== accounts[0].parent_id) return respond(req, { error: "Неверный ИИН или пароль" }, 401);
  await service("/rest/v1/rpc/child_login_reset", { method: "POST", body: JSON.stringify({ p_hash: digest }) });
  return respond(req, session);
}

function validChild(child) {
  const diagnoses = ["ЗРР", "ЗПР", "ЗПРР", "ОНР 1", "ОНР 2", "ОНР 3", "ОНР 4", "ОНР 1-4 (нақтылау керек / нужно уточнить)", "Диагноз жоқ / Диагноза нет", "Басқа / Другое"];
  const languages = ["Қазақша", "Русский", "Қазақша және Русский", "Басқа / Другое"];
  const words = ["Сөз қолданбайды / Не использует слова", "1-10 сөз / 1-10 слов", "11-30 сөз / 11-30 слов", "31-100 сөз / 31-100 слов", "100-ден көп / Более 100"];
  // ponystack: accept legacy age-only enrollment until all open clients have refreshed.
  const age = child?.birth_date ? childAge(child.birth_date) : Number(child?.age);
  return typeof child?.name === "string" && child.name.trim().length >= 1 && child.name.trim().length <= 80
    && Number.isInteger(age) && age >= 2 && age <= 18
    && diagnoses.includes(child.diagnosis) && languages.includes(child.home_language)
    && words.includes(child.meaningful_words)
    && (child.diagnosis !== "Басқа / Другое" || (typeof child.diagnosis_details === "string" && child.diagnosis_details.trim().length >= 2 && child.diagnosis_details.trim().length <= 160))
    && ["interests", "dislikes", "best_time"].every((key) => !child[key] || String(child[key]).length <= (key === "best_time" ? 160 : 240));
}

function localToday() {
  return new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Qyzylorda", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function childAge(birthDate) {
  if (typeof birthDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) return NaN;
  const parsed = new Date(`${birthDate}T00:00:00Z`);
  if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== birthDate) return NaN;
  const today = localToday();
  if (birthDate > today) return NaN;
  const [y, m, d] = birthDate.split("-").map(Number);
  const [ty, tm, td] = today.split("-").map(Number);
  return ty - y - (tm < m || (tm === m && td < d) ? 1 : 0);
}

function phoneE164(value) {
  const input = String(value || "").trim();
  if (!/^[+\d\s()\-.]+$/.test(input)) return null;
  let digits = input.replace(/\D/g, "");
  if (digits.length === 11 && digits[0] === "8") digits = `7${digits.slice(1)}`;
  if (!input.startsWith("+") && digits[0] !== "7") return null;
  return /^[1-9]\d{6,14}$/.test(digits) ? `+${digits}` : null;
}

async function enroll(req, body) {
  const centerId = String(body.center_id || "");
  const iin = String(body.iin || "").trim();
  const guardianName = String(body.guardian_name || "").trim();
  const guardianPhone = phoneE164(body.guardian_phone);
  const hasGuardian = Boolean(guardianName || body.guardian_phone);
  if (!/^[0-9a-f-]{36}$/i.test(centerId) || !validIin(iin) || !validChild(body.child)
      || (body.child.birth_date && !hasGuardian)
      || (hasGuardian && (guardianName.length < 2 || guardianName.length > 160 || !guardianPhone)))
    return respond(req, { error: "Проверьте ИИН и данные ребёнка" }, 400);
  const actor = await actorFromRequest(req, centerId);
  if (!actor) return respond(req, { error: "Доступ сотрудника центра не подтверждён" }, 403);
  const groupId = String(body.group_id || "");
  if (groupId && !/^[0-9a-f-]{36}$/i.test(groupId)) return respond(req, { error: "Неверная группа" }, 400);
  if (groupId) {
    const groups = await service(`/rest/v1/center_groups?select=id&center_id=eq.${centerId}&id=eq.${groupId}&limit=1`);
    if (!groups.length) return respond(req, { error: "Группа не найдена" }, 400);
    if (actor.center_role !== "admin") {
      const assignments = await service(`/rest/v1/center_group_specialists?select=group_id&center_id=eq.${centerId}&group_id=eq.${groupId}&user_id=eq.${actor.id}&limit=1`);
      if (!assignments.length) return respond(req, { error: "Эта группа вам не назначена" }, 403);
    }
  }
  const digest = await hashIin(iin);
  const existing = await service(`/rest/v1/child_login_accounts?select=child_id&iin_hash=eq.${digest}&limit=1`);
  if (existing.length) return respond(req, { error: "Ребёнок с этим ИИН уже зарегистрирован" }, 409);
  const password = crypto.randomUUID().replaceAll("-", "");
  const email = `parent-${digest.slice(0, 24)}@login.qadam.invalid`;
  let newUserId = null;
  try {
    const created = await service("/auth/v1/admin/users", { method: "POST", body: JSON.stringify({ email, password, email_confirm: true, app_metadata: { role: "parent", center_parent: true } }) });
    newUserId = created.id;
    const child = body.child;
    const rows = await service("/rest/v1/children", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({
      parent_id: newUserId, name: child.name.trim(), age: child.birth_date ? childAge(child.birth_date) : Number(child.age), birth_date: child.birth_date || null, diagnosis: child.diagnosis,
      diagnosis_details: child.diagnosis === "Басқа / Другое" ? child.diagnosis_details.trim() : null,
      home_language: child.home_language, meaningful_words: child.meaningful_words,
      interests: String(child.interests || "").trim(), dislikes: String(child.dislikes || "").trim(), best_time: String(child.best_time || "").trim(),
    }) });
    const childId = rows[0]?.id;
    if (!childId) throw new Error("child insert failed");
    await service("/rest/v1/child_login_accounts", { method: "POST", body: JSON.stringify({ iin_hash: digest, child_id: childId, parent_id: newUserId }) });
    await service("/rest/v1/center_students", { method: "POST", body: JSON.stringify({ center_id: centerId, child_id: childId }) });
    if (hasGuardian) await service("/rest/v1/center_guardians", { method: "POST", body: JSON.stringify({ center_id: centerId, child_id: childId, full_name: guardianName, phone_e164: guardianPhone, updated_by: actor.id }) });
    if (actor.center_role === "specialist") await service("/rest/v1/center_specialist_students", { method: "POST", body: JSON.stringify({ center_id: centerId, child_id: childId, specialist_id: actor.id, child_name: child.name.trim() }) });
    if (groupId) await service("/rest/v1/center_group_students", { method: "POST", body: JSON.stringify({ center_id: centerId, group_id: groupId, child_id: childId }) });
    return respond(req, { ok: true, child_id: childId, parent_login: iin, temporary_password: password });
  } catch {
    if (newUserId) await fetch(`${url}/auth/v1/admin/users/${newUserId}`, { method: "DELETE", headers: serviceHeaders() }).catch(() => {});
    return respond(req, { error: "Не удалось создать профиль. Данные не были сохранены." }, 500);
  }
}

async function canEditChild(actor, centerId, childId) {
  const enrolled = await service(`/rest/v1/center_students?select=child_id&center_id=eq.${centerId}&child_id=eq.${childId}&active=eq.true&limit=1`);
  if (!enrolled.length) return false;
  if (actor.center_role === "admin") return true;
  const own = await service(`/rest/v1/center_specialist_students?select=child_id&center_id=eq.${centerId}&child_id=eq.${childId}&specialist_id=eq.${actor.id}&active=eq.true&limit=1`);
  if (own.length) return true;
  const groups = await service(`/rest/v1/center_group_students?select=group_id&center_id=eq.${centerId}&child_id=eq.${childId}`);
  if (!groups.length) return false;
  const groupIds = groups.map((item) => item.group_id).filter((id) => /^[0-9a-f-]{36}$/i.test(id));
  if (!groupIds.length) return false;
  const assigned = await service(`/rest/v1/center_group_specialists?select=group_id&center_id=eq.${centerId}&user_id=eq.${actor.id}&group_id=in.(${groupIds.join(",")})&limit=1`);
  return assigned.length > 0;
}

async function updateProfile(req, body) {
  const centerId = String(body.center_id || "");
  const childId = String(body.child_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(centerId) || !/^[0-9a-f-]{36}$/i.test(childId)) return respond(req, { error: "Неверный запрос" }, 400);
  const actor = await actorFromRequest(req, centerId);
  if (!actor || !await canEditChild(actor, centerId, childId)) return respond(req, { error: "Нет доступа к ребёнку" }, 403);
  const birthDate = body.birth_date || null;
  const guardianName = String(body.guardian_name || "").trim();
  const guardianPhone = body.guardian_phone ? phoneE164(body.guardian_phone) : null;
  if ((birthDate && !Number.isFinite(childAge(birthDate)))
      || Boolean(guardianName) !== Boolean(guardianPhone)
      || guardianName.length > 160 || (guardianName && guardianName.length < 2)
      || (body.guardian_phone && !guardianPhone)) return respond(req, { error: "Проверьте дату рождения и контакт" }, 400);
  if (birthDate) await service(`/rest/v1/children?id=eq.${childId}`, { method: "PATCH", body: JSON.stringify({ birth_date: birthDate, updated_at: new Date().toISOString() }) });
  if (guardianName && guardianPhone) await service("/rest/v1/center_guardians?on_conflict=center_id,child_id", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify({ center_id: centerId, child_id: childId, full_name: guardianName, phone_e164: guardianPhone, updated_by: actor.id, updated_at: new Date().toISOString() }) });
  return respond(req, { ok: true });
}

async function reissuePassword(req, body) {
  const centerId = String(body.center_id || "");
  const childId = String(body.child_id || "");
  if (!/^[0-9a-f-]{36}$/i.test(centerId) || !/^[0-9a-f-]{36}$/i.test(childId))
    return respond(req, { error: "Неверный запрос" }, 400);
  const actor = await actorFromRequest(req, centerId);
  if (!actor) return respond(req, { error: "Доступ сотрудника не подтверждён" }, 403);
  const students = await service(`/rest/v1/center_students?select=child_id&center_id=eq.${centerId}&child_id=eq.${childId}&active=eq.true&limit=1`);
  if (!students.length) return respond(req, { error: "Ученик не найден в центре" }, 404);
  if (actor.center_role !== "admin") {
    const own = await service(`/rest/v1/center_specialist_students?select=child_id&center_id=eq.${centerId}&child_id=eq.${childId}&specialist_id=eq.${actor.id}&active=eq.true&limit=1`);
    if (!own.length) return respond(req, { error: "Можно выдать пароль только своему ученику" }, 403);
  }
  const accounts = await service(`/rest/v1/child_login_accounts?select=parent_id&child_id=eq.${childId}&limit=1`);
  if (!accounts.length) return respond(req, { error: "Семейный аккаунт не найден" }, 404);
  const password = crypto.randomUUID().replaceAll("-", "");
  await service(`/auth/v1/admin/users/${accounts[0].parent_id}`, { method: "PUT", body: JSON.stringify({ password }) });
  return respond(req, { ok: true, child_id: childId, temporary_password: password });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: headers(req) });
  if (req.method !== "POST") return respond(req, { error: "Метод не поддерживается" }, 405);
  try {
    if (Number(req.headers.get("content-length") || 0) > 8192) return respond(req, { error: "Слишком большой запрос" }, 413);
    const raw = await req.text();
    if (raw.length > 8192) return respond(req, { error: "Слишком большой запрос" }, 413);
    const body = JSON.parse(raw);
    if (body.action === "login") return await login(req, body);
    if (body.action === "enroll") return await enroll(req, body);
    if (body.action === "update_profile") return await updateProfile(req, body);
    if (body.action === "reissue_password") return await reissuePassword(req, body);
    return respond(req, { error: "Неизвестное действие" }, 400);
  } catch {
    return respond(req, { error: "Сервис временно недоступен" }, 503);
  }
});
