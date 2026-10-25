'use client';

/**
 * Account calls (profile update, password change, reset flows, register).
 *
 * Same rules as lib/auth-client: native fetch with credentials: 'include'
 * instead of apiClient, because apiClient's response interceptor redirects the
 * window to /login on ANY 401 - including the "current password is wrong"
 * reply from PUT /api/auth/password, which must stay on the form.
 *
 * Every function resolves (never throws) to { ok: true, data } or
 * { ok: false, message, status }.
 */

import { API_URL } from './auth-client';

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(`${API_URL}/api${path}`, {
      method,
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    return { ok: false, status: 0, message: 'Could not reach the server. Please try again.' };
  }

  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }

  if (res.ok) return { ok: true, data };

  return { ok: false, status: res.status, message: pickMessage(res.status, data) };
}

function pickMessage(status, data) {
  if (status === 401) return 'Your session has expired. Please sign in again.';
  if (status === 429) return 'Too many attempts. Please wait a few minutes and try again.';
  if (Array.isArray(data?.errors) && data.errors.length > 0) {
    return data.errors.map((e) => e.msg).filter(Boolean).join('. ') || 'Please check your input.';
  }
  if (data?.error) return data.error;
  if (status >= 500) return 'Something went wrong on our side. Please try again.';
  return 'Request failed. Please try again.';
}

/** PUT /api/auth/profile { fullName, phone?, address? } */
export function updateProfile({ fullName, phone, address }) {
  const body = { fullName };
  if (phone !== undefined) body.phone = phone;
  if (address !== undefined) body.address = address;
  return request('/auth/profile', { method: 'PUT', body });
}

/** PUT /api/auth/password { currentPassword, newPassword } */
export function changePassword({ currentPassword, newPassword }) {
  return request('/auth/password', { method: 'PUT', body: { currentPassword, newPassword } });
}

/** POST /api/auth/forgot-password { email } */
export function requestPasswordReset(email) {
  return request('/auth/forgot-password', { method: 'POST', body: { email } });
}

/** POST /api/auth/reset-password { token, newPassword } */
export function resetPassword({ token, newPassword }) {
  return request('/auth/reset-password', { method: 'POST', body: { token, newPassword } });
}

/** POST /api/auth/register { email, fullName, address, ward?, city?, password? } */
export function register({ email, fullName, address, ward, city, password }) {
  const body = { email, fullName, address };
  if (ward !== undefined) body.ward = ward;
  if (city !== undefined) body.city = city;
  if (password) body.password = password;
  return request('/auth/register', { method: 'POST', body });
}
