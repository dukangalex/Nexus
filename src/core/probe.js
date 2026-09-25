import { ResourceModes, createResourcePolicy, applyResourceState } from "./resource-policy.js";

export function resolveProbeInterval(policy, state = {}) {
  const effective = applyResourceState(createResourcePolicy(policy), state);
  if (effective.healthCheckInterval === "relaxed") return 60000;
  if (effective.healthCheckInterval === "active") return 15000;
  if (effective.healthCheckInterval === "adaptive") return effective.mode === ResourceModes.PERFORMANCE ? 15000 : 30000;
  if (Number.isFinite(Number(effective.healthCheckInterval)) && Number(effective.healthCheckInterval) > 0) {
    return Number(effective.healthCheckInterval);
  }
  return 30000;
}

export class ProbeScheduler {
  constructor({ intervalMs = null, enabled = true, resourcePolicy = {}, resourceState = {} } = {}) {
    this.enabled = enabled;
    this.resourcePolicy = createResourcePolicy(resourcePolicy);
    this.resourceState = { ...resourceState };
    this.intervalMs = intervalMs;
    this.timer = null;
    this.fn = null;
  }

  getIntervalMs() {
    return this.intervalMs || resolveProbeInterval(this.resourcePolicy, this.resourceState);
  }

  start(fn) {
    if (!this.enabled || this.timer) return;
    if (typeof fn !== "function") throw new TypeError("probe callback must be a function");
    this.fn = fn;
    this.timer = setInterval(fn, this.getIntervalMs());
  }

  updateResourceState(state = {}) {
    this.resourceState = { ...state };
    if (this.timer && this.fn) {
      clearInterval(this.timer);
      this.timer = setInterval(this.fn, this.getIntervalMs());
    }
    return this.getIntervalMs();
  }

  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.fn = null;
  }
}
