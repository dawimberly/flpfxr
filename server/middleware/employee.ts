/** Protect crew HTML before SSR; never return crew markup to an arbitrary session. */
import { requireEmployee } from "../../src/lib/employee-session.server";
export default async function employeeMiddleware(event: { url: URL; req: Request }, next: () => Promise<Response>) {
  if (/^\/estimator(?:\/|$)/.test(event.url.pathname)) {
    try { await requireEmployee(event.req); }
    catch (error) { if (error instanceof Response) return error; throw error; }
  }
  return next();
}
