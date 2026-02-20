import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow login page and API routes
    if (pathname === '/login' || pathname.startsWith('/api/')) {
        return NextResponse.next();
    }

    // Allow static assets
    if (pathname.startsWith('/_next/') || pathname.startsWith('/favicon')) {
        return NextResponse.next();
    }

    // Check auth cookie
    const authCookie = request.cookies.get('workflow_auth')?.value;
    if (!authCookie) {
        return NextResponse.redirect(new URL('/login', request.url));
    }

    // Parse cookie: "username:role"
    const [, role] = authCookie.split(':');

    // Admin-only routes
    if (pathname.startsWith('/admin') && role !== 'admin') {
        return NextResponse.redirect(new URL('/', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
