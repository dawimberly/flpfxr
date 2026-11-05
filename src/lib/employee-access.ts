import { createServerFn } from "@tanstack/react-start";
export const loadEmployeeAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest, setResponseHeader } = await import("@tanstack/react-start/server");
  const { auth } = await import("./auth/server");
  setResponseHeader("Cache-Control", "private, no-store");
  const session = await auth.api.getSession({ headers: getRequest().headers });
  return Boolean(session?.user);
});
