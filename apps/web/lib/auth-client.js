'use client';

/**
 * Auth helpers for pages that must NOT go through the apiClient response
 * interceptor.
 *
 * The session cookie is httpOnly, so authentication state comes from
 * GET /api/auth/profile with credentials: 'include'. We use native fetch here
 * instead of apiClient because apiClient's response interceptor hard-redirects
 * the window to /login on any 401 - which, on the profile page, would fire on
 * the very first (expected) "not signed in" check.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

/**
 * Where the browser has to navigate for the Google OAuth dance. This is a
 * full-page navigation, not an XHR: the API redirects to Google, then back to
 * /account/profile?login=success and sets the httpOnly 'token' cookie.
 */
export const GOOGLE_AUTH_URL = `${API_URL}/api/auth/google`;

/**
 * Read the current session.
 * Never throws. Returns:
 *   { status: 'ok', user }
 *   { status: 'unauthenticated', error }
 *   { status: 'error', error }   (network / 5xx / non-JSON)
 */
export async function fetchProfile() {
  try {
    const res = await fetch(`${API_URL}/api/auth/profile`, {
      method: 'GET',
      credentials: 'include',
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    });

    if (res.status === 401) {
      return { status: 'unauthenticated', error: 'Not signed in' };
    }

    if (!res.ok) {
      return { status: 'error', error: `Request failed (${res.status})` };
    }

    const user = await res.json();
    if (!user || !user.id) {
      return { status: 'error', error: 'Unexpected profile response' };
    }

    return { status: 'ok', user };
  } catch {
    return {
      status: 'error',
      error: 'Could not reach the server. Please try again.',
    };
  }
}

/**
 * Password login. Same reason for using fetch: a 401 here means "wrong
 * credentials", not "session expired", so the interceptor must stay out.
 *
 * Resolves to { ok: true, user } or { ok: false, message }.
 */
export async function postLogin(email, password) {
  let res;
  try {
    res = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });
  } catch {
    return { ok: false, message: 'Could not reach the server. Please try again.' };
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.ok) {
    return { ok: true, user: data?.user ?? null };
  }

  return { ok: false, message: errorMessage(res.status, data) };
}

/**
 * Clear the session cookie.
 *
 * Resolves to { ok: true } only when the API confirmed the cookie was cleared,
 * or { ok: false, message } otherwise (network / CORS / 5xx). Callers must NOT
 * navigate to /login on failure: /login bounces a live session straight back
 * to /profile, which would undo the user's intent and start a loop.
 */
export async function postLogout() {
  let res;
  try {
    res = await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
  } catch {
    return { ok: false, message: 'Could not reach the server. You are still signed in.' };
  }

  if (!res.ok) {
    return {
      ok: false,
      message: `Sign out failed (${res.status}). You are still signed in.`,
    };
  }

  return { ok: true };
}

/**
 * Start the Google flow with a real top-level navigation.
 *
 * GET /api/auth/google must be loaded by the browser itself (302 -> Google ->
 * API callback -> Set-Cookie -> 302 back to the app). It can never be done with
 * fetch/XHR: the cross-origin hop to accounts.google.com has no CORS headers,
 * the redirect is opaque, and any Set-Cookie on the way is discarded.
 *
 * `from` is threaded through as ?from=password|google so the landing page can
 * word its banner honestly.
 */
export function startGoogleLogin(from = 'google') {
  const url = new URL(GOOGLE_AUTH_URL);
  if (from === 'password') url.searchParams.set('from', 'password');
  window.location.assign(url.toString());
}

function errorMessage(status, data) {
  if (status === 401) {
    if (data?.error === 'Please use social login') {
      return 'This account uses Google sign-in. Continue with Google below.';
    }
    return 'Invalid email or password.';
  }
  if (status === 403) {
    return data?.error || 'This account is not allowed to sign in.';
  }
  if (status === 429) {
    return 'Too many attempts. Please wait a few minutes and try again.';
  }
  if (status >= 500) {
    return 'Something went wrong on our side. Please try again.';
  }
  if (data?.error) return data.error;
  if (Array.isArray(data?.errors) && data.errors[0]?.msg) {
    return data.errors[0].msg;
  }
  return 'Sign in failed. Please check your details.';
}
