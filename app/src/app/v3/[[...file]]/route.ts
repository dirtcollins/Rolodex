import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextRequest, NextResponse } from "next/server";
import { session } from "@/lib/auth";
import { v3Data } from "@/lib/v3-data";

export const dynamic = "force-dynamic";
const ROOT = path.resolve(process.cwd(), "..");
const TYPES: Record<string, string> = { ".html": "text/html; charset=utf-8", ".js": "application/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".webp": "image/webp", ".jpg": "image/jpeg", ".jpeg": "image/jpeg" };

function denied(request: NextRequest) { const login = new URL("/login", request.url); login.searchParams.set("next", request.nextUrl.pathname); return NextResponse.redirect(login); }
export async function GET(request: NextRequest, context: { params: Promise<{ file?: string[] }> }) {
  if (!await session()) return denied(request);
  const parts = (await context.params).file ?? [];
  if (parts.join("/") === "data/rolodex-data.js") {
    return new Response("window.RX_DATA = " + JSON.stringify(await v3Data()) + ";", { headers: { "content-type": "application/javascript; charset=utf-8", "cache-control": "no-store" } });
  }
  const relative = parts.length ? parts.join("/") : "index.html";
  if (!/^[A-Za-z0-9._/-]+$/.test(relative) || relative.includes("..") || relative.startsWith("data/")) return new Response("Not found", { status: 404 });
  try {
    const file = path.resolve(ROOT, relative); if (!file.startsWith(ROOT + path.sep)) return new Response("Not found", { status: 404 });
    const body = await readFile(file);
    return new Response(body, { headers: { "content-type": TYPES[path.extname(file).toLowerCase()] ?? "application/octet-stream", "cache-control": path.extname(file) === ".html" ? "no-store" : "public, max-age=3600" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
