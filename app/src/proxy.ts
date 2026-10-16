import { NextResponse, type NextRequest } from "next/server";

// Proxy runs in a separate runtime. Keep database-backed session validation in the
// server layout and route handlers; here we only make the request path available to
// that layout so it can leave the sign-in screen public and protect every other page.
export function proxy(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-rolodex-path", request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/((?!_next/).*)"] };
