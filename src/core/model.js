export const Kernels=Object.freeze({MIHOMO:"mihomo",SING_BOX:"sing-box",XRAY:"xray"});
export const ChainModes=Object.freeze({NODE_NODE:"node->node",NODE_SUB:"node->subscription",SUB_NODE:"subscription->node",SUB_SUB:"subscription->subscription"});
export const NodeKinds=Object.freeze({NODE:"node",SUBSCRIPTION:"subscription"});
export const NodeProtocols=Object.freeze({
  HTTP:"http",SOCKS:"socks",SHADOWSOCKS:"shadowsocks",VMESS:"vmess",VLESS:"vless",
  TROJAN:"trojan",HYSTERIA:"hysteria",HYSTERIA2:"hysteria2",TUIC:"tuic",ANYTLS:"anytls",
  WIREGUARD:"wireguard"
});

export function result(ok,data={},error=null){return {ok,data,error};}
function text(value){return value===undefined||value===null?null:String(value).trim()||null;}
function number(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function clone(value){return value===undefined?undefined:structuredClone(value);}
function first(...values){for(const value of values){if(value!==undefined&&value!==null&&value!=="")return value;}return null;}

function normalizeTls(source){
  const raw=source.tls&&typeof source.tls==="object"?source.tls:{};
  const reality=first(source.reality,raw.reality);
  if(!source.tls&&!source.sni&&!source.servername&&!reality)return null;
  return {
    enabled:source.tls===true||raw.enabled===true||Boolean(first(source.sni,source.servername,raw.server_name,raw.serverName,reality)),
    serverName:text(first(source.sni,source.servername,raw.server_name,raw.serverName)),
    insecure:raw.insecure===true||source.allowInsecure===true,
    alpn:Array.isArray(raw.alpn)?[...raw.alpn]:[],
    fingerprint:text(first(source.fingerprint,source.client_fingerprint,raw.utls&&raw.utls.fingerprint)),
    minVersion:text(first(raw.min_version,raw.minVersion)),
    maxVersion:text(first(raw.max_version,raw.maxVersion)),
    reality:reality&&typeof reality==="object"?{
      enabled:true,
      publicKey:text(first(reality.public_key,reality.publicKey,reality.pbk)),
      shortId:text(first(reality.short_id,reality.shortId,reality.sid)),
      spiderX:text(first(reality.spider_x,reality.spiderX)),
      raw:clone(reality)
    }:null
  };
}

function normalizeTransport(source){
  const raw=source.transport&&typeof source.transport==="object"?source.transport:{};
  const type=text(first(source.network,raw.type));
  if(!type&&!Object.keys(raw).length)return null;
  return {
    type,
    path:text(first(source.path,raw.path,source.ws_path)),
    host:Array.isArray(source.host)?[...source.host]:text(first(source.host,raw.host)),
    serviceName:text(first(source.service_name,raw.service_name,source.serviceName)),
    headers:source.headers&&typeof source.headers==="object"?clone(source.headers):(raw.headers&&typeof raw.headers==="object"?clone(raw.headers):null),
    mode:text(first(source.mode,raw.mode)),
    raw:clone(raw)
  };
}

function normalizeAuth(source,protocol){
  const auth=source.auth&&typeof source.auth==="object"?source.auth:{};
  const authentication=source.authentication&&typeof source.authentication==="object"?source.authentication:{};
  const user=first(source.username,source.user,auth.username,auth.user,authentication.username);
  const password=first(source.password,auth.password,authentication.password);
  // Never use node id/tag/name as UUID. A UUID must be explicitly supplied.
  const uuid=first(source.uuid,auth.uuid,authentication.uuid);
  const alterId=first(source.alter_id,source.alterId,auth.alter_id,auth.alterId);
  const flow=first(source.flow,auth.flow,authentication.flow);
  return {uuid:text(uuid),username:text(user),password:text(password),alterId:number(alterId),flow:text(flow),raw:clone(source.authentication||source.auth)};
}

function normalizeNodeInternal(input,index=0){
  if(!input||typeof input!=="object")return null;
  const source={...input};
  const protocol=text(source.protocol||source.type)?.toLowerCase()||null;
  const id=text(source.id||source.tag||source.name||((protocol||"node")+"-"+(index+1)));
  const name=text(source.name||source.tag||source.id||(protocol?protocol.toUpperCase():"Node")+" "+(index+1));
  if(!id||!name)return null;
  return {...source,id,name,kind:NodeKinds.NODE,protocol,
    endpoint:{server:text(source.server||source.address||source.host),port:number(source.port||source.server_port)},
    auth:normalizeAuth(source,protocol),tls:normalizeTls(source),transport:normalizeTransport(source),
    udp:source.udp===undefined?null:Boolean(source.udp),metadata:{sourceType:text(source.type),sourceTag:text(source.tag),originalProtocol:protocol}};
}

export function normalizeNode(input,index=0){return normalizeNodeInternal(input,index);}
export function normalizeNodes(nodes){
  if(!Array.isArray(nodes))return [];
  const seen=new Set();
  return nodes.map((node,index)=>normalizeNode(node,index)).filter(Boolean).filter(node=>{
    const key=[node.protocol,node.endpoint.server,node.endpoint.port,node.auth.uuid,node.auth.username].map(v=>v||"").join("|");
    if(seen.has(key))return false;seen.add(key);return true;
  });
}