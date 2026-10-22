'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogOut, Loader2, RefreshCw } from 'lucide-react';
import { fetchProfile, postLogout } from '@/lib/auth-client';
import { updateProfile, changePassword } from '@/lib/account-client';
import SiteHeader from '@/components/SiteHeader';

/**
 * /profile
 *
 * The session cookie is httpOnly, so we never read document.cookie. Auth state
 * comes from GET /api/auth/profile with credentials (via lib/auth-client, which
 * uses fetch and keeps the expected 401 as a normal "signed out" answer).
 *
 * After the Google flow the API lands back here as ?login=success; we fetch the
 * profile, then strip the query string from the URL.
 */

export default function ProfilePage() {
  return (
    <Suspense fallback={<PageFrame><LoadingState /></PageFrame>}>
      <ProfileView />
    </Suspense>
  );
}

function ProfileView() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ------------- state -------------
  // 'loading' | 'signed-out' | 'error' | 'ready'
  const [status, setStatus] = useState('loading');
  // { id, email, fullName, role, loyaltyPoints, addresses, oauthAccounts } | null
  const [user, setUser] = useState(null);
  const [error, setError] = useState(null);
  // How the session was started: 'google' | 'password' | null (already signed in).
  const [loginVia, setLoginVia] = useState(() =>
    searchParams.get('login') === 'success'
      ? searchParams.get('from') === 'password'
        ? 'password'
        : 'google'
      : null
  );
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(null);

  // ------------- load -------------
  const load = useCallback(async () => {
    setStatus('loading');
    setError(null);

    const result = await fetchProfile();

    if (result.status === 'ok') {
      setUser(result.user);
      setStatus('ready');
      return;
    }

    setUser(null);
    if (result.status === 'unauthenticated') {
      // Stay put and offer a sign-in link. Do NOT auto-redirect: bouncing here
      // from /login (which redirects back once a session exists) is how
      // redirect loops start. One click is the only way out of this state.
      setStatus('signed-out');
      return;
    }
    setError(result.error);
    setStatus('error');
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // One-shot success banner from the OAuth redirect. Clean the URL once per
  // change of the ?login param so a refresh does not re-show it.
  const loginParam = searchParams.get('login');
  const fromParam = searchParams.get('from');
  useEffect(() => {
    if (!loginParam) return;
    if (loginParam === 'success') {
      setLoginVia(fromParam === 'password' ? 'password' : 'google');
    }
    router.replace('/account/profile', { scroll: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loginParam, fromParam]);

  // Drop the banner after a few seconds.
  useEffect(() => {
    if (!loginVia) return;
    const t = setTimeout(() => setLoginVia(null), 6000);
    return () => clearTimeout(t);
  }, [loginVia]);

  // ------------- logout -------------
  // Clear the cookie here and navigate only once the API confirmed it. A plain
  // push to /logout while the cookie is still alive leaves a valid session
  // behind, and /login forwards live sessions back to /profile - i.e. the user
  // is dropped right back into the account they tried to leave.
  // Hard navigation (window.location) so the /login mount is a fresh document
  // with ?loggedout=1, which skips its session check entirely; no client-router
  // navigation race with the ?login cleanup replace above.
  async function handleLogout() {
    if (loggingOut) return;
    setLoggingOut(true);
    setLogoutError(null);

    const result = await postLogout();

    if (!result.ok) {
      setLoggingOut(false);
      setLogoutError(result.message);
      return;
    }

    window.location.replace('/login?loggedout=1');
  }

  // ------------- render -------------
  if (status === 'loading') {
    return (
      <PageFrame>
        <LoadingState />
      </PageFrame>
    );
  }

  if (status === 'signed-out') {
    return (
      <PageFrame>
        <EmptyState
          title="You’re not signed in."
          body="Sign in with Google or your email to view your account."
          actionLabel="Sign in"
          actionHref="/login?next=%2Faccount%2Fprofile"
        />
      </PageFrame>
    );
  }

  if (status === 'error') {
    return (
      <PageFrame>
        <EmptyState
          title="We couldn’t load your account."
          body={error}
          onRetry={load}
        />
      </PageFrame>
    );
  }

  const googleAccount = (user.oauthAccounts || []).find(
    (a) => a.provider === 'google'
  );

  return (
    <PageFrame>
      {loginVia && (
        <p
          role="status"
          aria-live="polite"
          className="mb-8 text-small rounded-lg border border-sage/30 bg-sage/5 text-sage px-4 py-3"
        >
          {loginVia === 'password'
            ? 'Signed in. Welcome back.'
            : 'Signed in with Google. Welcome back.'}
        </p>
      )}

      {logoutError && (
        <p
          role="alert"
          className="mb-8 text-small rounded-lg border border-red-300 bg-red-50 text-red-700 px-4 py-3"
        >
          {logoutError}{' '}
          <button
            type="button"
            onClick={handleLogout}
            className="font-medium underline underline-offset-4 focus-ring rounded"
          >
            Try again
          </button>
        </p>
      )}

      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-6">
        <div>
          <span className="text-caption font-mono text-secondary uppercase tracking-wider">
            Account
          </span>
          <h1 className="text-display mt-3">{user.fullName}</h1>
          <p className="text-secondary mt-2">{user.email}</p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="btn-secondary focus-ring inline-flex items-center gap-2 h-11 px-5 rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {loggingOut ? (
              <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
            ) : (
              <LogOut size={16} aria-hidden="true" />
            )}
            {loggingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard label="Loyalty points" value={formatPoints(user.loyaltyPoints)} />
        <StatCard label="Role" value={titleCase(user.role)} />
        <StatCard
          label="Sign-in method"
          value={googleAccount ? 'Google' : 'Email & password'}
        />
      </div>

      <Section title="Sign-in methods">
        {googleAccount ? (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Google</p>
              <p className="text-small text-secondary mt-1 break-all">
                Linked {formatDate(googleAccount.createdAt)}
              </p>
            </div>
            <span className="text-caption font-mono text-sage uppercase tracking-wider">
              Connected
            </span>
          </div>
        ) : (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium">Email & password</p>
              <p className="text-small text-secondary mt-1">
                Google isn’t linked to this account yet.
              </p>
            </div>
            <Link
              href="/login?next=%2Faccount%2Fprofile"
              className="text-small font-medium hover:underline underline-offset-4 focus-ring rounded"
            >
              Link Google
            </Link>
          </div>
        )}
      </Section>

      <Section title="Personal details">
        <ProfileDetailsForm
          user={user}
          onSaved={(updated) => setUser((prev) => ({ ...prev, ...updated }))}
        />
      </Section>

      <Section title="Password">
        <ChangePasswordForm hasPassword={!googleAccount} />
      </Section>

      <Section title="Addresses">
        {user.addresses && user.addresses.length > 0 ? (
          <ul className="divide-y divide-border">
            {user.addresses.map((address) => (
              <li key={address.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-medium">{address.fullName}</p>
                    <p className="text-small text-secondary mt-1">
                      {[address.phone, address.address, address.city]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                  {address.isDefault && (
                    <span className="text-caption font-mono text-secondary uppercase tracking-wider">
                      Default
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-secondary">
            No saved addresses yet. They’ll appear after your first order.
          </p>
        )}
      </Section>
    </PageFrame>
  );
}

// ------------------------------------------------------------- edit profile

function ProfileDetailsForm({ user, onSaved }) {
  const defaultPhone = (user.addresses || []).find((a) => a.isDefault)?.phone || '';

  const [fullName, setFullName] = useState(user.fullName || '');
  const [phone, setPhone] = useState(defaultPhone);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [fieldError, setFieldError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    const trimmed = fullName.trim();
    if (!trimmed) {
      setFieldError('Full name is required.');
      return;
    }

    setFieldError(null);
    setNotice(null);
    setSaving(true);
    const result = await updateProfile({ fullName: trimmed, phone: phone.trim() });
    setSaving(false);

    if (!result.ok) {
      setNotice({ kind: 'error', message: result.message });
      return;
    }

    onSaved({ fullName: result.data.fullName });
    setNotice({ kind: 'success', message: 'Your details were saved.' });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormField
        id="fullName"
        label="Full name"
        value={fullName}
        onChange={(e) => setFullName(e.target.value)}
        autoComplete="name"
        disabled={saving}
        error={fieldError}
      />
      <FormField
        id="phone"
        label="Phone"
        hint="Updates the phone on your default address."
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
        autoComplete="tel"
        disabled={saving}
      />
      <FormNotice notice={notice} />
      <button
        type="submit"
        disabled={saving}
        className="btn-primary focus-ring inline-flex items-center gap-2 h-11 px-6 rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        {saving ? 'Saving…' : 'Save changes'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------- change password

function ChangePasswordForm({ hasPassword }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [fieldError, setFieldError] = useState(null);

  if (!hasPassword) {
    return (
      <p className="text-secondary">
        This account signs in with Google, so it has no password to change.
      </p>
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (saving) return;

    if (!currentPassword) {
      setFieldError('Enter your current password.');
      return;
    }
    if (newPassword.length < 6) {
      setFieldError('New password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirm) {
      setFieldError('The new passwords don’t match.');
      return;
    }

    setFieldError(null);
    setNotice(null);
    setSaving(true);
    const result = await changePassword({ currentPassword, newPassword });
    setSaving(false);

    if (!result.ok) {
      // The API's own copy ("Current password is incorrect") is the most useful one.
      setNotice({ kind: 'error', message: result.message });
      return;
    }

    setCurrentPassword('');
    setNewPassword('');
    setConfirm('');
    setNotice({
      kind: 'success',
      message: 'Password changed. Any outstanding reset links have been cancelled.',
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <FormField
        id="currentPassword"
        label="Current password"
        type="password"
        autoComplete="current-password"
        value={currentPassword}
        onChange={(e) => setCurrentPassword(e.target.value)}
        disabled={saving}
      />
      <FormField
        id="newPassword"
        label="New password"
        type="password"
        autoComplete="new-password"
        hint="At least 6 characters."
        value={newPassword}
        onChange={(e) => setNewPassword(e.target.value)}
        disabled={saving}
      />
      <FormField
        id="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        disabled={saving}
        error={fieldError}
      />
      <FormNotice notice={notice} />
      <button
        type="submit"
        disabled={saving}
        className="btn-primary focus-ring inline-flex items-center gap-2 h-11 px-6 rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
        {saving ? 'Updating…' : 'Change password'}
      </button>
      <p className="text-small text-secondary">
        Forgot it instead?{' '}
        <Link
          href="/forgot-password"
          className="text-ink font-medium hover:underline underline-offset-4 focus-ring rounded"
        >
          Reset by email
        </Link>
        .
      </p>
    </form>
  );
}

function FormField({ id, label, hint, error, ...inputProps }) {
  return (
    <div>
      <label htmlFor={id} className="block text-small font-medium mb-2">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={error ? 'true' : undefined}
        className={`w-full h-12 rounded-lg border bg-surface px-4 text-base focus-ring ${
          error ? 'border-red-400' : 'border-border'
        }`}
        {...inputProps}
      />
      {hint && !error && <p className="text-small text-secondary mt-2">{hint}</p>}
      {error && <p className="text-small text-red-600 mt-2">{error}</p>}
    </div>
  );
}

function FormNotice({ notice }) {
  if (!notice) return null;
  return (
    <p
      role={notice.kind === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`text-small rounded-lg px-4 py-3 border ${
        notice.kind === 'error'
          ? 'border-red-300 bg-red-50 text-red-700'
          : 'border-sage/30 bg-sage/5 text-sage'
      }`}
    >
      {notice.message}
    </p>
  );
}

// ------------------------------------------------------------------ layout

function PageFrame({ children }) {
  return (
    <main className="min-h-screen bg-canvas">
      <SiteHeader />
      <div className="container-main pt-[72px] section-py">{children}</div>
    </main>
  );
}

function LoadingState() {
  return (
    <div
      className="flex items-center gap-3 text-secondary py-24"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
      <span className="text-small">Loading your account…</span>
    </div>
  );
}

function EmptyState({ title, body, actionLabel, actionHref, onRetry }) {
  return (
    <div className="max-w-xl">
      <span className="text-caption font-mono text-secondary uppercase tracking-wider">
        Account
      </span>
      <h1 className="text-h1 mt-3">{title}</h1>
      {body && <p className="text-secondary mt-4">{body}</p>}
      <div className="mt-8">
        {onRetry ? (
          <button
            type="button"
            onClick={onRetry}
            className="btn-primary focus-ring inline-flex items-center gap-2 h-12 px-6 rounded-lg font-medium"
          >
            <RefreshCw size={18} aria-hidden="true" />
            Try again
          </button>
        ) : (
          <Link
            href={actionHref}
            className="btn-primary focus-ring inline-flex items-center h-12 px-6 rounded-lg font-medium"
          >
            {actionLabel}
          </Link>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-surface border border-border rounded-xl p-6">
      <span className="text-caption font-mono text-secondary uppercase tracking-wider">
        {label}
      </span>
      <p className="text-h3 mt-3">{value}</p>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section className="mt-12">
      <h2 className="text-h3 mb-6">{title}</h2>
      <div className="bg-surface border border-border rounded-xl p-6">
        {children}
      </div>
    </section>
  );
}

// ------------------------------------------------------------------ helpers

function formatPoints(points) {
  if (points === null || points === undefined) return '0';
  return new Intl.NumberFormat('vi-VN').format(points);
}

function titleCase(value) {
  if (!value) return '—';
  return value.charAt(0) + value.slice(1).toLowerCase();
}

function formatDate(value) {
  if (!value) return 'recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'recently';
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}
