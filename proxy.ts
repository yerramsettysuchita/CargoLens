import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const PROTECTED = ["/dashboard", "/shipments", "/chat", "/carbon", "/estimate", "/compare", "/suppliers", "/tariff", "/settings"];

// API routes and static assets — skip auth entirely
const SKIP_PATTERNS = [
  /^\/_next\//,
  /^\/api\//,
  /\.(svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?)$/,
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth check for static assets and API routes — no Supabase call needed
  if (SKIP_PATTERNS.some((p) => p.test(pathname))) {
    return NextResponse.next({ request });
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Only call getUser() (network round-trip) when necessary:
  //   1. User is on a protected page — need to verify auth
  //   2. User is on /auth — need to check if already logged in
  const isProtected = PROTECTED.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  const isAuthPage = pathname.startsWith("/auth");

  if (!isProtected && !isAuthPage) {
    // Public page (landing, etc.) — just pass through, no Supabase call
    return supabaseResponse;
  }

  // Refresh session token and check auth
  const { data: { user } } = await supabase.auth.getUser();

  if (isProtected && !user) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  if (isAuthPage && user) {
    // Already logged in — send straight to dashboard
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.searchParams.delete("next");
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|icon\\.svg|apple-touch-icon\\.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
