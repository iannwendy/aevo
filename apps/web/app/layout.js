import './globals.css';
import { Inter } from 'next/font/google';
import { cookies } from 'next/headers';
import { I18nProvider } from '../lib/i18n';
import {
  LOCALE_COOKIE_NAME,
  normalizeLocale,
  translate,
  formatAevoTitle,
} from '../lib/i18n/dictionaries';
import dynamic from 'next/dynamic';
import { ThemeProvider } from '../components/providers/theme-provider';
import PageTransition from '../components/PageTransition';

const AiAssistantWidget = dynamic(() => import('../components/ai/AiAssistantWidget'));

const inter = Inter({ subsets: ['latin', 'vietnamese'] });
const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL || process.env.CLIENT_URL || 'http://localhost:3000';

export async function generateMetadata() {
  const cookieStore = cookies();
  const locale = normalizeLocale(cookieStore.get(LOCALE_COOKIE_NAME)?.value);
  const title = formatAevoTitle(translate(locale, 'pageTitles.home'));
  const description = 'Discover exceptional hardware for everything you create.';
  return {
    metadataBase: new URL(SITE_URL),
    title,
    description,
    keywords: [
      'AEVO',
      'computer store',
      'laptops',
      'PC components',
      'monitors',
      'workstation',
      'NVIDIA RTX',
      'MacBook Pro',
    ],
    openGraph: {
      title,
      description,
      url: SITE_URL,
      siteName: 'AEVO',
      locale: locale === 'vi' ? 'vi_VN' : 'en_US',
      type: 'website',
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  };
}

export default function RootLayout({ children }) {
  const cookieStore = cookies();
  const rawLocale = cookieStore.get(LOCALE_COOKIE_NAME)?.value;
  const locale = normalizeLocale(rawLocale);

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://macone.vn" crossOrigin="anonymous" />
      </head>
      <body className={inter.className}>
        <ThemeProvider>
          <I18nProvider initialLocale={locale}>
            <PageTransition>{children}</PageTransition>
            <AiAssistantWidget />
          </I18nProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
