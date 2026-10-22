import './globals.css';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { I18nProvider } from '../lib/i18n';
import { LOCALE_COOKIE_NAME, normalizeLocale } from '../lib/i18n/dictionaries';
import { ThemeProvider } from '../components/providers/theme-provider';
import PageTransition from '../components/PageTransition';

const inter = Inter({ subsets: ['latin', 'vietnamese'] });

export const metadata = {
  title: 'AEVO — Premium Computing, Refined',
  description: 'Discover exceptional hardware for everything you create.',
};

export default function RootLayout({ children }) {
  const cookieStore = cookies();
  const rawLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = normalizeLocale(rawLocale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider>
          <I18nProvider initialLocale={locale}>
            <PageTransition>{children}</PageTransition>
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
