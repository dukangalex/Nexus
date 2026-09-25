import { groupByRegion } from "./region.js";

export const GroupTypes = Object.freeze(["select","url_test","fallback","load_balance","region"]);
const VALID_MODES = new Set(GroupTypes);
const UNUSABLE_STATES = new Set(["failed","disabled"]);
const DEGRADED_PENALTY_MS = 5000;

function clean(value){return typeof value==="string"?value.trim():"";}
function uniqueMembers(members){const seen=new Set();return (Array.isArray(members)?members:[]).map(clean).filter(member=>member&&!seen.has(member)&&seen.add(member));}
function normalizeType(type){const value=clean(type).toLowerCase();if(!VALID_MODES.has(value))throw new Error("unsupported group type: "+value);return value;}
function clone(value){return value===undefined?undefined:structuredClone(value);}

export function createGroup({id,name,type="select",members=[],enabled=true,options={},metadata={}}={}) {
  const groupId=clean(id),groupName=clean(name);
  if(!groupId)throw new TypeError("group id must be a non-empty string");
  if(!groupName)throw new TypeError("group name must be a non-empty string");
  const normalizedType=normalizeType(type),normalizedMembers=uniqueMembers(members);
  if(normalizedType==="region"&&!normalizedMembers.length)return null;
  return Object.freeze({id:groupId,name:groupName,type:normalizedType,members:Object.freeze(normalizedMembers),enabled:enabled!==false,options:Object.freeze(clone(options)||{}),metadata:Object.freeze(clone(metadata)||{})});
}

function stateOf(node,states){if(states&&typeof states==="object"){const explicit=states[node.id];if(typeof explicit==="string")return explicit.toLowerCase();}return clean(node.state).toLowerCase();}
function usable(node,states){if(!node||!node.id)return false;return !UNUSABLE_STATES.has(stateOf(node,states));}

export function filterGroupMembers(nodes,states){const seen=new Set();return (Array.isArray(nodes)?nodes:[]).filter(node=>usable(node,states)).map(node=>clean(node.id)).filter(id=>id&&!seen.has(id)&&seen.add(id));}

function capabilitySet(node){const values=node&&(node.capabilities||(node.metadata&&node.metadata.capabilities));return new Set(Array.isArray(values)?values.map(value=>clean(value).toLowerCase()):[]);}
function capabilityAllowed(node,required){const wanted=Array.isArray(required)?required.map(value=>clean(value).toLowerCase()).filter(Boolean):[];if(!wanted.length)return true;const available=capabilitySet(node);return wanted.every(capability=>available.has(capability));}
function availableNodes(group,nodes,states){const byId=new Map((Array.isArray(nodes)?nodes:[]).filter(node=>node&&node.id).map(node=>[node.id,node]));return group.members.map(id=>byId.get(id)).filter(node=>usable(node,states)).filter(node=>capabilityAllowed(node,group.options.requiredCapabilities));}
function latencyOf(node){for(const value of [node&&node.latencyMs,node&&node.latency,node&&node.probe&&node.probe.latencyMs,node&&node.health&&node.health.latencyMs]){const number=Number(value);if(Number.isFinite(number)&&number>=0)return number;}return Number.POSITIVE_INFINITY;}
function score(node){return latencyOf(node)+(clean(node&&node.state)==="degraded"?DEGRADED_PENALTY_MS:0);}
function stableMemberOrder(nodes){return nodes.map((node,index)=>({node,index})).sort((a,b)=>{const delta=score(a.node)-score(b.node);return delta!==0?delta:a.index-b.index;}).map(entry=>entry.node);}
function deterministicIndex(nodes,key){const textKey=clean(key);if(!textKey)return 0;let hash=2166136261;for(let i=0;i<textKey.length;i+=1){hash^=textKey.charCodeAt(i);hash=Math.imul(hash,16777619);}return (hash>>>0)%nodes.length;}

export function resolveGroupMember(group,nodes=[],states,context={}) {
  if(!group||group.enabled===false)return {ok:false,member:null,reason:"group is disabled or missing"};
  const candidates=availableNodes(group,nodes,states);
  if(!candidates.length)return {ok:false,member:null,reason:"no usable group members"};
  if(group.type==="select"){
    const selected=clean(context.selected||group.options.selected);
    if(selected){const member=candidates.find(node=>node.id===selected);if(!member)return {ok:false,member:null,reason:"selected member is unavailable or lacks required capabilities"};return {ok:true,member,reason:"selected"};}
    return {ok:true,member:candidates[0],reason:"first usable member"};
  }
  if(group.type==="url_test"||group.type==="region")return {ok:true,member:stableMemberOrder(candidates)[0],reason:"lowest measured latency"};
  if(group.type==="fallback")return {ok:true,member:candidates[0],reason:"first usable member"};
  if(group.type==="load_balance"){const index=Number.isInteger(context.index)?Math.abs(context.index)%candidates.length:deterministicIndex(candidates,context.key);return {ok:true,member:candidates[index],reason:"deterministic load-balance selection"};}
  return {ok:false,member:null,reason:"unsupported group type"};
}

export function buildRegionGroups(regionGroups={}){const result={};for(const [region,members] of Object.entries(regionGroups||{})){const group=createGroup({id:"region:"+region,name:region,type:"region",members:Array.isArray(members)?members.map(node=>node&&node.id):[]});if(group)result[group.id]=group;}return result;}

export function buildGroups(definitions=[],nodes=[],states){const byId=new Map((Array.isArray(nodes)?nodes:[]).filter(node=>node&&node.id).map(node=>[node.id,node]));const result={};for(const definition of Array.isArray(definitions)?definitions:[]){if(!definition||typeof definition!=="object")continue;const requested=uniqueMembers(definition.members);const available=requested.filter(id=>{const node=byId.get(id);return node&&usable(node,states);});const group=createGroup({...definition,members:available});if(group)result[group.id]=group;}return result;}

export function buildDynamicGroups(nodes=[],definitions=[],states){const usableNodes=(Array.isArray(nodes)?nodes:[]).filter(node=>usable(node,states));const regions=buildRegionGroups(groupByRegion(usableNodes));const custom=buildGroups(definitions,nodes,states);return {...regions,...custom};}
