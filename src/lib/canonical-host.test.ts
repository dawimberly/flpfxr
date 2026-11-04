import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { canonicalRedirectTarget } from "./canonical-host.ts";
import canonicalHostMiddleware from "../../server/middleware/canonical-host.ts";

describe("canonicalRedirectTarget", () => {
  it("sends www and plain http GET/HEAD to the apex https origin", () => {
    assert.equal(
      canonicalRedirectTarget({
        method: "GET",
        host: "www.theflipfixer.com",
        proto: "https",
        pathname: "/services",
        search: "?x=1",
      }),
      "https://theflipfixer.com/services?x=1",
    );
    assert.equal(
      canonicalRedirectTarget({
        method: "HEAD",
        host: "www.theflipfixer.com:443",
        proto: "https",
        pathname: "/",
        search: "",
      }),
      "https://theflipfixer.com/",
    );
    assert.equal(
      canonicalRedirectTarget({
        method: "GET",
        host: "theflipfixer.com",
        proto: "http",
        pathname: "/contact",
        search: "",
      }),
      "https://theflipfixer.com/contact",
    );
    assert.equal(
      canonicalRedirectTarget({
        method: "GET",
        host: "www.theflipfixer.com",
        proto: "http",
        pathname: "/areas/boerne",
        search: "",
      }),
      "https://theflipfixer.com/areas/boerne",
    );
  });

  it("leaves apex https, other hosts, and unsafe methods alone", () => {
    assert.equal(
      canonicalRedirectTarget({
        method: "GET",
        host: "theflipfixer.com",
        proto: "https",
        pathname: "/",
        search: "",
      }),
      null,
    );
    assert.equal(
      canonicalRedirectTarget({
        method: "GET",
        host: "theflipfixer.com",
        proto: null,
        pathname: "/kitchen",
        search: "",
      }),
      null,
    );
    assert.equal(
      canonicalRedirectTarget({
        method: "POST",
        host: "www.theflipfixer.com",
        proto: "https",
        pathname: "/api/leads",
        search: "",
      }),
      null,
    );
    for (const host of ["localhost:8080", "127.0.0.1:8080", "flpfxr-dirty-ink.vercel.app", "preview.theflipfixer.com"]) {
      assert.equal(
        canonicalRedirectTarget({
          method: "GET",
          host,
          proto: "https",
          pathname: "/",
          search: "",
        }),
        null,
      );
    }
  });

  it("middleware 301s a www document and leaves apex https to the app", async () => {
    let continued = false;
    const redirected = await canonicalHostMiddleware(
      {
        url: new URL("https://www.theflipfixer.com/kitchen?a=1"),
        req: {
          method: "GET",
          headers: new Headers({
            host: "www.theflipfixer.com",
            "x-forwarded-proto": "https",
          }),
        },
      },
      () => {
        continued = true;
        return new Response("app");
      },
    );
    assert.equal(continued, false);
    assert.ok(redirected instanceof Response);
    assert.equal(redirected.status, 301);
    assert.equal(redirected.headers.get("Location"), "https://theflipfixer.com/kitchen?a=1");

    const passed = await canonicalHostMiddleware(
      {
        url: new URL("https://theflipfixer.com/"),
        req: {
          method: "GET",
          headers: new Headers({ host: "theflipfixer.com", "x-forwarded-proto": "https" }),
        },
      },
      () => new Response("app", { status: 200 }),
    );
    assert.ok(passed instanceof Response);
    assert.equal(passed.status, 200);
  });
});
