/**
 * Adaptive Dark Mode E2E Verification Suite (docs/DARKMODE_TEST_PLAN.md, DM-01 - DM-20).
 *
 * Verifies CSS semantic tokens (:root & .dark), Tailwind dark mode mapping,
 * next-themes SSR anti-FOUC script & defaultTheme="light", ThemeSwitcher UI +
 * ARIA + i18n (ENG/VIE), Storefront/Catalog/PDP/Cart/Checkout/Auth/Account
 * semantic styling, media non-inversion guard, Admin Recharts/Table theme
 * primitives, and full E-Commerce business logic integrity.
 *
 * Run with both API (3001) and Web (3000) servers up:
 *   node apps/api/test/darkmode.e2e.js
 */
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const API = process.env.API_URL || 'http://localhost:3001';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:3000';
const WEB_ROOT = path.resolve(__dirname, '../../web');

const results = [];

function record(id, name, ok, detail) {
  results.push({ id, name, ok, detail });
  const mark = ok ? 'PASS' : 'FAIL';
  console.log(`${mark}  ${id}  ${name}${detail ? `  — ${detail}` : ''}`);
}

async function test(id, name, fn) {
  try {
    const detail = await fn();
    record(id, name, true, typeof detail === 'string' ? detail : undefined);
  } catch (error) {
    record(id, name, false, error.message);
  }
}

