import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, sessionFrom } from "@/lib/auth";

// Everything needs a signed-in person except the sign-in page and its form, and the files in public/.
const PUBLIC = ["/login", "/api/login"];

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  if (PUBLIC.some((p) => pathname === p || pathname.startsWith(p + "/")) || /\.(png|svg|ico|webp|jpg|txt|woff2)$/.test(pathname)) return NextResponse.next();
  if (await sessionFrom(request.headers, request.cookies.get(SESSION_COOKIE)?.value)) return NextResponse.next();
  if (request.method === "GET" || request.method === "HEAD")
    return NextResponse.redirect(new URL("/login" + (pathname === "/" ? "" : "?next=" + encodeURIComponent(pathname + search)), request.url), 303);
  return NextResponse.json({ ok: false, error: "You were signed out. Sign in again." }, { status: 401 });
}

export const config = { matcher: ["/((?!_next/).*)"] };
