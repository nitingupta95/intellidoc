import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isAuthPage = req.nextUrl.pathname.startsWith("/login") || req.nextUrl.pathname.startsWith("/register");
  const isDashboardPage = req.nextUrl.pathname.startsWith("/dashboard") || 
                          req.nextUrl.pathname.startsWith("/documents") ||
                          req.nextUrl.pathname.startsWith("/chat") ||
                          req.nextUrl.pathname.startsWith("/knowledge-bases") ||
                          req.nextUrl.pathname.startsWith("/knowledge-graph") ||
                          req.nextUrl.pathname.startsWith("/analytics") ||
                          req.nextUrl.pathname.startsWith("/billing") ||
                          req.nextUrl.pathname.startsWith("/settings");

  if (isAuthPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
    return null;
  }

  if (isDashboardPage && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return null;
});

// Optionally, don't invoke Middleware on some paths
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}
