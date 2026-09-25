import { getUserChoicePolicy, requiresUserConfirmation } from "./user-choice-policy.js";

const AUTO_ACTIONS = Object.freeze([
  "detectFormat",
  "detectKernelCompatibility",
  "validateConfig",
  "diagnoseNode",
  "measureLatency",
  "reportSecurityRisk"
]);

const USER_DECISIONS = Object.freeze([
  "kernel",
  "kernelUpgrade",
  "nodeLimit",
  "nodeSelection",
  "routing",
  "chain",
  "bypass",
  "networkMode",
  "securityMode"
]);

export function getDecisionRegistry() {
  return Object.freeze({
    autoActions: AUTO_ACTIONS,
    userDecisions: USER_DECISIONS,
    confirmationActions: getUserChoicePolicy().requireConfirmationFor
  });
}

export function canDecideAutomatically(action) {
  return AUTO_ACTIONS.includes(action) && !requiresUserConfirmation(action);
}

export function createDecisionPrompt(action, options = []) {
  return Object.freeze({
    action,
    requiresUserChoice: USER_DECISIONS.includes(action) || requiresUserConfirmation(action),
    options: Object.freeze([...options]),
    message: "Nexus will present available options and will not silently choose on the user's behalf."
  });
}
