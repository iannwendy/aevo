/**
 * Phase 1 E2E checks (E2E_TEST_PLAN.md, Task 1.1 - 1.6).
 *
 * Talks to a running API on API_URL (default http://localhost:3001) and the
 * real database, so it exercises the same code path a browser would. Run with
 * the dev server up:
 *
 *   node test/phase1.e2e.js
 *
 * Every case is independent: it registers its own user, so re-running is safe
 * and does not touch seeded accounts.
 */
const assert = require('node:assert/strict');

const API = process.env.API_URL || 'http://localhost:3001';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:3000';

const results = [];

function record(id, name, ok, detail) {
  results.push({ id, name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${id}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function test(id, name, fn) {
  try {
    const detail = await fn();
    record(id, name, true, typeof detail === 'string' ? detail : undefined);
  } catch (error) {
    record(id, name, false, error.message);
  }
}

/** fetch wrapper returning { status, body, headers }. */
async function call(path, { method = 'GET', body, token, cookie, headers = {} } = {}) {
  const h = { ...headers };
  if (body !== undefined) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  if (cookie) h.Cookie = cookie;

  const res = await fetch(`${API}${path}`, {
    method,
    headers: h,
    body: body === undefined ? undefined : JSON.stringify(body),
    redirect: 'manual',
  });

  const text = await res.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  return { status: res.status, body: parsed, headers: res.headers };
}

function cookieFrom(res) {
  const setCookie = res.headers.getSetCookie?.() || [];
  const cookie = setCookie.find((c) => c.startsWith('token='));
  return cookie ? cookie.split(';')[0] : null;
}

const uniqueEmail = (tag) => `${tag}.${Date.now()}.${Math.floor(Math.random() * 1e6)}@example.com`;
const PASSWORD = '123456';

async function register(tag = 'phase1', extra = {}) {
  const email = uniqueEmail(tag);
  const res = await call('/api/auth/register', {
    method: 'POST',
    body: { email, password: PASSWORD, fullName: 'Phase One', ...extra },
  });
  assert.equal(res.status, 201, `register failed: ${JSON.stringify(res.body)}`);
  return { email, token: res.body.token, cookie: cookieFrom(res), user: res.body.user };
}

async function main() {
  // ---------------------------------------------------------------- Task 1.2
  await test('API-01', 'Server boots and answers on port 3001', async () => {
    const res = await call('/health');
    assert.equal(res.status, 200);
  });

  await test('API-02', 'GET /health returns { status: "ok" }', async () => {
    const res = await call('/health');
    assert.equal(res.body?.status, 'ok');
  });

  await test('API-03', 'CORS allows the frontend origin', async () => {
    const res = await fetch(`${API}/health`, {
      headers: { Origin: CLIENT },
    });
    assert.equal(res.headers.get('access-control-allow-origin'), CLIENT);
    assert.equal(res.headers.get('access-control-allow-credentials'), 'true');

    const preflight = await fetch(`${API}/api/auth/login`, {
      method: 'OPTIONS',
      headers: {
        Origin: CLIENT,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type',
      },
    });
    assert.ok(preflight.status >= 200 && preflight.status < 300, `preflight ${preflight.status}`);
    assert.equal(preflight.headers.get('access-control-allow-origin'), CLIENT);
  });

  await test('API-04', 'CORS rejects an unknown origin', async () => {
    const res = await fetch(`${API}/health`, { headers: { Origin: 'https://evil.example' } });
    assert.equal(res.headers.get('access-control-allow-origin'), null);
  });

  await test('API-05', 'Socket.IO accepts a polling handshake', async () => {
    const res = await fetch(`${API}/socket.io/?EIO=4&transport=polling`);
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.match(text, /^0\{/, `handshake body: ${text.slice(0, 40)}`);
  });

  await test('API-06', 'Error handler answers unknown routes without a stack in prod shape', async () => {
    const res = await call('/api/definitely-not-a-route');
    assert.equal(res.status, 404);
    // Same JSON shape as every other error, never Express's default HTML page.
    assert.equal(typeof res.body, 'object', `expected JSON, got ${String(res.body).slice(0, 40)}`);
    assert.match(res.body.error, /^Cannot GET \/api\/definitely-not-a-route$/);
    assert.equal(res.body.stack, undefined, 'stack leaked on 4xx');
  });

  // ---------------------------------------------------------------- Task 1.3
  let account = null;

  await test('AUTH-01', 'Register returns 201 with user data + token', async () => {
    account = await register('auth01');
    assert.equal(account.user.email, account.email);
    assert.ok(account.token, 'token missing');
    assert.equal(account.user.password, undefined, 'password leaked');
  });

  await test('AUTH-02', 'Register with a duplicate email returns 400', async () => {
    const res = await call('/api/auth/register', {
      method: 'POST',
      body: { email: account.email, password: PASSWORD, fullName: 'Dup' },
    });
    assert.equal(res.status, 400);
    assert.ok(res.body?.error);
  });

  await test('AUTH-03', 'Login returns 200 with user data + token', async () => {
    const res = await call('/api/auth/login', {
      method: 'POST',
      body: { email: account.email, password: PASSWORD },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.ok(res.body.token);
    assert.equal(res.body.user.email, account.email);
  });

  await test('AUTH-04', 'Login with a wrong password returns 401', async () => {
    const res = await call('/api/auth/login', {
      method: 'POST',
      body: { email: account.email, password: 'wrong-password' },
    });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /Invalid email or password/);
  });

  await test('AUTH-04b', 'Login with an unknown email returns the same generic 401', async () => {
    const res = await call('/api/auth/login', {
      method: 'POST',
      body: { email: uniqueEmail('nobody'), password: PASSWORD },
    });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /Invalid email or password/);
  });

  await test('AUTH-05', 'Login sets the token cookie httpOnly', async () => {
    const res = await call('/api/auth/login', {
      method: 'POST',
      body: { email: account.email, password: PASSWORD },
    });
    const raw = (res.headers.getSetCookie?.() || []).find((c) => c.startsWith('token='));
    assert.ok(raw, 'no Set-Cookie: token');
    assert.match(raw, /HttpOnly/i);
    assert.match(raw, /Path=\//i);
  });

  await test('AUTH-06', 'Logout clears the cookie', async () => {
    const res = await call('/api/auth/logout', { method: 'POST', cookie: account.cookie });
    assert.equal(res.status, 200);
    const raw = (res.headers.getSetCookie?.() || []).find((c) => c.startsWith('token='));
    assert.ok(raw, 'no Set-Cookie on logout');
    assert.match(raw, /token=;|Expires=Thu, 01 Jan 1970/i, raw);
  });

  await test('AUTH-06b', 'Validation: bad email / short password rejected', async () => {
    const badEmail = await call('/api/auth/register', {
      method: 'POST',
      body: { email: 'not-an-email', password: PASSWORD, fullName: 'X' },
    });
    assert.equal(badEmail.status, 400);
    const shortPw = await call('/api/auth/register', {
      method: 'POST',
      body: { email: uniqueEmail('short'), password: '123', fullName: 'X' },
    });
    assert.equal(shortPw.status, 400);
    const noName = await call('/api/auth/register', {
      method: 'POST',
      body: { email: uniqueEmail('noname'), password: PASSWORD, fullName: '   ' },
    });
    assert.equal(noName.status, 400);
  });

  await test('AUTH-06c', 'Password longer than 72 bytes is rejected', async () => {
    const res = await call('/api/auth/register', {
      method: 'POST',
      body: { email: uniqueEmail('longpw'), password: 'a'.repeat(73), fullName: 'X' },
    });
    assert.equal(res.status, 400);
  });

  // ---------------------------------------------------------------- Task 1.4
  let profileAccount = null;

  await test('AUTH-07', 'GET profile with a session returns user data', async () => {
    profileAccount = await register('auth07');
    const res = await call('/api/auth/profile', { cookie: profileAccount.cookie });
    assert.equal(res.status, 200);
    assert.equal(res.body.email, profileAccount.email);
    assert.equal(res.body.password, undefined);
  });

  await test('AUTH-08', 'GET profile without a session returns 401', async () => {
    const res = await call('/api/auth/profile');
    assert.equal(res.status, 401);
  });

  await test('AUTH-08b', 'GET profile with a forged token returns 401', async () => {
    const res = await call('/api/auth/profile', { token: 'not.a.jwt' });
    assert.equal(res.status, 401);
  });

  await test('AUTH-09', 'PUT profile updates fullName', async () => {
    const res = await call('/api/auth/profile', {
      method: 'PUT',
      cookie: profileAccount.cookie,
      body: { fullName: 'Updated Name' },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));
    assert.equal(res.body.fullName, 'Updated Name');

    const again = await call('/api/auth/profile', { cookie: profileAccount.cookie });
    assert.equal(again.body.fullName, 'Updated Name');
  });

  await test('AUTH-09b', 'PUT profile rejects an empty fullName', async () => {
    const res = await call('/api/auth/profile', {
      method: 'PUT',
      cookie: profileAccount.cookie,
      body: { fullName: '   ' },
    });
    assert.equal(res.status, 400);
  });

  await test('AUTH-10', 'Change password with the correct current password', async () => {
    const res = await call('/api/auth/password', {
      method: 'PUT',
      cookie: profileAccount.cookie,
      body: { currentPassword: PASSWORD, newPassword: 'newpass1' },
    });
    assert.equal(res.status, 200, JSON.stringify(res.body));

    const login = await call('/api/auth/login', {
      method: 'POST',
      body: { email: profileAccount.email, password: 'newpass1' },
    });
    assert.equal(login.status, 200);
    profileAccount.password = 'newpass1';
  });

  await test('AUTH-11', 'Change password with a wrong current password returns 400', async () => {
    const res = await call('/api/auth/password', {
      method: 'PUT',
      cookie: profileAccount.cookie,
      body: { currentPassword: 'definitely-wrong', newPassword: 'another1' },
    });
    assert.equal(res.status, 400);

    const login = await call('/api/auth/login', {
      method: 'POST',
      body: { email: profileAccount.email, password: profileAccount.password },
    });
    assert.equal(login.status, 200, 'password should not have changed');
  });

  await test('AUTH-11b', 'Change password without a session returns 401', async () => {
    const res = await call('/api/auth/password', {
      method: 'PUT',
      body: { currentPassword: PASSWORD, newPassword: 'another1' },
    });
    assert.equal(res.status, 401);
  });

  await test('AUTH-11c', 'Forgot password returns a generic message and never leaks the token', async () => {
    const res = await call('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: profileAccount.email },
    });
    assert.equal(res.status, 200);
    assert.match(res.body.message, /If email exists/i);
    assert.equal(res.body.token, undefined, 'reset token echoed in response');

    const unknown = await call('/api/auth/forgot-password', {
      method: 'POST',
      body: { email: uniqueEmail('ghost') },
    });
    assert.equal(unknown.body.message, res.body.message, 'responses differ for known/unknown email');
  });

  await test('AUTH-11d', 'Reset password rejects a garbage token', async () => {
    const res = await call('/api/auth/reset-password', {
      method: 'POST',
      body: { token: 'garbage', newPassword: 'brandnew1' },
    });
    assert.equal(res.status, 400);
  });

  await test('AUTH-11e', 'Reset token cannot be used as a session token', async () => {
    const jwt = require('jsonwebtoken');
    const authModPath = require.resolve('../src/middleware/auth');
    // Sign with the running server's secret to simulate an intercepted reset token.
    const { RESET_TOKEN_SECRET, JWT_SECRET } = require(authModPath);
    void JWT_SECRET;
    const resetToken = jwt.sign(
      { id: profileAccount.user.id, purpose: 'password_reset' },
      RESET_TOKEN_SECRET,
      { expiresIn: '1h' }
    );
    const res = await call('/api/auth/profile', { token: resetToken });
    assert.equal(res.status, 401);
  });

  // ---------------------------------------------------------------- Task 1.5
  await test('AUTH-12', 'Google login redirects (or 503 when unconfigured)', async () => {
    const res = await call('/api/auth/google');
    if (res.status === 503) {
      assert.match(res.body.error, /not configured/i);
      return 'unconfigured (503) — needs GOOGLE_CLIENT_ID/SECRET';
    }
    assert.equal(res.status, 302);
    const location = res.headers.get('location') || '';
    assert.match(location, /accounts\.google\.com/);
    return 'configured (302 to Google)';
  });

  await test('AUTH-13', 'Google callback route exists and is guarded', async () => {
    const res = await call('/api/auth/google/callback?code=fake&state=fake');
    // Unconfigured -> 503. Configured -> passport rejects the fake code with a
    // redirect back to the client (400) rather than a 404.
    assert.ok([302, 400, 503].includes(res.status), `unexpected ${res.status}`);
    return `HTTP ${res.status}`;
  });

  await test('AUTH-14', 'Facebook login redirects (or 503 when unconfigured)', async () => {
    const res = await call('/api/auth/facebook');
    if (res.status === 503) {
      assert.match(res.body.error, /not configured/i);
      return 'unconfigured (503) — needs FACEBOOK_APP_ID/SECRET';
    }
    assert.equal(res.status, 302);
    const location = res.headers.get('location') || '';
    assert.match(location, /facebook\.com/);
    return 'configured (302 to Facebook)';
  });

  const { upsertOAuthUser } = require('../src/config/passport');

  await test('AUTH-13b', 'OAuth upsert creates a new user (no password)', async () => {
    const providerId = `fake-${Date.now()}`;
    const email = uniqueEmail('oauth-new');
    const user = await upsertOAuthUser({
      provider: 'google',
      providerId,
      email,
      fullName: 'OAuth New',
    });
    assert.equal(user.email, email);
    assert.equal(user.password, null);

    const again = await upsertOAuthUser({
      provider: 'google',
      providerId,
      email,
      fullName: 'OAuth New',
    });
    assert.equal(again.id, user.id, 'second login created a duplicate user');
  });

  await test('AUTH-13c', 'OAuth upsert links to an existing password account', async () => {
    const existing = await register('oauth-link');
    const user = await upsertOAuthUser({
      provider: 'facebook',
      providerId: `fb-${Date.now()}`,
      email: existing.email.toUpperCase(),
      fullName: 'Linked',
    });
    assert.equal(user.id, existing.user.id, 'created a duplicate instead of linking');
  });

  await test('AUTH-13d', 'Social-only account cannot log in with a password', async () => {
    const email = uniqueEmail('oauth-nopw');
    await upsertOAuthUser({ provider: 'google', providerId: `np-${Date.now()}`, email, fullName: 'NoPw' });
    const res = await call('/api/auth/login', {
      method: 'POST',
      body: { email, password: 'anything' },
    });
    assert.equal(res.status, 401);
    assert.match(res.body.error, /social login/i);
  });

  // ---------------------------------------------------------------- Task 1.6
  await test('FE-01', 'Frontend home page loads without a server error', async () => {
    const res = await fetch(`${CLIENT}/`);
    assert.equal(res.status, 200);
    const html = await res.text();
    assert.doesNotMatch(html, /Application error|Internal Server Error/i);
  });

  await test('FE-01b', 'Auth pages render (login/register/forgot/reset)', async () => {
    for (const path of ['/login', '/register', '/forgot-password', '/reset-password', '/account/profile']) {
      const res = await fetch(`${CLIENT}${path}`);
      assert.equal(res.status, 200, `${path} -> ${res.status}`);
    }
  });

  await test('FE-02', 'Design tokens: --surface resolves to #F5F5F3', async () => {
    const res = await fetch(`${CLIENT}/`);
    const html = await res.text();
    const cssHref = html.match(/\/_next\/static\/css\/[^"]+\.css/)?.[0];
    assert.ok(cssHref, 'no stylesheet link');

    const css = await (await fetch(`${CLIENT}${cssHref}`)).text();
    // Find every custom property named surface / canvas and print their values.
    const found = [...css.matchAll(/--(surface|canvas|paper)[^:;{}]*:\s*([^;]+);/g)].map(
      (m) => `--${m[1]}=${m[2].trim()}`
    );
    const hasTarget = /#f5f5f3|245,245,243|245 245 243/i.test(css);
    assert.ok(hasTarget, `#F5F5F3 not found in CSS tokens (${found.join(', ') || 'no surface tokens'})`);
    return found.join(', ') || undefined;
  });

  await test('FE-03', 'Header shows the logo and navigation', async () => {
    const html = await (await fetch(`${CLIENT}/`)).text();
    assert.match(html, /href="\/"[^>]*>aevo\.</);
    for (const href of ['/products', '/cart', '/account/profile']) {
      assert.ok(html.includes(`href="${href}"`), `missing nav link ${href}`);
    }
  });

  // ------------------------------------------------------------------ report
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '='.repeat(60));
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) console.log(`  - ${f.id} ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Test harness crashed:', error);
  process.exitCode = 1;
});
