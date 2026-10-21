'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { requestPasswordReset } from '../../../lib/account-client';

/**
 * /forgot-password
 *
 * POST /api/auth/forgot-password { email } -> 200 { message } always, whether
 * or not the address exists. The API never returns the reset token; the link
 * (CLIENT_URL/reset-password?token=…) is delivered by email. Without SMTP the
 * API writes the email to its log, which is where to find the link locally.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState('idle'); // 'idle' | 'submitting' | 'sent'
  const [notice, setNotice] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (phase !== 'idle') return;

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setNotice({ kind: 'error', message: 'Enter a valid email address.' });
      return;
    }

    setNotice(null);
    setPhase('submitting');
    const result = await requestPasswordReset(trimmed);

    if (!result.ok) {
      setNotice({ kind: 'error', message: result.message });
      setPhase('idle');
      return;
    }

    setPhase('sent');
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
          <h1 className="text-h1 mt-2">Reset your password</h1>

          {phase === 'sent' ? (
            <>
              <p role="status" aria-live="polite" className="text-secondary mt-4">
                If an account exists for <span className="text-ink font-medium">{email.trim()}</span>,
                a reset link is on its way. The link expires in one hour and can be
                used once.
              </p>
              <p className="text-small text-secondary mt-4">
                Didn’t get it? Check your spam folder, or{' '}
                <button
                  type="button"
                  onClick={() => setPhase('idle')}
                  className="text-ink font-medium hover:underline underline-offset-4 focus-ring rounded"
                >
                  try another address
                </button>
                .
              </p>
            </>
          ) : (
            <>
              <p className="text-secondary mt-2">
                Enter the email you signed up with and we’ll send a link to set a
                new password.
              </p>

              {notice && (
                <p
                  role="alert"
                  className="mt-6 text-small rounded-lg px-4 py-3 border border-red-300 bg-red-50 text-red-700"
                >
                  {notice.message}
                </p>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
                <div>
                  <label htmlFor="email" className="block text-small font-medium mb-2">
                    Email
                  </label>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={phase === 'submitting'}
                    className="w-full h-12 rounded-lg border border-border bg-surface px-4 text-base focus-ring"
                  />
                </div>

                <button
                  type="submit"
                  disabled={phase === 'submitting'}
                  className="btn-primary focus-ring w-full h-12 rounded-lg font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {phase === 'submitting' && (
                    <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                  )}
                  {phase === 'submitting' ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          <p className="text-small text-secondary mt-8">
            Remembered it?{' '}
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
