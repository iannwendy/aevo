import { NextResponse } from 'next/server';

function base64UrlToUint8Array(base64Url) {
  const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function decodeJwtPart(part) {
  try {
    const bytes = base64UrlToUint8Array(part);
    const json = new TextDecoder().decode(bytes);
    return JSON.parse(json);
  } catch {
    return null;
  }
}

async function verifyJwtHmacSha256(token, secret) {
  const parts = token.split('.');
  if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) return false;
  try {
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      enc.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    const sigBytes = base64UrlToUint8Array(parts[2]);
    const dataBytes = enc.encode(`${parts[0]}.${parts[1]}`);
    return await crypto.subtle.verify('HMAC', key, sigBytes, dataBytes);
  } catch {
    return false;
  }
}

function forbiddenAdminResponse(request) {
  if (
    request?.headers?.get('next-router-prefetch') === '1' ||
    request?.headers?.get('purpose') === 'prefetch' ||
    request?.nextUrl?.searchParams?.has('_rsc')
  ) {
    return new NextResponse(null, { status: 204 });
  }
  return new NextResponse(
    `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><title>AEVO - 403 Forbidden</title></head><body data-testid="admin-forbidden" style="font-family:sans-serif;padding:48px;background:#F5F5F3;color:#171717;"><h1>403 — Admin access required</h1><p>Your account does not have administrator privileges to access AEVO Control.</p><a href="/">Return to AEVO Store</a></body></html>`,
    {
      status: 403,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'x-frame-options': 'DENY',
        'x-content-type-options': 'nosniff',
      },
    }
  );
}

export async function middleware(request) {
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
      const parts = token.split('.');
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) {
        return forbiddenAdminResponse(request);
      }

      const header = decodeJwtPart(parts[0]);
      const payload = decodeJwtPart(parts[1]);

      // Reject alg: "none", non-HS256 tokens, password-reset tokens, expired tokens, or non-ADMIN roles
      if (
        !header ||
        header.alg !== 'HS256' ||
        !payload ||
        payload.purpose ||
        payload.role !== 'ADMIN' ||
        (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now())
      ) {
        return forbiddenAdminResponse(request);
      }

      const secret = process.env.JWT_SECRET;
      if (secret) {
        const validSig = await verifyJwtHmacSha256(token, secret);
        if (!validSig) {
          return forbiddenAdminResponse(request);
        }
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*'],
};
