const publicRoutes = new Set(["/", "/login", "/register", "/forgot-password", "/reset-password"]);

export function isCenterPracticeRoute(path) {
  return ["/today", "/progress", "/skill-check", "/plan-ready", "/daily-summary"].includes(path)
    || /^\/skill-check\/(?:[1-9]|1[0-6])$/.test(path)
    || /^\/(?:daily|daily-results)\/[1-3]$/.test(path)
    || /^\/recheck\/[1-8]$/.test(path);
}

export function homeDestination(session, membership, hasProfile) {
  if (!session) return "/login";
  const role = session.user?.app_metadata?.role;
  if (role === "superadmin") return "/account-mode";
  if (session.user?.app_metadata?.center_parent) return "/family";
  if (membership) return "/center";
  if (role === "admin") return "/admin";
  return hasProfile ? "/today" : "/language";
}

export function workspaceRedirect(path, session, membership, parentDestination) {
  if (!session || publicRoutes.has(path) || session.user?.app_metadata?.role === "superadmin") return null;
  if (membership) return path === "/center" ? null : "/center";
  if (session.user?.app_metadata?.center_parent) return path === "/family" || isCenterPracticeRoute(path) ? null : "/family";
  if (path === "/family") return parentDestination;
  return null;
}