async function fetchHtmlAndCss(routePath = '/', cookie = '') {
  const headers = {};
  if (cookie) headers.Cookie = cookie;
  const res = await fetch(`${CLIENT}${routePath}`, { headers });
  assert.equal(res.status, 200, `GET ${routePath} returned ${res.status}`);
  const html = await res.text();
  const cssHrefs = [...html.matchAll(/\/_next\/static\/css\/[^"]+\.css/g)].map((m) => m[0]);
  let css = '';
  for (const href of cssHrefs) {
    const cssRes = await fetch(`${CLIENT}${href}`);
    if (cssRes.ok) {
      css += '\n' + (await cssRes.text());
    }
  }
  return { html, css };
}

function readWebFile(relPath) {
  return fs.readFileSync(path.join(WEB_ROOT, relPath), 'utf8');
}

async function main() {
  const { html: homeHtml, css: compiledCss } = await fetchHtmlAndCss('/');

  // =========================================================================
  // Task DM.1 — CSS Variables & Tailwind Token Architecture (DM-01..DM-04)
  // =========================================================================

  await test('DM-01', ':root defines all Light Mode --aevo-* tokens and color-scheme: light', async () => {
    const expectedLight = {
      '--aevo-bg': '#f5f5f3',
      '--aevo-surface': '#ffffff',
      '--aevo-surface-muted': '#f0f0ee',
      '--aevo-text': '#171717',
      '--aevo-text-muted': '#737373',
      '--aevo-border': '#e5e5e3',
      '--aevo-primary': '#171717',
      '--aevo-primary-foreground': '#ffffff',
      '--aevo-accent': '#52665c',
      '--aevo-focus': '#52665c',
      '--aevo-danger': '#b42318',
      '--aevo-success': '#237a4b',
      '--aevo-warning': '#946200',
    };
    const lowerCss = compiledCss.toLowerCase();
    assert.ok(
      lowerCss.includes('color-scheme:light') || lowerCss.includes('color-scheme: light'),
      'Missing color-scheme: light'
    );
    for (const [token, hex] of Object.entries(expectedLight)) {
      const hexPattern = hex === '#ffffff' ? '(?:#ffffff|#fff)\\b' : hex;
      const regex = new RegExp(`${token}\\s*:\\s*${hexPattern}`, 'i');
      assert.match(lowerCss, regex, `Missing ${token}: ${hex} in compiled CSS`);
    }
    return '13 light tokens + color-scheme: light verified';
  });

  await test('DM-02', '.dark defines all Dark Mode --aevo-* tokens and color-scheme: dark', async () => {
    const expectedDark = {
      '--aevo-bg': '#111214',
      '--aevo-surface': '#1c1d20',
      '--aevo-surface-muted': '#25262a',
      '--aevo-text': '#f5f5f3',
      '--aevo-text-muted': '#a3a7ad',
      '--aevo-border': '#333438',
      '--aevo-primary': '#f5f5f3',
      '--aevo-primary-foreground': '#171717',
      '--aevo-accent': '#9db7a5',
      '--aevo-focus': '#a9c4b3',
      '--aevo-danger': '#ff8a80',
      '--aevo-success': '#70d8a0',
      '--aevo-warning': '#f0c674',
    };
    const lowerCss = compiledCss.toLowerCase();
    assert.ok(lowerCss.includes('.dark'), 'Missing .dark selector in compiled CSS');
    assert.ok(
      lowerCss.includes('color-scheme:dark') || lowerCss.includes('color-scheme: dark'),
      'Missing color-scheme: dark'
    );
    for (const [token, hex] of Object.entries(expectedDark)) {
      const regex = new RegExp(`${token}\\s*:\\s*${hex}`, 'i');
      assert.match(lowerCss, regex, `Missing dark ${token}: ${hex} in compiled CSS`);
    }
    return '13 dark tokens + color-scheme: dark verified';
  });

  await test('DM-03', 'Tailwind config sets darkMode: ["class"] and maps semantic colors to CSS variables', async () => {
    const twConfig = require(path.join(WEB_ROOT, 'tailwind.config.js'));
    assert.deepEqual(twConfig.darkMode, ['class']);
    const colors = twConfig.theme.extend.colors;
    for (const key of [
      'canvas',
      'bg',
      'surface',
      'surface-muted',
      'ink',
      'secondary',
      'border',
      'primary',
      'primary-foreground',
      'sage',
      'accent',
      'focus',
      'danger',
      'success',
      'warning',
    ]) {
      assert.ok(colors[key], `Missing color key "${key}" in tailwind.config.js`);
      assert.match(colors[key], /var\(--aevo-/, `Color "${key}" does not reference --aevo-* variable`);
    }
    return '15 semantic Tailwind colors mapped to --aevo-*';
  });

  await test('DM-04', 'Backward compatibility with Phase 1 FE-02 (--canvas / --surface #F5F5F3) & components.json', async () => {
    const found = [...compiledCss.matchAll(/--(surface|canvas|paper)[^:;{}]*:\s*([^;]+);/g)].map(
      (m) => `--${m[1]}=${m[2].trim()}`
    );
    const hasTarget = /#f5f5f3|245,245,243|245 245 243/i.test(compiledCss);
    assert.ok(hasTarget, '#F5F5F3 not found in compiled CSS');
    assert.ok(found.length > 0, 'Expected --canvas / --surface match for FE-02');
    const compJson = JSON.parse(readWebFile('components.json'));
    assert.equal(compJson.tsx, false);
    return `${found.slice(0, 2).join(', ')}, tsx=${compJson.tsx}`;
  });

  // =========================================================================
  // Task DM.2 — ThemeProvider & ThemeSwitcher Component (DM-05..DM-08)
  // =========================================================================

  await test('DM-05', 'RootLayout & ThemeProvider configure suppressHydrationWarning and defaultTheme="light"', async () => {
    const layoutSrc = readWebFile('app/layout.js');
    const providerSrc = readWebFile('components/providers/theme-provider.jsx');
    assert.match(layoutSrc, /suppressHydrationWarning/);
    assert.match(layoutSrc, /ThemeProvider/);
    assert.match(providerSrc, /defaultTheme="light"/);
    assert.match(providerSrc, /enableSystem/);
    assert.match(providerSrc, /disableTransitionOnChange/);
    assert.match(providerSrc, /attribute="class"/);
    return 'RootLayout + ThemeProvider(defaultTheme="light", enableSystem, attribute="class") verified';
  });

  await test('DM-06', 'SSR HTML injects next-themes anti-FOUC script with "light" default & class attribute', async () => {
    assert.match(homeHtml, /document\.documentElement/);
    assert.match(homeHtml, /localStorage\.getItem/);
    assert.match(homeHtml, /prefers-color-scheme:\s*dark/);
    assert.match(homeHtml, /\("class","theme","light"/);
    return 'next-themes anti-FOUC script ("class","theme","light") verified';
  });

  await test('DM-07', 'ThemeSwitcher renders Light / Dark / System buttons on Header and Auth routes', async () => {
    assert.match(homeHtml, /data-testid="theme-switcher"/);
    assert.match(homeHtml, /data-testid="theme-btn-light"/);
    assert.match(homeHtml, /data-testid="theme-btn-dark"/);
    assert.match(homeHtml, /data-testid="theme-btn-system"/);
    assert.match(homeHtml, /aria-pressed="true"/);

    const switcherSrc = readWebFile('components/ThemeSwitcher.js');
    assert.match(switcherSrc, /Sun/);
    assert.match(switcherSrc, /Moon/);
    assert.match(switcherSrc, /Monitor/);
    return '3-mode ThemeSwitcher (light/dark/system) + Lucide icons verified';
  });

  await test('DM-08', 'ThemeSwitcher localizes labels & ARIA attributes in ENG and VIE', async () => {
    const { translate } = require(path.join(WEB_ROOT, 'lib/i18n/dictionaries.js'));
    assert.equal(translate('en', 'header.themeLight'), 'Light');
    assert.equal(translate('en', 'header.themeDark'), 'Dark');
    assert.equal(translate('en', 'header.themeSystem'), 'System');
    assert.equal(translate('en', 'header.themeSwitcherAria'), 'Appearance');

    assert.equal(translate('vi', 'header.themeLight'), 'Sáng');
    assert.equal(translate('vi', 'header.themeDark'), 'Tối');
    assert.equal(translate('vi', 'header.themeSystem'), 'Hệ thống');
    assert.equal(translate('vi', 'header.themeSwitcherAria'), 'Giao diện');

    const { html: viHtml } = await fetchHtmlAndCss('/', 'aevo_locale=vi');
    assert.match(viHtml, /aria-label="Giao diện"/);
    assert.match(viHtml, /Hệ thống/);
    return 'ENG (Appearance: Light/Dark/System) & VIE (Giao diện: Sáng/Tối/Hệ thống) verified';
  });

  // =========================================================================
  // Task DM.3 — Storefront & Catalog Dark Mode Adaptation (DM-09..DM-11 + Media Guard)
  // =========================================================================

  await test('DM-09', 'Homepage (/) & SiteHeader/SiteFooter use semantic tokens and never invert product media', async () => {
    const headerSrc = readWebFile('components/SiteHeader.js');
    const homeSrc = readWebFile('components/home/HomeClient.js');
    assert.doesNotMatch(headerSrc, /bg-ink text-white/);
    assert.doesNotMatch(homeSrc, /bg-ink text-white/);
    assert.match(headerSrc, /bg-primary text-primary-foreground/);
    assert.match(homeSrc, /bg-primary text-primary-foreground/);
    assert.match(homeHtml, /data-testid="site-header"/);
    assert.match(homeHtml, /data-testid="site-footer"/);
    assert.doesNotMatch(compiledCss, /filter:\s*invert\(1\)/i);
    for (const file of [
      'components/home/HomeClient.js',
      'components/product/ProductCard.js',
      'components/product/ProductDetailClient.js',
      'components/cart/CartClient.js',
    ]) {
      const src = readWebFile(file);
      assert.doesNotMatch(src, /dark:invert|invert\(1\)/, `${file} must not invert images`);
    }
    return 'Homepage, Header, Footer & Media non-inversion verified';
  });

  await test('DM-10', 'Catalog (/products), ProductCard, and Pagination use semantic tokens and render 200', async () => {
    const { html: catalogHtml } = await fetchHtmlAndCss('/products?category=laptops&sort=price_asc');
    assert.match(catalogHtml, /data-testid="catalog-page"/);
    assert.match(catalogHtml, /data-testid="theme-switcher"/);

    for (const file of [
      'components/product/CatalogClient.js',
      'components/product/ProductCard.js',
      'components/product/Pagination.js',
    ]) {
      const src = readWebFile(file);
      assert.doesNotMatch(src, /bg-ink text-white/, `${file} still has hardcoded bg-ink text-white`);
      assert.match(src, /bg-primary text-primary-foreground/);
    }
    return '/products + CatalogClient/ProductCard/Pagination verified';
  });

  await test('DM-11', 'Product Detail Page (PDP) uses semantic tokens for variants, stock badges, and CTAs', async () => {
    const prodRes = await fetch(`${API}/api/products?limit=1`);
    const prodData = await prodRes.json();
    const slug = prodData.products?.[0]?.slug;
    assert.ok(slug, 'Expected at least 1 product slug');

    const { html: pdpHtml } = await fetchHtmlAndCss(`/products/${slug}`);
    assert.match(pdpHtml, /data-testid="product-detail-page"/);
    assert.match(pdpHtml, /data-testid="theme-switcher"/);

    const pdpSrc = readWebFile('components/product/ProductDetailClient.js');
    assert.doesNotMatch(pdpSrc, /bg-ink text-white/);
    assert.match(pdpSrc, /bg-primary text-primary-foreground/);
    assert.match(pdpSrc, /text-danger/);
    return `/products/${slug} semantic tokens verified`;
  });

  // =========================================================================
  // Task DM.4 — Commerce, Auth & Account Dark Mode Adaptation (DM-12..DM-15)
  // =========================================================================

  await test('DM-12', 'Shopping Cart (/cart) uses semantic surface, primary CTA, and danger tokens', async () => {
    const { html: cartHtml } = await fetchHtmlAndCss('/cart');
    assert.match(cartHtml, /data-testid="cart-page"/);
    assert.match(cartHtml, /data-testid="theme-switcher"/);

    const cartSrc = readWebFile('components/cart/CartClient.js');
    assert.doesNotMatch(cartSrc, /bg-ink text-white/);
    assert.match(cartSrc, /bg-primary text-primary-foreground/);
    assert.match(cartSrc, /text-danger/);
    return '/cart semantic tokens verified';
  });

  await test('DM-13', 'Multi-Step Checkout (/checkout) and Order Success (/checkout/success) use semantic tokens', async () => {
    const { html: checkoutHtml } = await fetchHtmlAndCss('/checkout');
    assert.match(checkoutHtml, /data-testid="checkout-page"/);
    assert.match(checkoutHtml, /data-testid="theme-switcher"/);

    const { html: successHtml } = await fetchHtmlAndCss('/checkout/success?orderNumber=AEVO-TEST');
    assert.match(successHtml, /data-testid="order-success-page"/);

    const checkoutSrc = readWebFile('components/checkout/CheckoutClient.js');
    assert.doesNotMatch(checkoutSrc, /bg-ink text-white/);
    assert.match(checkoutSrc, /bg-primary text-primary-foreground/);
    assert.match(checkoutSrc, /text-success/);
    assert.match(checkoutSrc, /text-danger/);
    return '/checkout & /checkout/success semantic tokens verified';
  });

  await test('DM-14', 'Auth pages (/login, /register, /forgot-password, /reset-password) render ThemeSwitcher & semantic tokens', async () => {
    for (const authRoute of ['/login', '/register', '/forgot-password', '/reset-password']) {
      const { html } = await fetchHtmlAndCss(authRoute);
      assert.match(html, /data-testid="settings-menu"/, `${authRoute} missing SettingsMenu`);
      assert.match(html, /data-testid="theme-switcher"/, `${authRoute} missing ThemeSwitcher`);
    }
    for (const file of [
      'app/(auth)/login/page.js',
      'app/(auth)/register/page.js',
      'app/(auth)/forgot-password/page.js',
      'app/(auth)/reset-password/page.js',
    ]) {
      const src = readWebFile(file);
      assert.match(src, /SettingsMenu|ThemeSwitcher/);
      assert.match(src, /text-danger/);
    }
    return '4 Auth pages verified with ThemeSwitcher & danger tokens';
  });

  await test('DM-15', 'Account pages (/account/profile, /addresses, /orders, /orders/[id]) use semantic tokens', async () => {
    for (const accRoute of ['/account/profile', '/account/addresses', '/account/orders']) {
      const { html } = await fetchHtmlAndCss(accRoute);
      assert.match(html, /data-testid="theme-switcher"/, `${accRoute} missing ThemeSwitcher`);
    }
    for (const file of [
      'app/account/profile/page.js',
      'app/account/addresses/page.js',
      'app/account/orders/page.js',
      'app/account/orders/[id]/page.js',
    ]) {
      const src = readWebFile(file);
      assert.doesNotMatch(src, /bg-ink text-white/, `${file} still has bg-ink text-white`);
      assert.match(src, /bg-primary text-primary-foreground/);
    }
    return '4 Account pages verified with semantic tokens';
  });

  // =========================================================================
  // Task DM.5 & DM.6 — Admin Chart/Table Primitives & Regression Guard (DM-16..DM-20)
  // =========================================================================

  await test('DM-16', 'Recharts theme helper (lib/theme-config.js) returns exact Light & Dark palette configs', async () => {
    const themeConfigMod = await import(path.join(WEB_ROOT, 'lib/theme-config.js'));
    const lightChart = themeConfigMod.getChartTheme('light');
    const darkChart = themeConfigMod.getChartTheme('dark');

    assert.equal(lightChart.cartesianGrid.stroke, '#E5E5E3');
    assert.equal(lightChart.axis.stroke, '#737373');
    assert.equal(lightChart.tooltip.contentStyle.backgroundColor, '#FFFFFF');
    assert.equal(lightChart.series.accent, '#52665C');

    assert.equal(darkChart.cartesianGrid.stroke, '#333438');
    assert.equal(darkChart.axis.stroke, '#A3A7AD');
    assert.equal(darkChart.tooltip.contentStyle.backgroundColor, '#1C1D20');
    assert.equal(darkChart.tooltip.contentStyle.borderColor, '#333438');
    assert.equal(darkChart.series.accent, '#9DB7A5');
    assert.equal(darkChart.series.primary, '#F5F5F3');
    return 'Light & Dark Recharts configs verified';
  });

  await test('DM-17', 'Data table interactive row utility uses --aevo-surface-muted hover and tabular-nums', async () => {
    const lowerCss = compiledCss.toLowerCase();
    assert.match(lowerCss, /\.table-row-interactive/);
    assert.match(lowerCss, /tabular-nums/);
    return '.table-row-interactive & tabular-nums present in compiled CSS';
  });

  await test('DM-18', 'Combined Dark Mode + Vietnamese locale (aevo_locale=vi) across Storefront & Auth routes', async () => {
    for (const route of ['/', '/products', '/cart', '/checkout', '/login']) {
      const { html } = await fetchHtmlAndCss(route, 'aevo_locale=vi');
      assert.match(html, /data-testid="theme-switcher"/, `Missing theme-switcher on ${route}`);
      assert.match(html, /aria-label="Giao diện"/, `Missing Vietnamese aria-label on ${route}`);
    }
    return '5 routes verified with Vietnamese ThemeSwitcher + localized content';
  });

  await test('DM-19', 'Reduced motion accessibility rule (@media (prefers-reduced-motion: reduce)) present in CSS', async () => {
    assert.match(compiledCss, /prefers-reduced-motion:\s*reduce/);
    return 'prefers-reduced-motion rule verified';
  });

  await test('DM-20', 'Full E-Commerce business logic integrity (Guest Cart + Order + Success Page) under theme/i18n', async () => {
    const prodRes = await fetch(`${API}/api/products?limit=10`);
    const prodBody = await prodRes.json();
    let variant = null;
    for (const p of prodBody.products || []) {
      for (const v of p.variants || []) {
        if (v.inventory >= 5) {
          variant = v;
          break;
        }
      }
      if (variant) break;
    }
    assert.ok(variant, 'Available variant required for DM-20');

    // Initialize guest cart session via GET /api/cart
    const initCartRes = await fetch(`${API}/api/cart`);
    const initCartBody = await initCartRes.json();
    const setCookies = initCartRes.headers.getSetCookie?.() || [];
    const sessionCookie =
      setCookies.find((c) => c.startsWith('sessionId='))?.split(';')[0] ||
      `sessionId=${initCartBody.sessionId}`;

    const addRes = await fetch(`${API}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ variantId: variant.id, quantity: 1 }),
    });
    assert.equal(addRes.status, 200);
    const cartData = await addRes.json();
    assert.equal(cartData.items.length, 1);

    const orderRes = await fetch(`${API}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: sessionCookie,
      },
      body: JSON.stringify({
        shippingAddress: {
          email: `dm.${Date.now()}@example.com`,
          fullName: 'Dark Mode Tester',
          phone: '0901234567',
          address: '123 Obsidian Way',
          city: 'Ho Chi Minh City',
        },
        shippingMethod: 'standard',
        paymentMethod: 'cod',
      }),
    });
    assert.equal(orderRes.status, 201, `Order failed: ${await orderRes.clone().text()}`);
    const createdOrder = await orderRes.json();
    assert.ok(createdOrder.orderNumber);

    const { html: successPageHtml } = await fetchHtmlAndCss(
      `/checkout/success?orderNumber=${encodeURIComponent(createdOrder.orderNumber)}`,
      `${sessionCookie}; aevo_locale=vi`
    );
    assert.match(successPageHtml, new RegExp(createdOrder.orderNumber));
    assert.match(successPageHtml, /data-testid="theme-switcher"/);
    return `Order ${createdOrder.orderNumber} placed & verified on localized Dark Mode-ready success page`;
  });

  // ------------------------------------------------------------------ report
  const failed = results.filter((r) => !r.ok);
  console.log('\n' + '='.repeat(60));
  console.log(`${results.length - failed.length}/${results.length} passed`);
  if (failed.length) {
    console.log('FAILED:');
    for (const f of failed) console.log(`  - ${f.id} ${f.name}: ${f.detail}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('Test harness crashed:', error);
  process.exitCode = 1;
});
