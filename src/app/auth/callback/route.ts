import { NextResponse, type NextRequest } from "next/server";
import { serverAuth } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const client = await serverAuth();
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const recovery = request.nextUrl.searchParams.get("next") === "/reset-password" || type === "recovery";
  let success = false;
  if (client && code) success = !(await client.auth.exchangeCodeForSession(code)).error;
  else if (client && tokenHash && (type === "signup" || type === "recovery" || type === "email")) {
    success = !(await client.auth.verifyOtp({ token_hash: tokenHash, type })).error;
  }
  // Destinations are fixed. Never forward arbitrary query URLs.
  return NextResponse.redirect(new URL(success ? (recovery ? "/reset-password" : "/dashboard") : "/login?error=invalid_link", request.url));
}
