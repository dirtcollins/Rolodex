import { NextResponse, type NextRequest } from "next/server";

// Proxy runs in a separate runtime. Keep database-backed session validation in the
// server layout and route handlers; here we only make the request path available to
// that layout so it can leave the sign-in screen public and protect every other page.
// V3 is the app. Every old screen forwards to it; only sign-in, V3 and the API stay.
const OLD = ["/dashboard", "/follow-ups", "/contacts", "/companies", "/todos", "/pipeline", "/leads", "/network", "/activities", "/outreach", "/more", "/soon", "/settings", "/import", "/deleted", "/account"];

export function proxy(request: NextRequest) {
  const p = request.nextUrl.pathname;
  if (p === "/" || OLD.some((o) => p === o || p.startsWith(o + "/"))) { const to = request.nextUrl.clone(); to.pathname = "/v3"; to.search = ""; return NextResponse.redirect(to, 307); }
  const headers = new Headers(request.headers);
  headers.set("x-rolodex-path", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/).*)"] };
