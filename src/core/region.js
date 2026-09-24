const REGION_ALIASES = [
  ["hong-kong", ["香港", "hong kong", "hk", "hkg"]],
  ["taiwan", ["台湾", "台灣", "taiwan", "tw", "tpe"]],
  ["japan", ["日本", "japan", "jp", "tokyo", "osaka", "nrt", "kix"]],
  ["south-korea", ["韩国", "韓國", "korea", "kr", "seoul", "icn"]],
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

function normalized(value) {
  return String(value || "").trim().toLowerCase();
}

export function detectRegion(node) {
  const haystack = [
    node && node.name,
    node && node.server,
    node && node.host,
    node && node.country,
    node && node.region,
    node && node.asn
  ].map(normalized).join(" ");

  for (const [region, aliases] of REGION_ALIASES) {
    for (const alias of aliases) {
      const pattern = alias.length <= 3 ? new RegExp("(^|[^a-z])" + alias + "([^a-z]|$)", "i") : null;
      if (pattern ? pattern.test(haystack) : haystack.includes(alias)) {
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
    groups.get(detected.region).push(node);
  }

  return Object.fromEntries(
    [...groups.entries()].map(([region, items]) => [region, items])
  );
}
