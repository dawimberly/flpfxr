import { readFile } from "node:fs/promises";
import { basename } from "node:path";

const headers = {
  "Cache-Control": "private, no-store, max-age=0",
  Vary: "Cookie, Authorization",
  "X-Content-Type-Options": "nosniff",
};
type Session = { user: { id: string } } | null;
export async function serveEmployeeAsset(
  request: Request,
  verifySession: () => Promise<Session>,
  loadAsset: (name: string) => Promise<string | null>,
): Promise<Response> {
  if (!(await verifySession())?.user) return new Response("Unauthorized", { status: 401, headers });
  const name = new URL(request.url).pathname.split("/").pop() || "";
  if (!/^[a-zA-Z0-9_.-]+\.js$/.test(name) || basename(name) !== name) {
    return new Response("Not found", { status: 404, headers });
  }
  try {
    const body = await loadAsset(name);
    if (body === null) return new Response("Not found", { status: 404, headers });
    return new Response(body, { headers: { ...headers, "Content-Type": "text/javascript; charset=utf-8" } });
  } catch {
    return new Response("Not found", { status: 404, headers });
  }
}
export async function employeeAssetResponse(request: Request) {
  const { auth } = await import("./auth/server");
  return serveEmployeeAsset(request, async () => {
    const session = await auth.api.getSession({ headers: request.headers });
    return session?.user ? { user: { id: session.user.id } } : null;
  }, async name => {
    const manifest: string[] = JSON.parse(await readFile(new URL("./employee-assets/manifest.json", import.meta.url), "utf8"));
    if (!manifest.includes(name)) return null;
    return readFile(new URL("./employee-assets/" + name, import.meta.url), "utf8");
  });
}
