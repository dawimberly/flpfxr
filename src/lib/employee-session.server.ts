import { auth } from "./auth/server";
import { requireApprovedEmployee } from "./employee-policy.server";
export async function requireEmployee(request: Request): Promise<string> {
  const session = await auth.api.getSession({ headers: request.headers, query: { disableCookieCache: true } });
  return requireApprovedEmployee(session?.user);
}
