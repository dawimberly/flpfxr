import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  androidDialIntentHref,
  assignDialLocation,
  dialUrlForUserAgent,
  isAndroidWebView,
  shouldInterceptDialClick,
  type DialWindow,
} from "./dialer.ts";

const TEL = "tel:+12104369117";

describe("androidDialIntentHref", () => {
  it("wraps a tel: URL in an ACTION_DIAL intent", () => {
    assert.equal(
      androidDialIntentHref(TEL),
      "intent:+12104369117#Intent;scheme=tel;action=android.intent.action.DIAL;end",
    );
  });
});

describe("isAndroidWebView", () => {
  it("detects Android WebView UA", () => {
    assert.equal(
      isAndroidWebView(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8 Build/AP2; wv) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36",
      ),
      true,
    );
  });

  it("does not treat Chrome or iPhone as a WebView", () => {
    assert.equal(
      isAndroidWebView(
        "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 Chrome/126.0.0.0 Mobile Safari/537.36",
      ),
      false,
    );
    assert.equal(
      isAndroidWebView(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1",
      ),
      false,
    );
  });
});

describe("dialUrlForUserAgent", () => {
  it("uses tel: on iPhone and Android Chrome", () => {
    assert.equal(dialUrlForUserAgent(TEL, "iPhone OS 18_0"), TEL);
    assert.equal(
      dialUrlForUserAgent(TEL, "Mozilla/5.0 (Linux; Android 14) Chrome/126.0.0.0"),
      TEL,
    );
  });

  it("uses an ACTION_DIAL intent inside Android WebView", () => {
    assert.equal(
      dialUrlForUserAgent(TEL, "Android 14; wv) Chrome/126"),
      androidDialIntentHref(TEL),
    );
  });
});

describe("assignDialLocation", () => {
  it("assigns on the top window when framed", () => {
    const top = { location: { href: "https://example.com/" } };
    const child: DialWindow = {
      location: { href: "https://app.example/" },
      self: {},
      top,
    };
    child.self = child;
    assignDialLocation(child, TEL);
    assert.equal(top.location.href, TEL);
    assert.equal(child.location.href, "https://app.example/");
  });

  it("assigns on the current window when top-level", () => {
    const win: DialWindow = { location: { href: "https://app.example/" } };
    win.self = win;
    win.top = win;
    assignDialLocation(win, TEL);
    assert.equal(win.location.href, TEL);
  });
});

describe("shouldInterceptDialClick", () => {
  it("intercepts a plain left click", () => {
    assert.equal(shouldInterceptDialClick({ button: 0 }), true);
  });

  it("leaves modified or already-handled clicks alone", () => {
    assert.equal(shouldInterceptDialClick({ defaultPrevented: true }), false);
    assert.equal(shouldInterceptDialClick({ button: 1 }), false);
    assert.equal(shouldInterceptDialClick({ metaKey: true }), false);
    assert.equal(shouldInterceptDialClick({ ctrlKey: true }), false);
  });
});
