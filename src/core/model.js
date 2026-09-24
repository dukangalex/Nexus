export const Kernels=Object.freeze({MIHOMO:"mihomo",SING_BOX:"sing-box",XRAY:"xray"}); export const ChainModes=Object.freeze({NODE_NODE:"node->node",NODE_SUB:"node->subscription",SUB_NODE:"subscription->node",SUB_SUB:"subscription->subscription"}); export const NodeKinds=Object.freeze({NODE:"node",SUBSCRIPTION:"subscription"});

export function result(ok,data={},error=null){return {ok,data,error};}

export function normalizeNode(input,index=0){
  if(!input || typeof input !== "object") return null;
  const source={...input};
  const protocol=String(source.protocol||source.type||"").trim().toLowerCase()||null;
  const id=String(source.id||source.tag||source.name||((protocol||"node")+"-"+(index+1))).trim();
  const name=String(source.name||source.tag||source.id||("Node "+(index+1))).trim();
  if(!id||!name) return null;
  return {...source,id,name,kind:NodeKinds.NODE,protocol};
}

export function normalizeNodes(nodes){
  if(!Array.isArray(nodes)) return [];
  return nodes.map((node,index)=>normalizeNode(node,index)).filter(Boolean);
}
