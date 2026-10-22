'use client';

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { resetPassword } from '../../../lib/account-client';
import { useI18n } from '../../../lib/i18n';
import LanguageSwitcher from '../../../components/LanguageSwitcher';

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
  const { t } = useI18n();
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
      setFieldError(t('auth.register.passwordMinError', { min: PASSWORD_MIN }));
      return;
    }
    if (password.length > PASSWORD_MAX) {
      setFieldError(t('auth.register.passwordMaxError', { max: PASSWORD_MAX }));
      return;
    }
    if (password !== confirm) {
      setFieldError(t('auth.reset.passwordsDontMatch'));
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
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-2xl font-display font-medium tracking-tight focus-ring rounded-lg"
            >
              aevo.
            </Link>
            <LanguageSwitcher />
          </div>

          <span className="block text-caption font-mono text-secondary uppercase tracking-wider mt-8">
            {t('auth.accountEyebrow')}
          </span>
          <h1 className="text-h1 mt-2">{t('auth.reset.heading')}</h1>

          {!token ? (
            <>
              <p role="alert" className="text-secondary mt-4">
                {t('auth.reset.incompleteLink')}
              </p>
              <Link
                href="/forgot-password"
                className="btn-primary focus-ring inline-flex items-center h-12 px-6 rounded-lg font-medium mt-8"
              >
                {t('auth.reset.requestNewLink')}
              </Link>
            </>
          ) : (
            <>
              <p className="text-secondary mt-2">
                {t('auth.reset.desc')}
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
                    {t('auth.reset.requestNewLink')}
                  </Link>
                </p>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
                <div>
                  <label htmlFor="password" className="block text-small font-medium mb-2">
                    {t('auth.reset.newPasswordLabel')}
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
                    {t('auth.reset.passwordHint', { min: PASSWORD_MIN })}
                  </p>
                </div>

                <div>
                  <label htmlFor="confirm" className="block text-small font-medium mb-2">
                    {t('auth.reset.confirmNewPasswordLabel')}
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
                  {phase === 'submitting'
                    ? t('auth.reset.saving')
                    : t('auth.reset.setNewPasswordBtn')}
                </button>
              </form>
            </>
          )}

          <p className="text-small text-secondary mt-8">
            <Link
              href="/login"
              className="text-ink font-medium hover:underline underline-offset-4 focus-ring rounded"
            >
              {t('auth.backToSignIn')}
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
