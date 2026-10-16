import fs from "node:fs/promises";
import sharp from "sharp";

const targets = [
  [13, "KS Industries LP", "https://www.ksilp.com"], [30, "Klein DeNatale Goldner", "https://www.kleinlaw.com"],
  [37, "Pacific Auto & Motorsports", "https://www.pacificautomotorsportsbrokers.com/"], [43, "PFT Alexander Services, Inc.", "https://www.pft-alexander.com/"],
  [56, "JTI", "https://www.jtielectric.com/"], [84, "La Jolla Farming", "https://www.lajollafarming.com/"],
  [92, "Johnston Farms", "https://johnstonfarms.com/"], [96, "IFG", "https://ifg.world"],
];
const out = new URL("../public/company-avatars/", import.meta.url);
const report = new URL("../../verification/logo-pass-i-q.json", import.meta.url);
const attrs = tag => Object.fromEntries([...tag.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)].map(m => [m[1].toLowerCase(), m[2] ?? m[3] ?? m[4] ?? ""]));
const sameSite = (url, base) => { const h = new URL(url).hostname.replace(/^www\./, ""); return h === base || h.endsWith("." + base); };
async function fetchPublic(url, base) {
  let current = new URL(url);
  for (let n = 0; n < 4; n++) {
    if (!sameSite(current, base)) throw Error("asset moved outside official domain");
    const response = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(10_000), headers: { "User-Agent": "Mozilla/5.0 (compatible; Rolodex-logo-verification/1.0)" } });
    if (response.status >= 300 && response.status < 400 && response.headers.get("location")) { current = new URL(response.headers.get("location"), current); continue; }
    if (!response.ok) throw Error(`HTTP ${response.status}`);
    return { url: current.href, buffer: Buffer.from(await response.arrayBuffer()) };
  }
  throw Error("too many redirects");
}
async function work([id, name, website]) {
  const base = new URL(website).hostname.replace(/^www\./, "");
  try {
    const page = await fetchPublic(website, base), html = page.buffer.toString("utf8"), candidates = [];
    const add = (value, type, score) => { try { const absolute = new URL(value, page.url).href; if (sameSite(absolute, base)) candidates.push({ url:absolute, type, score }); } catch {} };
    for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) { const a=attrs(tag), rel=(a.rel||"").toLowerCase(); if (/apple-touch-icon/.test(rel)) add(a.href,"official-site-icon",120); else if (/(^|\s)(shortcut )?icon(\s|$)/.test(rel)) add(a.href,"official-site-icon",100); }
    for (const tag of html.match(/<img\b[^>]*>/gi) ?? []) { const a=attrs(tag), identity=[a.alt,a.class,a.id,a.src].join(" "); if (/logo/i.test(identity) && !/partner|client|award|badge|sponsor/i.test(identity)) add(a.src||a["data-src"],"official-site-logo",130); }
    for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) { const a=attrs(tag); if ((a.property||"").toLowerCase()==="og:image") add(a.content,"official-site-social-logo",70); }
    for (const fallback of ["/apple-touch-icon.png","/favicon.svg","/favicon.png","/favicon.ico"]) add(fallback,"official-site-icon",40);
    const seen = new Set(); let last = "no usable asset";
    for (const c of candidates.sort((a,b)=>b.score-a.score).filter(c=>!seen.has(c.url)&&seen.add(c.url)).slice(0,8)) {
      try {
        const asset = await fetchPublic(c.url, base), meta = await sharp(asset.buffer,{limitInputPixels:25_000_000}).metadata();
        if (!meta.width || !meta.height || Math.min(meta.width,meta.height)<64 || Math.max(meta.width,meta.height)/Math.min(meta.width,meta.height)>7) { last="asset resolution or proportions unsuitable"; continue; }
        for (const size of [64,104]) { const inset=Math.round(size*.12), inner=size-inset*2; const data=await sharp(asset.buffer,{limitInputPixels:25_000_000}).resize(inner,inner,{fit:"contain",background:"#ffffff"}).extend({top:inset,right:inset,bottom:inset,left:inset,background:"#ffffff"}).webp({quality:88,effort:6}).toBuffer(); await fs.writeFile(new URL(`${id}-${size}.webp`,out),data); }
        return {id,name,status:"added",website,sourceUrl:asset.url,sourcePage:page.url,sourceType:c.type,input:{width:meta.width,height:meta.height},files:[`${id}-64.webp`,`${id}-104.webp`]};
      } catch (error) { last=error.message; }
    }
    return {id,name,status:"fallback",website,reason:last};
  } catch (error) { return {id,name,status:"fallback",website,reason:error.message}; }
}
await fs.mkdir(out,{recursive:true});
const rows=[]; for (const target of targets) rows.push(await work(target));
await fs.writeFile(report,JSON.stringify({range:"I-Q",generatedAt:new Date().toISOString(),scope:"High-confidence official assets only; shared manifest and source audit intentionally untouched.",results:rows,added:rows.filter(r=>r.status==="added").length,blockers:rows.filter(r=>r.status!=="added")},null,2));
console.log(JSON.stringify({added:rows.filter(r=>r.status==="added").length,total:rows.length}));
