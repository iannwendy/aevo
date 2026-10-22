'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { GOOGLE_AUTH_URL, fetchProfile } from '../../../lib/auth-client';
import { register } from '../../../lib/account-client';
import { useI18n } from '../../../lib/i18n';
import LanguageSwitcher from '../../../components/LanguageSwitcher';

/**
 * /register
 *
 * POST /api/auth/register -> 201 {user, token} (cookie set) | 400 {error | errors[]}
 * The account signs in straight away, so a success continues to the profile.
 */

const PASSWORD_MIN = 6;
const PASSWORD_MAX = 72;

export default function RegisterPage() {
  const { t } = useI18n();
  const router = useRouter();

  // null | 'checking' (resolving existing session) | 'submitting'
  const [phase, setPhase] = useState('checking');
  // null | { kind: 'error' | 'success', message }
  const [notice, setNotice] = useState(null);
  const [fieldErrors, setFieldErrors] = useState({});
  const [form, setForm] = useState({ fullName: '', email: '', password: '' });

  // Already signed in? Skip the form (same pattern as /login).
  useEffect(() => {
    let cancelled = false;
    fetchProfile()
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'ok') {
          router.replace('/account/profile');
          return;
        }
        setPhase('idle');
      })
      .catch(() => {
        if (!cancelled) setPhase('idle');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function update(field) {
    return (event) => {
      setForm((prev) => ({ ...prev, [field]: event.target.value }));
      setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
    };
  }

  function validate() {
    const errors = {};
    const fullName = form.fullName.trim();
    const email = form.email.trim();

    if (!fullName) errors.fullName = t('auth.register.enterFullNameError');
    if (!email) errors.email = t('auth.register.enterEmailError');
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      errors.email = t('auth.register.validEmailError');
    }
    if (form.password.length < PASSWORD_MIN) {
      errors.password = t('auth.register.passwordMinError', { min: PASSWORD_MIN });
    } else if (form.password.length > PASSWORD_MAX) {
      errors.password = t('auth.register.passwordMaxError', { max: PASSWORD_MAX });
    }

    setFieldErrors(errors);
    return Object.keys(errors).length === 0
      ? { fullName, email, password: form.password }
      : null;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (phase === 'submitting') return;

    setNotice(null);
    const payload = validate();
    if (!payload) return;

    setPhase('submitting');
    const result = await register(payload);

    if (result.ok) {
      setNotice({ kind: 'success', message: t('auth.register.accountCreatedOpening') });
      router.replace('/account/profile');
      return;
    }

    if (result.status === 400 && /already registered/i.test(result.message)) {
      setFieldErrors({ email: t('auth.register.alreadyRegisteredError') });
    }
    setNotice({ kind: 'error', message: result.message });
    setPhase('idle');
  }

  const isSubmitting = phase === 'submitting';
  const isBusy = isSubmitting || phase === 'checking';

  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-surface">
      {/* ---- Left: brand panel ---- */}
      <aside className="hidden lg:flex flex-col justify-between bg-canvas border-r border-border p-16">
        <Link
          href="/"
          className="text-2xl font-display font-medium tracking-tight text-ink focus-ring rounded-lg"
        >
          aevo.
        </Link>

        <div className="max-w-md">
          <span className="text-caption font-mono text-secondary uppercase tracking-wider">
            {t('auth.accountEyebrow')}
          </span>
          <h1 className="text-display mt-4">{t('auth.register.joinAevo')}</h1>
          <p className="text-xl text-secondary mt-6">
            {t('auth.register.sideDesc')}
          </p>
        </div>

        <p className="text-caption font-mono text-secondary uppercase tracking-wider">
          {t('auth.tagline')}
        </p>
      </aside>

      {/* ---- Right: form panel ---- */}
      <section className="flex flex-col justify-center px-6 py-12 md:px-16 lg:px-24">
        <div className="w-full max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/"
              className="lg:hidden text-2xl font-display font-medium tracking-tight focus-ring rounded-lg"
            >
              aevo.
            </Link>
            <div className="ml-auto">
              <LanguageSwitcher />
            </div>
          </div>

          <h2 className="text-h1">{t('auth.register.heading')}</h2>
          <p className="text-secondary mt-2">
            {t('auth.register.alreadyHaveOne')}{' '}
            <Link
              href="/login"
              className="text-ink font-medium hover:underline underline-offset-4 focus-ring rounded"
            >
              {t('auth.register.signInLink')}
            </Link>
          </p>

          {notice && (
            <p
              role={notice.kind === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              className={`mt-6 text-small rounded-lg px-4 py-3 border ${
                notice.kind === 'error'
                  ? 'border-red-300 bg-red-50 text-red-700'
                  : 'border-sage/30 bg-sage/5 text-sage'
              }`}
            >
              {notice.message}
            </p>
          )}

          <form onSubmit={handleSubmit} className="mt-8 space-y-5" noValidate>
            <Field
              id="fullName"
              label={t('auth.fullNameLabel')}
              type="text"
              autoComplete="name"
              value={form.fullName}
              onChange={update('fullName')}
              error={fieldErrors.fullName}
              disabled={isBusy}
            />
            <Field
              id="email"
              label={t('auth.emailLabel')}
              type="email"
              autoComplete="email"
              value={form.email}
              onChange={update('email')}
              error={fieldErrors.email}
              disabled={isBusy}
            />
            <Field
              id="password"
              label={t('auth.passwordLabel')}
              type="password"
              autoComplete="new-password"
              value={form.password}
              onChange={update('password')}
              error={fieldErrors.password}
              disabled={isBusy}
              hint={t('auth.register.passwordHint', { min: PASSWORD_MIN })}
            />

            <button
              type="submit"
              disabled={isBusy}
              className="btn-primary focus-ring w-full h-12 rounded-lg font-medium inline-flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
              {isSubmitting
                ? t('auth.register.creatingAccount')
                : t('auth.register.createAccountBtn')}
            </button>
          </form>

          <div className="my-8 flex items-center gap-4" aria-hidden="true">
            <span className="h-px flex-1 bg-border" />
            <span className="text-caption font-mono text-secondary uppercase tracking-wider">
              {t('auth.or')}
            </span>
            <span className="h-px flex-1 bg-border" />
          </div>

          <a
            href={GOOGLE_AUTH_URL}
            className="btn-secondary focus-ring w-full h-12 rounded-lg font-medium inline-flex items-center justify-center"
          >
            {t('auth.continueWithGoogle')}
          </a>

          <p className="text-small text-secondary mt-6">
            {t('auth.register.termsNotice')}
          </p>
        </div>
      </section>
    </main>
  );
}

function Field({ id, label, error, hint, ...inputProps }) {
  const describedBy = [hint && `${id}-hint`, error && `${id}-error`]
    .filter(Boolean)
    .join(' ');

  return (
    <div>
      <label htmlFor={id} className="block text-small font-medium mb-2">
        {label}
      </label>
      <input
        id={id}
        name={id}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy || undefined}
        className={`w-full h-12 rounded-lg border bg-surface px-4 text-base focus-ring ${
          error ? 'border-red-400' : 'border-border'
        }`}
        {...inputProps}
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="text-small text-secondary mt-2">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="text-small text-red-600 mt-2">
          {error}
        </p>
      )}
    </div>
  );
}
