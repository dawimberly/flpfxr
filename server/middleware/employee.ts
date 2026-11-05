/** Protect crew HTML before SSR; never return crew markup to an arbitrary session. */
import { requireEmployee } from "../../src/lib/employee-session.server";
export default async function employeeMiddleware(event: { url: URL; req: Request }, next: () => Promise<Response>) {
  if (/^\/estimator(?:\/|$)/i.test(event.url.pathname)) {
    try { await requireEmployee(event.req); }
    catch (error) { if (error instanceof Response) {
      if (error.status === 401) return new Response('<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Employee sign-in</title><main><h1>Sign in to continue</h1><a href="/login">Employee login</a></main></html>', { status: 401, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "private, no-store", Vary: "Cookie, Authorization" } });
      return error;
    } throw error; }
  }
  return next();
}
