'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { postLogout } from '../../../lib/auth-client';
import { useI18n } from '../../../lib/i18n';

export default function LogoutPage() {
  const { t } = useI18n();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    postLogout().then((result) => {
      if (cancelled) return;
      if (!result.ok) {
        setFailed(true);
        return;
      }
      window.location.replace('/?loggedout=1');
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="text-center" role="status" aria-live="polite">
        {failed ? (
          <>
            <p className="text-secondary">
              {t('auth.logout.failedMsg')}
            </p>
            <Link
              href="/"
              className="btn-primary focus-ring inline-flex items-center h-12 px-6 rounded-lg font-medium mt-6"
            >
              {t('auth.logout.backToHome')}
            </Link>
          </>
        ) : (
          <div className="flex items-center gap-3 text-secondary">
            <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
            <span className="text-small">{t('auth.logout.signingOut')}</span>
          </div>
        )}
      </div>
    </main>
  );
}
