'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { requestPasswordReset } from '../../../lib/account-client';
import { useI18n } from '../../../lib/i18n';
import LanguageSwitcher from '../../../components/LanguageSwitcher';
import ThemeSwitcher from '../../../components/ThemeSwitcher';

export default function ForgotPasswordPage() {
  const { t } = useI18n();
  const [email, setEmail] = useState('');
  const [phase, setPhase] = useState('idle'); // 'idle' | 'submitting' | 'sent'
  const [notice, setNotice] = useState(null);

  async function handleSubmit(event) {
    event.preventDefault();
    if (phase !== 'idle') return;

    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setNotice({ kind: 'error', message: t('auth.forgot.validEmailError') });
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
          <div className="flex items-center justify-between">
            <Link
              href="/"
              className="text-2xl font-display font-medium tracking-tight focus-ring rounded-lg"
            >
              aevo.
            </Link>
            <div className="flex items-center gap-2">
              <ThemeSwitcher />
              <LanguageSwitcher />
            </div>
          </div>

          <span className="block text-caption font-mono text-secondary uppercase tracking-wider mt-8">
            {t('auth.accountEyebrow')}
          </span>
          <h1 className="text-h1 mt-2">{t('auth.forgot.heading')}</h1>

          {phase === 'sent' ? (
            <>
              <p role="status" aria-live="polite" className="text-secondary mt-4">
                {t('auth.forgot.sentPrefix')}{' '}
                <span className="text-ink font-medium">{email.trim()}</span>
                {t('auth.forgot.sentSuffix')}
              </p>
              <p className="text-small text-secondary mt-4">
                {t('auth.forgot.didntGetIt')}{' '}
                <button
                  type="button"
                  onClick={() => setPhase('idle')}
                  className="text-ink font-medium hover:underline underline-offset-4 focus-ring rounded"
                >
                  {t('auth.forgot.tryAnotherAddress')}
                </button>
                .
              </p>
            </>
          ) : (
            <>
              <p className="text-secondary mt-2">
                {t('auth.forgot.desc')}
              </p>

              {notice && (
                <p
                  role="alert"
                  className="mt-6 text-small rounded-lg px-4 py-3 border border-danger/30 bg-danger/10 text-danger"
                >
                  {notice.message}
                </p>
              )}

              <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
                <div>
                  <label htmlFor="email" className="block text-small font-medium mb-2">
                    {t('auth.emailLabel')}
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
                  {phase === 'submitting'
                    ? t('auth.forgot.sending')
                    : t('auth.forgot.sendResetLinkBtn')}
                </button>
              </form>
            </>
          )}

          <p className="text-small text-secondary mt-8">
            {t('auth.forgot.rememberedIt')}{' '}
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
