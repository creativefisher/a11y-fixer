import { describe, expect, it } from "vitest";

import { normalizeAuditUrl } from "../server/lib/fetch-html.js";

describe("normalizeAuditUrl", () => {
  it("accepts https URLs", () => {
    const url = normalizeAuditUrl("https://example.com/path");
    expect(url.hostname).toBe("example.com");
  });

  it("rejects private hosts by default", () => {
    expect(() => normalizeAuditUrl("http://127.0.0.1/fixtures/x.html")).toThrow(
      /private|local|cannot/i,
    );
  });

  it("rejects RFC1918, CGNAT, metadata, and IPv6 ULA/link-local", () => {
    const blocked = [
      "http://10.0.0.1/",
      "http://192.168.1.1/",
      "http://172.16.5.5/",
      "http://100.64.1.1/",
      "http://169.254.169.254/",
      "http://[::1]/",
      "http://[fc00::1]/",
      "http://[fe80::1]/",
      "http://something.local/",
    ];
    for (const raw of blocked) {
      expect(() => normalizeAuditUrl(raw)).toThrow(/private|local|cannot/i);
    }
  });

  it("allows private hosts when A11Y_ALLOW_LOCAL_FETCH=true", () => {
    const previous = process.env.A11Y_ALLOW_LOCAL_FETCH;
    process.env.A11Y_ALLOW_LOCAL_FETCH = "true";
    try {
      const url = normalizeAuditUrl("http://127.0.0.1/fixtures/x.html");
      expect(url.hostname).toBe("127.0.0.1");
    } finally {
      if (previous === undefined) delete process.env.A11Y_ALLOW_LOCAL_FETCH;
      else process.env.A11Y_ALLOW_LOCAL_FETCH = previous;
    }
  });
});
