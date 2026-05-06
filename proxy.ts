import { NextResponse, type NextRequest } from 'next/server';

// In Next.js 16, 'proxy.ts' replaces the deprecated 'middleware.ts'.
// Auth guards have been moved to server components (dashboard layout / login page).
// This passthrough function keeps cookie forwarding intact for Supabase SSR.
export function proxy(request: NextRequest) {
  return NextResponse.next({ request });
}

export const config = {
  // Match all routes except static files, images, and favicons
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
