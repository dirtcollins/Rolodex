import { readFile } from "node:fs/promises";
import path from "node:path";
import type { NextRequest } from "next/server";
import { session } from "@/lib/auth";
import { v3Data } from "@/lib/v3-data";

export const dynamic = "force-dynamic";
const ROOT = path.resolve(process.cwd(), "..");
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

// A relative address: behind Hostinger's proxy, request.url is the internal server, not the site.
function denied(request: NextRequest) { return new Response(null, { status: 307, headers: { Location: "/login?next=" + encodeURIComponent(request.nextUrl.pathname) } }); }
export async function GET(request: NextRequest, context: { params: Promise<{ file?: string[] }> }) {
  if (!await session()) return denied(request);
  const parts = (await context.params).file ?? [];
  if (parts.join("/") === "data/rolodex-data.js") {
    return new Response("window.RX_DATA = " + JSON.stringify(await v3Data()) + ";", { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } });
  }
  const relative = parts.length ? parts.join("/") : "index.html";
  // Only V3's own files: the page, its component files, its runtime and its assets. Nothing else in the project folder.
  const allowed = relative === "index.html" || relative === "support.js" || /^[A-Za-z]+\.dc\.html$/.test(relative) || /^assets\/[A-Za-z0-9_-]+(\/[A-Za-z0-9_-]+)*\.(png|svg|webp|jpg|jpeg)$/.test(relative);
  if (!allowed) return new Response("Not found", { status: 404 });
  try {
    const file = path.resolve(ROOT, relative); if (!file.startsWith(ROOT + path.sep)) return new Response("Not found", { status: 404 });
    const raw = await readFile(file);
    // The page lives at /v3 (no trailing slash), so tell it where its own files are.
    const body = relative === "index.html" ? raw.toString("utf8").replace("<head>", '<head>\n<base href="/v3/">') : raw;
    return new Response(body as BodyInit, { headers: { "content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream", "cache-control": path.extname(file) === ".html" ? "no-store" : "public, max-age=3600" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
