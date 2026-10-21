'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { resetPassword } from '../../../lib/account-client';

/**
 * /reset-password?token=…
 *
 * The API's forgot-password mail links here. POST /api/auth/reset-password
 * { token, newPassword } -> 200 { message } | 400 { error } when the token is
 * invalid, expired or already used. Tokens are single-use.
 */

const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72;

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-canvas flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-secondary" />
        </main>
      }
    >
      <ResetPasswordView />
    </Suspense>
  );
}

function ResetPasswordView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [phase, setPhase] = useState('idle'); // 'idle' | 'submitting' | 'done'
  const [notice, setNotice] = useState(null);
  const [fieldError, setFieldError] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (phase !== 'idle') return;

    if (password.length < PASSWORD_MIN) {
      setFieldError(`Password must be at least ${PASSWORD_MIN} characters.`);
      return;
    }
    if (password.length > PASSWORD_MAX) {
      setFieldError(`Password must be at most ${PASSWORD_MAX} characters.`);
      return;
    }
    if (password !== confirm) {
      setFieldError('The passwords don’t match.');
      return;
    }

    setFieldError(null);
    setNotice(null);
    setPhase('submitting');

    const result = await resetPassword({ token, newPassword: password });

    if (result.ok) {
      setPhase('done');
      router.replace('/login?reset=success');
      return;
    }

    setNotice({ kind: 'error', message: result.message });
    setPhase('idle');
  }

  return (
    <main className="min-h-screen bg-canvas">
      <div className="container-main min-h-screen flex flex-col justify-center py-12">
        <div className="w-full max-w-md mx-auto bg-surface border border-border rounded-2xl p-8 md:p-10">
          <Link
            href="/"
            className="text-2xl font-display font-medium tracking-tight focus-ring rounded-lg"
          >
            aevo.
          </Link>

          <span className="block text-caption font-mono text-secondary uppercase tracking-wider mt-8">
            Account
          </span>
          <h1 className="text-h1 mt-2">Choose a new password</h1>

          {!token ? (
            <>
              <p role="alert" className="text-secondary mt-4">
                This reset link is incomplete. Open the link from your email, or
                request a new one.
              </p>
              <Link
                href="/forgot-password"
                className="btn-primary focus-ring inline-flex items-center h-12 px-6 rounded-lg font-medium mt-8"
              >
                Request a new link
              </Link>
            </>
          ) : (
            <>
              <p className="text-secondary mt-2">
                Pick a password you haven’t used before, then sign in with it.
              </p>

              {notice && (
                <p
                  role="alert"
                  className="mt-6 text-small rounded-lg px-4 py-3 border border-red-300 bg-red-50 text-red-700"
                >
                  {notice.message}{' '}
                  <Link
                    href="/forgot-password"
                    className="font-medium underline underline-offset-4 focus-ring rounded"
                  >
                    Request a new link
                  </Link>
                </p>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
                <div>
                  <label htmlFor="password" className="block text-small font-medium mb-2">
                    New password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={phase !== 'idle'}
                    className="w-full h-12 rounded-lg border border-border bg-surface px-4 text-base focus-ring"
                  />
                  <p className="text-small text-secondary mt-2">
                    At least {PASSWORD_MIN} characters.
                  </p>
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-small font-medium mb-2">
                    Confirm new password
                  </label>
                  <input
                    id="confirm"
                    name="confirm"
                    type="password"
                    autoComplete="new-password"
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    disabled={phase !== 'idle'}
                    aria-invalid={fieldError ? 'true' : undefined}
                    className="w-full h-12 rounded-lg border border-border bg-surface px-4 text-base focus-ring"
                  />
                </div>

                {fieldError && (
                  <p role="alert" className="text-small text-red-600">
                    {fieldError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={phase !== 'idle'}
                  className="btn-primary focus-ring w-full h-12 rounded-lg font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {phase === 'submitting' && (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  )}
                  {phase === 'submitting' ? 'Saving…' : 'Set new password'}
                </button>
              </form>
            </>
          )}

          <p className="text-small text-secondary mt-8">
            <Link
              href="/login"
              className="text-ink font-medium hover:underline underline-offset-4 focus-ring rounded"
            >
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
