export const UserChoicePolicy = Object.freeze({
  userControls: Object.freeze([
    "kernel",
    "kernelUpgrade",
    "nodeLimit",
    "nodeSelection",
    "routing",
    "chain",
    "bypass",
    "networkMode",
    "securityMode"
  ]),
  silentDecisionMaking: false,
  destructiveDefaults: false,
  requireConfirmationFor: Object.freeze([
    "kernelUpgrade",
    "replaceImportedConfig",
    "removeNodes",
    "enableGlobalProxy",
    "enableKillSwitch",
    "enableLanSharing"
  ])
});

export function requiresUserConfirmation(action) {
  return UserChoicePolicy.requireConfirmationFor.includes(action);
}

export function getUserChoicePolicy() {
  return UserChoicePolicy;
}
