'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { ArrowRight, Loader2 } from 'lucide-react';
import {
  fetchProfile,
  postLogin,
  startGoogleLogin,
} from '@/lib/auth-client';
import { useI18n } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import ThemeSwitcher from '@/components/ThemeSwitcher';

/**
 * /login - split layout: brand panel on canvas (left), form on surface (right).
 *
 * Auth contract (see apps/api/src/modules/auth/auth.routes.js):
 *   POST /api/auth/login -> 200 {user, token} | 401 {error}
 *   GET  /api/auth/google  -> full-page redirect into the Google flow
 *   failure returns here as /login?error=oauth_failed
 */

// Only allow same-site relative targets from ?next (no open redirect).
function safeNext(value) {
  return typeof value === 'string' && value.startsWith('/') && !value.startsWith('//')
    ? value
    : '/account/profile';
}

const OAUTH_ERROR_COPY = {
  oauth_failed: 'Google sign-in was cancelled or failed. Please try again.',
};

function getParam(searchParams, key) {
  if (searchParams && typeof searchParams.get === 'function') {
    return searchParams.get(key);
  }
  if (searchParams && typeof searchParams === 'object' && key in searchParams) {
    const val = searchParams[key];
    return Array.isArray(val) ? val[0] : val;
  }
  if (typeof window !== 'undefined') {
    return new URLSearchParams(window.location.search).get(key);
  }
  return null;
}

export default function LoginPage({ searchParams }) {
  return <LoginView searchParams={searchParams} />;
}

// Hard navigation: replaces the current history entry so Back does not land
// on /login, which would bounce a live session forward again.
function goTo(target) {
  window.location.replace(target);
}

