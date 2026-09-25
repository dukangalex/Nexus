import test from "node:test";
import assert from "node:assert/strict";
import { canDecideAutomatically, createDecisionPrompt, getDecisionRegistry } from "../src/core/decision-registry.js";

test("decision registry separates intelligence from user decisions", () => {
  const registry = getDecisionRegistry();
  assert.ok(registry.autoActions.includes("detectFormat"));
  assert.ok(registry.autoActions.includes("validateConfig"));
  assert.ok(registry.userDecisions.includes("nodeLimit"));
  assert.ok(registry.userDecisions.includes("routing"));
  assert.ok(registry.userDecisions.includes("chain"));
});

test("Nexus may analyze automatically but not silently choose user policy", () => {
  assert.equal(canDecideAutomatically("detectFormat"), true);
  assert.equal(canDecideAutomatically("validateConfig"), true);
  assert.equal(canDecideAutomatically("nodeLimit"), false);
  assert.equal(canDecideAutomatically("routing"), false);
  assert.equal(canDecideAutomatically("kernelUpgrade"), false);
});

test("decision prompts expose choices instead of hiding them", () => {
  const prompt = createDecisionPrompt("nodeLimit", ["No limit", "30", "60", "Custom"]);
  assert.equal(prompt.requiresUserChoice, true);
  assert.deepEqual(prompt.options, ["No limit", "30", "60", "Custom"]);
  assert.match(prompt.message, /not silently choose/);
});
