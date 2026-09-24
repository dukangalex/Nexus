const REGION_ALIASES = [
  ["hong-kong", ["香港", "hong kong", "hk", "hkg"]],
  ["taiwan", ["台湾", "台灣", "taiwan", "tw", "tpe"]],
  ["japan", ["日本", "japan", "jp", "tokyo", "osaka", "nrt", "kix"]],
  ["south-korea", ["韩国", "韓國", "south korea", "korea", "kr", "seoul", "icn"]],
  ["singapore", ["新加坡", "singapore", "sg", "sin"]],
  ["united-states", ["美国", "美國", "united states", "usa", "us", "los angeles", "san francisco", "seattle", "new york"]],
  ["united-kingdom", ["英国", "英國", "united kingdom", "uk", "london", "lhr"]],
  ["germany", ["德国", "德國", "germany", "de", "frankfurt", "fra"]],
  ["netherlands", ["荷兰", "荷蘭", "netherlands", "nl", "amsterdam", "ams"]],
  ["france", ["法国", "法國", "france", "fr", "paris"]],
  ["canada", ["加拿大", "canada", "ca", "toronto", "vancouver"]],
  ["australia", ["澳大利亚", "澳洲", "australia", "au", "sydney", "melbourne"]],
  ["russia", ["俄罗斯", "俄羅斯", "russia", "ru", "moscow"]],
  ["india", ["印度", "india", "in", "mumbai", "delhi"]]
];

const CODE_MAP = new Map([
  ["HK", "hong-kong"], ["TW", "taiwan"], ["JP", "japan"], ["KR", "south-korea"],
  ["SG", "singapore"], ["US", "united-states"], ["GB", "united-kingdom"],
  ["DE", "germany"], ["NL", "netherlands"], ["FR", "france"], ["CA", "canada"],
  ["AU", "australia"], ["RU", "russia"], ["IN", "india"]
]);

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

function codeRegion(value) {
  return CODE_MAP.get(String(value || "").trim().toUpperCase()) || null;
}

function tokenPattern(alias) {
  const escaped = alias.replace(/[.*+?^()|[\\]\\]/g, "\\$&");
  return new RegExp("(^|[^a-z])" + escaped + "([^a-z]|$)", "i");
}

export function detectRegion(node) {
  const metadata = node && typeof node === "object" ? node : {};
  const structuredCodes = [
    metadata.countryCode,
    metadata.country_code,
    metadata.ipCountry,
    metadata.asnCountry,
    metadata.geoip && metadata.geoip.countryCode,
    metadata.geo && metadata.geo.countryCode
  ];

  for (const value of structuredCodes) {
    const region = codeRegion(value);
    if (region) return { region, confidence: "structured-metadata" };
  }

  const haystack = [
    metadata.name, metadata.server, metadata.host, metadata.country,
    metadata.region, metadata.city, metadata.address
  ].map(normalized).join(" ");

  for (const [region, aliases] of REGION_ALIASES) {
    for (const alias of aliases) {
      if (alias.length <= 3 ? tokenPattern(alias).test(haystack) : haystack.includes(alias)) {
        return { region, confidence: "name-metadata" };
      }
    }
  }

  return { region: null, confidence: "none" };
}

export function groupByRegion(nodes) {
  const groups = new Map();
  for (const node of Array.isArray(nodes) ? nodes : []) {
    const detected = detectRegion(node);
    if (!detected.region) continue;
    if (!groups.has(detected.region)) groups.set(detected.region, []);
    groups.get(detected.region).push({ ...node, region: detected.region, regionConfidence: detected.confidence });
  }

  return Object.fromEntries([...groups.entries()].map(([region, items]) => [region, items]));
}
