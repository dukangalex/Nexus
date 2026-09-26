import { ResourceModes, createResourcePolicy, applyResourceState } from "./resource-policy.js";
import { NodeStates, canTransition, getNodeState, transitionNodeState } from "./node-state.js";

export function resolveProbeInterval(policy, state = {}) {
  const effective = applyResourceState(createResourcePolicy(policy), state);
  if (effective.healthCheckInterval === "relaxed") return 60000;
  if (effective.healthCheckInterval === "active") return 15000;
  if (effective.healthCheckInterval === "adaptive") return effective.mode === ResourceModes.PERFORMANCE ? 15000 : 30000;
  if (Number.isFinite(Number(effective.healthCheckInterval)) && Number(effective.healthCheckInterval) > 0) return Number(effective.healthCheckInterval);
  return 30000;
}
export class ProbeScheduler {
  constructor({ intervalMs = null, enabled = true, resourcePolicy = {}, resourceState = {} } = {}) { this.enabled=enabled; this.resourcePolicy=createResourcePolicy(resourcePolicy); this.resourceState={...resourceState}; this.intervalMs=intervalMs; this.timer=null; this.fn=null; }
  getIntervalMs() { return this.intervalMs || resolveProbeInterval(this.resourcePolicy,this.resourceState); }
  start(fn) { if (!this.enabled || this.timer) return; if (typeof fn !== "function") throw new TypeError("probe callback must be a function"); this.fn=fn; this.timer=setInterval(fn,this.getIntervalMs()); }
  updateResourceState(state={}) { this.resourceState={...state}; if(this.timer&&this.fn){clearInterval(this.timer);this.timer=setInterval(this.fn,this.getIntervalMs());} return this.getIntervalMs(); }
  stop() { if(this.timer){clearInterval(this.timer);this.timer=null;} this.fn=null; }
}
export function recordProbe(node,outcome,options={}) {
  if(!node||typeof node!=="object"||!node.id) throw new TypeError("node with id is required");
  if(!outcome||typeof outcome!=="object") throw new TypeError("probe outcome is required");
  const timeoutMs=Number.isInteger(options.timeoutMs)&&options.timeoutMs>0?options.timeoutMs:5000;
  const successThreshold=Number.isInteger(options.successThreshold)&&options.successThreshold>0?options.successThreshold:1;
  const failureThreshold=Number.isInteger(options.failureThreshold)&&options.failureThreshold>0?options.failureThreshold:2;
  const current=getNodeState(node)||NodeStates.DISCOVERED, success=outcome.ok===true;
  const failures=Number.isInteger(outcome.consecutiveFailures)?outcome.consecutiveFailures:0, successes=Number.isInteger(outcome.consecutiveSuccesses)?outcome.consecutiveSuccesses:0;
  let next=current;
  if(success){if(successes+1>=successThreshold&&(current===NodeStates.FAILED||current===NodeStates.DEGRADED))next=NodeStates.AVAILABLE;else if(current===NodeStates.VALIDATED||current===NodeStates.AVAILABLE)next=NodeStates.AVAILABLE;}
  else if(failures+1>=failureThreshold){if(current===NodeStates.ACTIVE||current===NodeStates.AVAILABLE||current===NodeStates.VALIDATED)next=NodeStates.FAILED;else if(current!==NodeStates.DISABLED)next=NodeStates.DEGRADED;}
  else if(current===NodeStates.ACTIVE||current===NodeStates.AVAILABLE)next=NodeStates.DEGRADED;
  if(next!==current&&!canTransition(current,next))next=current;
  const updated=next===current?{...node}:transitionNodeState(node,next);
  return {node:updated,state:next,ok:success,consecutiveFailures:success?0:failures+1,consecutiveSuccesses:success?successes+1:0,timeoutMs};
}
