import { NextResponse, type NextRequest } from "next/server";

// Lightweight middleware that checks the NextAuth session cookie
// without importing the full auth config (which pulls in Prisma, bcrypt, etc.)
// This keeps the Edge Function under Vercel's 1 MB size limit.
export default function middleware(req: NextRequest) {
  // NextAuth v5 stores the JWT session in this cookie
  const sessionToken =
    req.cookies.get("authjs.session-token")?.value ||
    req.cookies.get("__Secure-authjs.session-token")?.value;

  const isLoggedIn = !!sessionToken;
  const { pathname } = req.nextUrl;

  const isAuthPage = pathname.startsWith("/login") || pathname.startsWith("/register");
  const isDashboardPage = pathname.startsWith("/dashboard") || 
                          pathname.startsWith("/documents") ||
                          pathname.startsWith("/chat") ||
                          pathname.startsWith("/knowledge-bases") ||
                          pathname.startsWith("/pricing") ||
                          pathname.startsWith("/analytics") ||
                          pathname.startsWith("/billing") ||
                          pathname.startsWith("/settings");

  if (isAuthPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/dashboard", req.nextUrl));
    }
    return NextResponse.next();
  }

  if (isDashboardPage && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  return NextResponse.next();
}

// Optionally, don't invoke Middleware on some paths
export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
}

