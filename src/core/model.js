export const Kernels=Object.freeze({MIHOMO:"mihomo",SING_BOX:"sing-box",XRAY:"xray"});
export const ChainModes=Object.freeze({NODE_NODE:"node->node",NODE_SUB:"node->subscription",SUB_NODE:"subscription->node",SUB_SUB:"subscription->subscription"});
export const NodeKinds=Object.freeze({NODE:"node",SUBSCRIPTION:"subscription"});

export const NodeProtocols=Object.freeze({
  HTTP:"http",SOCKS:"socks",SHADOWSOCKS:"shadowsocks",VMESS:"vmess",VLESS:"vless",
  TROJAN:"trojan",HYSTERIA:"hysteria",HYSTERIA2:"hysteria2",TUIC:"tuic",ANYTLS:"anytls",
  WIREGUARD:"wireguard"
});

export function result(ok,data={},error=null){return {ok,data,error};}

function text(value){return value === undefined || value === null ? null : String(value).trim() || null;}
function number(value){const n=Number(value);return Number.isFinite(n)?n:null;}
function clone(value){return value === undefined ? undefined : structuredClone(value);}

function normalizeTls(source){
  const tls=source.tls;
  if (!tls && !source.sni && !source.servername && !source.reality) return null;
  const raw=tls && typeof tls==="object" ? tls : {};
  const reality=source.reality || raw.reality;
  return {
    enabled: tls === true || raw.enabled === true || Boolean(source.sni||source.servername||reality),
    serverName:text(source.sni||source.servername||raw.server_name||raw.serverName),
    insecure:raw.insecure === true || source.allowInsecure === true,
    alpn:Array.isArray(raw.alpn)?[...raw.alpn]:[],
    fingerprint:text(source.fingerprint||source.client_fingerprint||raw.utls?.fingerprint),
    minVersion:text(raw.min_version||raw.minVersion),
    maxVersion:text(raw.max_version||raw.maxVersion),
    reality:reality && typeof reality==="object" ? {
      enabled: true,
      publicKey:text(reality.public_key||reality.publicKey||reality.pbk),
      shortId:text(reality.short_id||reality.shortId||reality.sid),
      spiderX:text(reality.spider_x||reality.spiderX),
      raw:clone(reality)
    } : null
  };
}

function normalizeTransport(source){
  const raw=source.transport && typeof source.transport==="object" ? source.transport : {};
  const type=text(source.network||raw.type);
  if (!type && !Object.keys(raw).length) return null;
  return {
    type,
    path:text(source.path||raw.path||source.ws_path),
    host:Array.isArray(source.host)?[...source.host]:text(source.host||raw.host),
    serviceName:text(source.service_name||raw.service_name||source.serviceName),
    headers:source.headers && typeof source.headers==="object" ? clone(source.headers) : (raw.headers && typeof raw.headers==="object" ? clone(raw.headers) : null),
    mode:text(source.mode||raw.mode),
    raw:clone(raw)
  };
}

function normalizeAuth(source,protocol){
  const user=source.username||source.user;
  const password=source.password;
  const uuid=source.uuid||source.id;
  return {
    uuid:text(uuid),
    username:text(user),
    password:text(password),
    alterId:number(source.alter_id||source.alterId),
    flow:text(source.flow),
    raw:clone(source.authentication||source.auth)
  };
}

function normalizeNodeInternal(input,index=0){
  if(!input||typeof input!=="object") return null;
  const source={...input};
  const protocol=text(source.protocol||source.type)?.toLowerCase()||null;
  const id=text(source.id||source.tag||source.name||((protocol||"node")+"-"+(index+1)));
  const name=text(source.name||source.tag||source.id||("Node "+(index+1)));
  if(!id||!name)return null;
  return {
    ...source,
    id,name,kind:NodeKinds.NODE,protocol,
    endpoint:{
      server:text(source.server||source.address||source.host),
      port:number(source.port||source.server_port)
    },
    auth:normalizeAuth(source,protocol),
    tls:normalizeTls(source),
    transport:normalizeTransport(source),
    udp:source.udp===undefined?null:Boolean(source.udp),
    metadata:{
      sourceType:text(source.type),
      sourceTag:text(source.tag),
      originalProtocol:protocol
    }
  };
}

export function normalizeNode(input,index=0){return normalizeNodeInternal(input,index);}
export function normalizeNodes(nodes){
  if(!Array.isArray(nodes))return [];
  const seen=new Set();
  return nodes.map((node,index)=>normalizeNode(node,index)).filter(Boolean).filter(node=>{
    const key=[node.protocol,node.endpoint.server,node.endpoint.port,node.auth.uuid,node.auth.username].map(v=>v||"").join("|");
    if(seen.has(key))return false; seen.add(key); return true;
  });
}