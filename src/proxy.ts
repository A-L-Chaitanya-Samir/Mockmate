import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { DEMO_MODE } from "@/lib/mode";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  if (DEMO_MODE) return response;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const protectedRoute =
    request.nextUrl.pathname.startsWith("/dashboard") ||
    request.nextUrl.pathname.startsWith("/interview-room");
  if (!url || !key) {
    return protectedRoute
      ? NextResponse.redirect(
          new URL("/login?error=setup_required", request.url),
        )
      : response;
  }
  const client = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookies) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        cookies.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
      },
    },
  });
  const {
    data: { user },
  } = await client.auth.getUser();
  if (protectedRoute && (!user || !user.email_confirmed_at)) {
    const redirected = NextResponse.redirect(
      new URL("/login?error=session_expired", request.url),
    );
    response.cookies.getAll().forEach((c) => redirected.cookies.set(c));
    return redirected;
  }
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/interview-room/:path*",
    "/auth/:path*",
    "/reset-password",
  ],
};
