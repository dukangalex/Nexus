import test from "node:test";
import assert from "node:assert/strict";
import { validateNodeCombination } from "../src/core/combination-constraints.js";

test("sing-box rejects Reality according to current TLS schema", () => {
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

  assert.ok(issues.some((item) => item.code === "SING_BOX_REALITY_UNSUPPORTED"));
  assert.ok(issues.every((item) => item.severity === "error"));
});
