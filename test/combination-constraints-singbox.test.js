import test from "node:test";
import assert from "node:assert/strict";
import { validateNodeCombination } from "../src/core/combination-constraints.js";

test("sing-box accepts Reality according to current 1.14 TLS schema", () => {
  const issues = validateNodeCombination("sing-box", {
    id: "reality",
    protocol: "vless",
    tls: {
      enabled: true,
      reality: {
        enabled: true,
        publicKey: "public-key",
        shortId: "short-id"
      }
    }
  });

  assert.equal(issues.length, 0);
});
