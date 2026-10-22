import { NextResponse } from 'next/server';

function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
    const json = atob(padded);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export function middleware(request) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith('/admin')) {
    const cookieToken = request.cookies.get('token')?.value;
    const authHeader = request.headers.get('authorization');
    const bearerToken =
      authHeader && authHeader.toLowerCase().startsWith('bearer ')
        ? authHeader.slice(7).trim()
        : null;
    const token = cookieToken || bearerToken;

    if (token) {
      const payload = decodeJwtPayload(token);
      if (payload && payload.role && payload.role !== 'ADMIN') {
        return new NextResponse(
          `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>403 Forbidden — AEVO Control</title></head><body data-testid="admin-forbidden" style="font-family:sans-serif;padding:48px;background:#F5F5F3;color:#171717;"><h1>403 — Admin access required</h1><p>Your account does not have administrator privileges to access AEVO Control.</p><a href="/">Return to AEVO Store</a></body></html>`,
          {
            status: 403,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          }
        );
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
