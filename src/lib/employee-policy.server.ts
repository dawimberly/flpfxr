/** Server-controlled user IDs, never client metadata or a self-asserted email/role. */
export const OWNER_EMPLOYEE_ID = "PXtycBJit3XNBwlfARvjFVVDHwSBYM4y";
export type EmployeeIdentity = { id: string } | null | undefined;
export function employeeStatus(user: EmployeeIdentity, extraIds = process.env.EMPLOYEE_USER_IDS ?? ""): 200 | 401 | 403 {
  if (!user?.id) return 401;
  const approved = new Set([OWNER_EMPLOYEE_ID, ...extraIds.split(",").map(id => id.trim()).filter(Boolean)]);
  return approved.has(user.id) ? 200 : 403;
}
export function requireApprovedEmployee(user: EmployeeIdentity): string {
  const status = employeeStatus(user);
  if (status !== 200) throw new Response(status === 401 ? "Unauthorized" : "Employee access required", {
    status, headers: { "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" },
  });
  return user!.id;
}
