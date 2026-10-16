import { SESSION_COOKIE } from "@/lib/auth";

export async function POST() {
  return new Response(null, { status: 303, headers: { Location: "/login", "Set-Cookie": `${SESSION_COOKIE}=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax` } });
}
