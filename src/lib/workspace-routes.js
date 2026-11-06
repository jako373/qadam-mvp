const publicRoutes = new Set(["/", "/login", "/register", "/forgot-password", "/reset-password"]);

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
  if (session.user?.app_metadata?.center_parent) return path === "/family" ? null : "/family";
  if (path === "/family") return parentDestination;
  return null;
}
