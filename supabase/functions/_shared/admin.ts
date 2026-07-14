const allowedOrigins = new Set(["https://qadam-mvp.vercel.app", "http://localhost:3000"]);

export function cors(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.has(origin) ? origin : "https://qadam-mvp.vercel.app",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Content-Type": "application/json; charset=utf-8",
    "Vary": "Origin",
  };
}

export function json(req: Request, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: cors(req) });
}

export async function requireSuperadmin(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) throw json(req, { error: "Требуется авторизация" }, 401);
  const url = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const response = await fetch(`${url}/auth/v1/user`, { headers: { apikey: serviceKey, Authorization: authorization } });
  if (!response.ok) throw json(req, { error: "Сессия недействительна" }, 401);
  const user = await response.json();
  if (user?.app_metadata?.role !== "superadmin") throw json(req, { error: "Доступ только для суперадмина" }, 403);
  return { user, url, serviceKey };
}

export function serviceHeaders(serviceKey: string, extra: Record<string, string> = {}) {
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, "Content-Type": "application/json", ...extra };
}
