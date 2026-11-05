import { createServerFn } from "@tanstack/react-start";
export const loadEmployeeAccess = createServerFn({ method: "GET" }).handler(async () => {
  const { getRequest, setResponseHeader } = await import("@tanstack/react-start/server");
  const { requireEmployee } = await import("./employee-session.server");
  setResponseHeader("Cache-Control", "private, no-store");
  await requireEmployee(getRequest());
  return true;
});
