import test from "node:test";
import assert from "node:assert/strict";
import { getUserChoicePolicy, requiresUserConfirmation } from "../src/core/user-choice-policy.js";

test("user-choice policy exposes important decisions to the user", () => {
  const policy = getUserChoicePolicy();
  assert.equal(policy.silentDecisionMaking, false);
  assert.equal(policy.destructiveDefaults, false);
  assert.ok(policy.userControls.includes("nodeLimit"));
  assert.ok(policy.userControls.includes("kernel"));
  assert.ok(policy.userControls.includes("chain"));
});

test("sensitive actions require explicit confirmation", () => {
  assert.equal(requiresUserConfirmation("kernelUpgrade"), true);
  assert.equal(requiresUserConfirmation("removeNodes"), true);
  assert.equal(requiresUserConfirmation("enableKillSwitch"), true);
  assert.equal(requiresUserConfirmation("enableLanSharing"), true);
  assert.equal(requiresUserConfirmation("nodeLimit"), false);
});