function LoginView({ searchParams }) {
  const { t } = useI18n();

  // ------------- state -------------
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // null | 'checking' (resolving existing session) | 'submitting' (password login)
  const [phase, setPhase] = useState('checking');
  // null | { kind: 'error' | 'info' | 'success', message }
  const [notice, setNotice] = useState(null);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Survives the bfcache trip to Google and back, unlike component state reset.
  const googleAttemptRef = useRef(false);

  // ------------- on mount: OAuth error, then session check -------------
  useEffect(() => {
    const oauthError = getParam(searchParams, 'error');
    // Arrived right after a sign-out: never bounce a (possibly still valid)
    // session forward or the user would be stuck in sign-out -> sign-in.
    const justLoggedOut = getParam(searchParams, 'loggedout') === '1';

    if (justLoggedOut) {
      setNotice({ kind: 'info', message: t('auth.login.signedOutNotice') });
      setPhase('idle');
    }

    if (oauthError) {
      setNotice({
        kind: 'error',
        message: t('auth.login.oauthFailedNotice'),
      });
      // The user is explicit here. Asking the API would bounce forward when an
      // older, still-valid cookie exists even though the Google attempt failed.
      setPhase('idle');
      return;
    }

    if (justLoggedOut) return;

    // Arriving here right after a password reset: don't bounce to the profile.
    const justReset = getParam(searchParams, 'reset') === 'success';
    if (getParam(searchParams, 'registered') === '1') {
      setNotice({ kind: 'success', message: t('auth.login.registeredNotice') });
    }
    if (justReset) {
      setNotice({ kind: 'success', message: t('auth.login.resetSuccessNotice') });
      setPhase('idle');
      return;
    }

    let cancelled = false;

    // Already signed in (cookie is httpOnly, so ask the API) -> skip the form.
    // Any failure (401, network, 5xx) simply reveals the form: no redirect,
    // so there is no path from /login back to itself.
    fetchProfile()
      .then((result) => {
        if (cancelled) return;
        if (result.status === 'ok') {
          goTo(safeNext(getParam(searchParams, 'next')));
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
    // Run once on mount; useSearchParams may change identity on re-render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Back/forward-cache restore after leaving for Google: either the round-trip
  // failed (API 503/error page, "Back" returns here) or the user cancelled.
  // Clear the spinner and, if the API did accept a session, move on.
  useEffect(() => {
    async function onPageShow(event) {
      if (!event.persisted || !googleAttemptRef.current) return;
      googleAttemptRef.current = false;
      setGoogleLoading(false);
      const result = await fetchProfile();
      if (result.status === 'ok') {
        goTo(safeNext(getParam(searchParams, 'next')));
        return;
      }
      setNotice({
        kind: 'error',
        message: t('auth.login.oauthIncompleteNotice'),
      });
    }
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ------------- password login -------------
  async function handleSubmit(event) {
    event.preventDefault();
    if (phase === 'submitting' || googleLoading) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setNotice({ kind: 'error', message: t('auth.login.enterCredentialsError') });
      return;
    }

    setNotice(null);
    setPhase('submitting');

    const result = await postLogin(trimmedEmail, password);

    if (result.ok) {
      setNotice({ kind: 'success', message: t('auth.login.signedInRedirecting') });
      goTo(safeNext(getParam(searchParams, 'next')));
      return;
    }

    setNotice({ kind: 'error', message: result.message });
    setPhase('idle');
  }

  // ------------- google sign-in (full-page navigation) -------------
  // The browser itself must load GET /api/auth/google: only a top-level
  // navigation follows the 302 to accounts.google.com and later accepts the
  // API's Set-Cookie on the callback. A fetch() probe cannot: the cross-origin
  // redirect has no CORS headers, the response is opaque, and Set-Cookie is
  // dropped - so that approach could never start (or finish) the flow.
  //
  // If the API has no Google credentials it answers 503 JSON, which would show
  // as a bare JSON page. We do not pre-probe (a fetch probe is what broke the
  // flow); instead the `pageshow` guard above catches this page being restored
  // from the back/forward cache after such a navigation.
  function handleGoogle() {
    if (isBusy) return;
    setNotice(null);
    setGoogleLoading(true);
    googleAttemptRef.current = true;
    startGoogleLogin('password');
  }

  const isSubmitting = phase === 'submitting';
  const isChecking = phase === 'checking';
  const isBusy = isSubmitting || googleLoading || isChecking;

  // ------------- JSX -------------
  return (
    <main className="min-h-screen grid lg:grid-cols-2 bg-surface">
      {/* ---- Left: brand panel ---- */}
      <aside className="hidden lg:flex flex-col justify-between bg-canvas border-r border-border p-16">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="text-2xl font-display font-medium tracking-tight text-ink focus-ring rounded-lg"
          >
            aevo.
          </Link>
        </div>

        <div className="max-w-md">
          <span className="text-caption font-mono text-secondary uppercase tracking-wider">
            {t('auth.accountEyebrow')}
          </span>
          <h1 className="text-display mt-4">{t('auth.login.welcomeBack')}</h1>
          <p className="text-xl text-secondary mt-6">
            {t('auth.login.sideDesc')}
          </p>
        </div>

        <p className="text-caption font-mono text-secondary uppercase tracking-wider">
          {t('auth.tagline')}
        </p>
      </aside>

      {/* ---- Right: form panel ---- */}
      <section className="flex flex-col justify-center px-4 py-12 md:px-8 lg:px-16">
        <div className="w-full max-w-md mx-auto">
          <div className="flex items-center justify-between mb-6">
            {/* Mobile brand */}
            <Link
              href="/"
              className="lg:hidden inline-block text-2xl font-display font-medium tracking-tight focus-ring rounded-lg"
            >
              aevo.
            </Link>
            <div className="ml-auto flex items-center gap-2">
              <ThemeSwitcher />
              <LanguageSwitcher />
            </div>
          </div>

          <span className="text-caption font-mono text-secondary uppercase tracking-wider">
            {t('auth.login.signInEyebrow')}
          </span>
          <h2 className="text-h1 mt-3">{t('auth.login.heading')}</h2>

          {notice && (
            <p
              role={notice.kind === 'error' ? 'alert' : 'status'}
              aria-live="polite"
              className={`mt-6 text-small rounded-lg border px-4 py-3 ${
                notice.kind === 'error'
                  ? 'border-danger/30 bg-danger/10 text-danger'
                  : notice.kind === 'success'
                    ? 'border-sage/30 bg-sage/5 text-sage'
                    : 'border-border bg-canvas text-secondary'
              }`}
            >
              {notice.message}
            </p>
          )}

          {/* Google (primary method) */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={isBusy}
            className="btn-secondary w-full mt-8 inline-flex items-center justify-center gap-3 h-12 rounded-lg font-medium focus-ring disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            ) : (
              <GoogleMark />
            )}
            {googleLoading
              ? t('auth.redirectingToGoogle')
              : t('auth.continueWithGoogle')}
          </button>

          {/* Divider */}
          <div className="flex items-center gap-4 my-8" aria-hidden="true">
            <div className="h-px flex-1 bg-border" />
            <span className="text-caption font-mono text-secondary uppercase tracking-wider">
              {t('auth.or')}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-small font-medium text-ink mb-2"
              >
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
                disabled={isSubmitting}
                placeholder="you@example.com"
                className="focus-ring w-full h-12 px-4 rounded-lg bg-canvas border border-border text-ink placeholder:text-titanium disabled:opacity-60"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <label
                  htmlFor="password"
                  className="block text-small font-medium text-ink"
                >
                  {t('auth.passwordLabel')}
                </label>
                <Link
                  href="/forgot-password"
                  className="text-caption text-secondary hover:text-ink transition-colors focus-ring rounded"
                >
                  {t('auth.login.forgotPassword')}
                </Link>
              </div>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isSubmitting}
                placeholder="••••••••"
                className="focus-ring w-full h-12 px-4 rounded-lg bg-canvas border border-border text-ink placeholder:text-titanium disabled:opacity-60"
              />
            </div>

            <button
              type="submit"
              disabled={isBusy}
              className="btn-primary focus-ring w-full h-12 inline-flex items-center justify-center gap-2 rounded-lg font-medium disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                  {t('auth.login.signingIn')}
                </>
              ) : (
                <>
                  {t('auth.login.signInBtn')}
                  <ArrowRight size={18} aria-hidden="true" />
                </>
              )}
            </button>

            {/* Render in the busy state so the button disables while checking */}
            <p
              className={`text-small text-center text-secondary ${isChecking ? '' : 'sr-only'}`}
              aria-live="polite"
            >
              {t('auth.login.checkingSession')}
            </p>
          </form>

          <p className="mt-8 text-small text-secondary text-center">
            {t('auth.login.newToAevo')}{' '}
            <Link
              href="/register"
              className="text-ink font-medium hover:underline underline-offset-4 focus-ring rounded"
            >
              {t('auth.login.createAnAccount')}
            </Link>
          </p>

          <div className="mt-12 pt-6 border-t border-border">
            <Link
              href="/"
              className="text-small text-secondary hover:text-ink transition-colors focus-ring rounded"
            >
              {t('auth.backToShop')}
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}

function GoogleMark() {
  return (
    <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09a6.6 6.6 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1a11 11 0 0 0-9.82 6.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}
