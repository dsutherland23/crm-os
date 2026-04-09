import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// BYPASS MODE: Auth disabled — allow all routes
// TODO: Re-enable when Supabase Auth is wired up
export function middleware(_request: NextRequest) {
  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|public).*)'],
};
