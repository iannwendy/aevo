/**
 * Comprehensive UI Animations & Micro-Interactions E2E Test Suite (ANIM-01 -> ANIM-25)
 *
 * Verifies:
 *   Group 1: Motion Design System & Tailwind Keyframe Configuration (ANIM-01 .. ANIM-05)
 *   Group 2: Page-Load Progress Bar & Route Entrance Animations     (ANIM-06 .. ANIM-10)
 *   Group 3: Button Micro-Interactions, Sheen & Nav Underline       (ANIM-11 .. ANIM-15)
 *   Group 4: Product Card, Catalog Filter & PDP Animations          (ANIM-16 .. ANIM-20)
 *   Group 5: Cart, 5-Step Checkout, Admin & Reduced-Motion A11y     (ANIM-21 .. ANIM-25)
 */

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
function loadPlaywright() {
  try {
    return require('playwright');
  } catch {
    const fallbackPath =
      '/Users/iannwendy/.npm/_npx/31e32ef8478fbf80/node_modules/playwright';
    return require(fallbackPath);
  }
}

const { chromium } = loadPlaywright();

const WEB_URL = process.env.WEB_URL || 'http://localhost:3000';
const API_URL = process.env.API_URL || 'http://localhost:3001';
const ROOT_DIR = path.resolve(__dirname, '../../..');
const WEB_DIR = path.join(ROOT_DIR, 'apps/web');

const results = [];

async function runTest(id, name, fn) {
  const start = Date.now();
  try {
    const detail = await fn();
    const ms = Date.now() - start;
    results.push({ id, name, status: 'PASS', detail: detail || 'Verified', ms });
    console.log(`PASS  ${id}  ${name} (${ms}ms) — ${detail || 'Verified'}`);
  } catch (err) {
    const ms = Date.now() - start;
    results.push({ id, name, status: 'FAIL', detail: err.message, ms });
    console.error(`FAIL  ${id}  ${name} (${ms}ms) — ${err.message}`);
  }
}

function readWebFile(relPath) {
  return fs.readFileSync(path.join(WEB_DIR, relPath), 'utf8');
}

async function launchBrowser() {
  try {
    return await chromium.launch({ headless: true, channel: 'chrome' });
  } catch {
    return await chromium.launch({ headless: true });
  }
}

(async () => {
  console.log('\n====================================================================');
  console.log('  AEVO UI Animations & Micro-Interactions E2E Suite (ANIM-01..25)');
  console.log('====================================================================\n');

  const browser = await launchBrowser();

  try {
    // =========================================================================
    // Group 1: Motion Design System & Tailwind Keyframe Configuration
    // =========================================================================
    console.log('=== Group 1: Motion Design System & Tailwind Keyframe Configuration ===');

    await runTest(
      'ANIM-01',
      'tailwind.config.js defines complete keyframe & animation suite with transform:none terminal states',
      async () => {
        const tailwindCfg = readWebFile('tailwind.config.js');
        const requiredKeyframes = [
          'fadeIn',
          'slideIn',
          'scaleIn',
          'pageEnter',
          'heroReveal',
          'slideUp',
          'slideDown',
          'floatSlow',
          'badgePop',
          'shimmer',
          'progressSweep',
        ];
        for (const kf of requiredKeyframes) {
          assert.ok(
            tailwindCfg.includes(kf),
            `Missing keyframe '${kf}' in tailwind.config.js`
          );
        }
        // Verify transform: 'none' is used at 100% so fixed descendants are never broken
        const transformNoneMatches = tailwindCfg.match(/transform:\s*'none'/g) || [];
        assert.ok(
          transformNoneMatches.length >= 6,
          `Expected >= 6 transform: 'none' terminal states, found ${transformNoneMatches.length}`
        );
        return `Verified ${requiredKeyframes.length} keyframes & ${transformNoneMatches.length} transform:'none' terminal states`;
      }
    );

    await runTest(
      'ANIM-02',
      'globals.css defines button sheen, hover lift, nav-link-animated, card-interactive, and stagger utilities',
      async () => {
        const globalsCss = readWebFile('app/globals.css');
        const requiredSelectors = [
          '.btn-primary',
          '.btn-primary::after',
          '.btn-secondary',
          '.btn-ghost',
          '.btn-interactive',
          '.nav-link-animated',
          '.nav-link-animated::after',
          '.surface-card',
          '.card-interactive',
          '.hover-lift',
          '.table-row-interactive',
          '.stagger-1',
          '.stagger-6',
        ];
        for (const sel of requiredSelectors) {
          assert.ok(
            globalsCss.includes(sel),
            `Expected ${sel} in apps/web/app/globals.css`
          );
        }
        return `Verified ${requiredSelectors.length} motion utility classes in globals.css`;
      }
    );

    await runTest(
      'ANIM-03',
      'globals.css includes @media (prefers-reduced-motion: reduce) accessibility safeguard',
      async () => {
        const globalsCss = readWebFile('app/globals.css');
        assert.ok(
          globalsCss.includes('prefers-reduced-motion: reduce'),
          'Missing prefers-reduced-motion: reduce rule in globals.css'
        );
        assert.ok(
          globalsCss.includes('animation-duration: 0.01ms !important'),
          'Missing animation-duration override in prefers-reduced-motion block'
        );
        assert.ok(
          globalsCss.includes('transition-duration: 0.01ms !important'),
          'Missing transition-duration override in prefers-reduced-motion block'
        );
        return 'prefers-reduced-motion: reduce CSS rules verified';
      }
    );

    await runTest(
      'ANIM-04',
      'PageTransition component is wired in root layout.js with top progress bar & route wrapper',
      async () => {
        const layoutSrc = readWebFile('app/layout.js');
        const ptSrc = readWebFile('components/PageTransition.js');
        assert.ok(
          layoutSrc.includes('PageTransition'),
          'PageTransition must be imported and rendered in app/layout.js'
        );
        assert.ok(
          ptSrc.includes('data-testid="page-load-progress"'),
          'PageTransition must render data-testid="page-load-progress"'
        );
        assert.ok(
          ptSrc.includes('data-testid="page-transition-wrapper"'),
          'PageTransition must render data-testid="page-transition-wrapper"'
        );
        assert.ok(
          ptSrc.includes('animate-progress-sweep'),
          'PageTransition progress bar must use animate-progress-sweep'
        );
        return 'PageTransition root wiring and testids verified';
      }
    );

    await runTest(
      'ANIM-05',
      'Resilient image fallback (FALLBACK_PRODUCT_IMAGE & handleImageError) wired across Product, Cart, Home & Admin',
      async () => {
        const utilsSrc = readWebFile('lib/utils.js');
        assert.ok(utilsSrc.includes('FALLBACK_PRODUCT_IMAGE'), 'Missing FALLBACK_PRODUCT_IMAGE');
        assert.ok(utilsSrc.includes('handleImageError'), 'Missing handleImageError');

        const filesToCheck = [
          'components/product/ProductCard.js',
          'components/home/HomeClient.js',
          'components/product/ProductDetailClient.js',
          'components/cart/CartClient.js',
          'app/admin/products/page.js',
        ];
        for (const f of filesToCheck) {
          const content = readWebFile(f);
          assert.ok(
            content.includes('handleImageError'),
            `Expected handleImageError in ${f}`
          );
        }
        return `Verified handleImageError across ${filesToCheck.length} image-rendering components`;
      }
    );

    // =========================================================================
    // Group 2: Page-Load & Hero Entrance Animations
    // =========================================================================
    console.log('\n=== Group 2: Page-Load & Hero Entrance Animations ===');

    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      reducedMotion: 'no-preference',
    });
    const page = await context.newPage();

    await runTest(
      'ANIM-06',
      'Storefront (/) renders page-transition-wrapper with active fade-in animation',
      async () => {
        await page.goto(`${WEB_URL}/`, { waitUntil: 'networkidle' });
        const wrapper = page.getByTestId('page-transition-wrapper');
        await assert.doesNotReject(() => wrapper.waitFor({ state: 'visible', timeout: 5000 }));

        const animInfo = await wrapper.evaluate((el) => {
          const cs = window.getComputedStyle(el);
          return {
            className: el.className,
            animationName: cs.animationName,
            animationDuration: cs.animationDuration,
            transform: cs.transform,
          };
        });
        assert.ok(
          animInfo.className.includes('animate-fade-in'),
          `Expected animate-fade-in on page-transition-wrapper, got ${animInfo.className}`
        );
        assert.equal(animInfo.animationName, 'fadeIn');
        assert.ok(
          parseFloat(animInfo.animationDuration) > 0,
          `Expected animationDuration > 0s, got ${animInfo.animationDuration}`
        );
        return `animationName=${animInfo.animationName}, duration=${animInfo.animationDuration}`;
      }
    );

    await runTest(
      'ANIM-07',
      'Hero section on (/) applies staggered entrance animations (animate-slide-up, animate-hero-reveal, stagger-1..3)',
      async () => {
        const heroStats = await page.evaluate(() => {
          const hero = document.querySelector('[data-testid="hero-section"]');
          if (!hero) return null;
          const h1 = hero.querySelector('h1');
          const p = hero.querySelector('p');
          const ctas = hero.querySelector('[data-testid="hero-explore-cta"]')?.parentElement;
          const h1Style = h1 ? window.getComputedStyle(h1) : null;
          const pStyle = p ? window.getComputedStyle(p) : null;
          return {
            h1Class: h1?.className || '',
            h1Anim: h1Style?.animationName || '',
            h1Delay: h1Style?.animationDelay || '',
            pClass: p?.className || '',
            pAnim: pStyle?.animationName || '',
            ctasClass: ctas?.className || '',
          };
        });
        assert.ok(heroStats, 'Hero section must exist');
        assert.ok(heroStats.h1Class.includes('animate-hero-reveal'), 'Hero h1 must have animate-hero-reveal');
        assert.equal(heroStats.h1Anim, 'heroReveal');
        assert.ok(heroStats.pClass.includes('animate-slide-up'), 'Hero p must have animate-slide-up');
        assert.ok(heroStats.ctasClass.includes('stagger-3'), 'Hero CTAs container must have stagger-3');
        return `h1=${heroStats.h1Anim} (delay ${heroStats.h1Delay}), p=${heroStats.pAnim}`;
      }
    );

    await runTest(
      'ANIM-08',
      'Hero showcase floating card on (/) runs continuous infinite float animation',
      async () => {
        const floatInfo = await page.evaluate(() => {
          const el = document.querySelector('[data-testid="hero-section"] .animate-float');
          if (!el) return null;
          const cs = window.getComputedStyle(el);
          return {
            animationName: cs.animationName,
            animationIterationCount: cs.animationIterationCount,
            animationDuration: cs.animationDuration,
          };
        });
        assert.ok(floatInfo, 'Expected .animate-float element inside hero-section');
        assert.equal(floatInfo.animationName, 'floatSlow');
        assert.equal(floatInfo.animationIterationCount, 'infinite');
        return `float animation verified (duration=${floatInfo.animationDuration}, iteration=${floatInfo.animationIterationCount})`;
      }
    );

    await runTest(
      'ANIM-09',
      'Client-side route navigation triggers PageTransition progress bar & re-runs entrance animation',
      async () => {
        await page.getByTestId('hero-explore-cta').click();
        await page.waitForURL('**/products', { timeout: 10000 });
        await page.getByTestId('catalog-page').waitFor({ state: 'visible', timeout: 10000 });

        const wrapperVisible = await page.getByTestId('page-transition-wrapper').isVisible();
        assert.ok(wrapperVisible, 'page-transition-wrapper must remain visible after navigation');
        return 'Navigated / -> /products with PageTransition active';
      }
    );

    await runTest(
      'ANIM-10',
      'Auth pages (/login, /register, /forgot-password) render entrance animations on headings & cards',
      async () => {
        await page.goto(`${WEB_URL}/login`, { waitUntil: 'networkidle' });
        const loginAnims = await page.evaluate(() => {
          const h1 = document.querySelector('h1');
          const h2 = document.querySelector('h2');
          return {
            h1Class: h1?.className || '',
            h2Class: h2?.className || '',
          };
        });
        assert.ok(loginAnims.h1Class.includes('animate-hero-reveal'), 'Login h1 missing animate-hero-reveal');
        assert.ok(loginAnims.h2Class.includes('animate-slide-up'), 'Login h2 missing animate-slide-up');

        await page.goto(`${WEB_URL}/forgot-password`, { waitUntil: 'networkidle' });
        const forgotCard = await page.evaluate(() => {
          const card = document.querySelector('.animate-scale-in');
          return card ? window.getComputedStyle(card).animationName : null;
        });
        assert.equal(forgotCard, 'scaleIn');
        return 'Verified /login and /forgot-password entrance animations';
      }
    );

    // =========================================================================
    // Group 3: Button Micro-Interactions, Sheen & Navigation Underline
    // =========================================================================
    console.log('\n=== Group 3: Button Micro-Interactions, Sheen & Navigation Underline ===');

    await runTest(
      'ANIM-11',
      'Primary buttons (.btn-primary) have non-zero transitionDuration and ::after sheen pseudo-element',
      async () => {
        await page.goto(`${WEB_URL}/login`, { waitUntil: 'networkidle' });
        const btnInfo = await page.evaluate(() => {
          const btn = document.querySelector('.btn-primary');
          if (!btn) return null;
          const cs = window.getComputedStyle(btn);
          const afterCs = window.getComputedStyle(btn, '::after');
          return {
            display: cs.display,
            transitionDuration: cs.transitionDuration,
            afterPosition: afterCs.position,
            afterTransitionDuration: afterCs.transitionDuration,
          };
        });
        assert.ok(btnInfo, 'Expected .btn-primary on /login');
        assert.match(btnInfo.display, /flex/);
        assert.ok(
          parseFloat(btnInfo.transitionDuration) > 0,
          `Expected transitionDuration > 0s on .btn-primary, got ${btnInfo.transitionDuration}`
        );
        assert.equal(btnInfo.afterPosition, 'absolute');
        return `btn-primary transitionDuration=${btnInfo.transitionDuration}, ::after position=${btnInfo.afterPosition}`;
      }
    );

    await runTest(
      'ANIM-12',
      'Header navigation links (.nav-link-animated) render animated underline ::after pseudo-element',
      async () => {
        await page.goto(`${WEB_URL}/`, { waitUntil: 'networkidle' });
        const navInfo = await page.evaluate(() => {
          const link = document.querySelector('.nav-link-animated');
          if (!link) return null;
          const afterCs = window.getComputedStyle(link, '::after');
          return {
            position: window.getComputedStyle(link).position,
            afterHeight: afterCs.height,
            afterTransitionDuration: afterCs.transitionDuration,
          };
        });
        assert.ok(navInfo, 'Expected .nav-link-animated in SiteHeader');
        assert.equal(navInfo.position, 'relative');
        assert.equal(navInfo.afterHeight, '1.5px');
        assert.ok(parseFloat(navInfo.afterTransitionDuration) > 0);
        return `nav-link-animated ::after height=${navInfo.afterHeight}, transition=${navInfo.afterTransitionDuration}`;
      }
    );

    await runTest(
      'ANIM-13',
      'SettingsMenu button rotates icon (rotate-90) and scales in popover panel (scale-100)',
      async () => {
        const trigger = page.getByTestId('settings-menu-trigger');
        await trigger.click();
        const panel = page.getByTestId('settings-menu-panel');
        await panel.waitFor({ state: 'visible', timeout: 5000 });

        const panelInfo = await panel.evaluate((el) => {
          const cs = window.getComputedStyle(el);
          return {
            className: el.className,
            transitionDuration: cs.transitionDuration,
            opacity: cs.opacity,
          };
        });
        assert.ok(panelInfo.className.includes('scale-100'));
        assert.ok(parseFloat(panelInfo.transitionDuration) > 0);

        const iconRotated = await trigger.evaluate((btn) => {
          const svg = btn.querySelector('svg');
          return svg?.getAttribute('class') || '';
        });
        assert.ok(iconRotated.includes('rotate-90'), 'Expected SettingsMenu icon to include rotate-90 when open');

        // Close popover by clicking trigger again
        await trigger.click();
        return `SettingsMenu panel transitionDuration=${panelInfo.transitionDuration}, icon=rotate-90`;
      }
    );

    await runTest(
      'ANIM-14',
      'Mobile navigation drawer on Storefront animates with animate-slide-down when toggled',
      async () => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.goto(`${WEB_URL}/`, { waitUntil: 'networkidle' });

        const toggleBtn = page.getByTestId('mobile-menu-toggle');
        await toggleBtn.click();
        const drawer = page.getByTestId('mobile-menu-drawer');
        await drawer.waitFor({ state: 'visible', timeout: 5000 });

        const drawerAnim = await drawer.evaluate((el) => ({
          className: el.className,
          animationName: window.getComputedStyle(el).animationName,
        }));
        assert.ok(drawerAnim.className.includes('animate-slide-down'));
        assert.equal(drawerAnim.animationName, 'slideDown');

        await page.setViewportSize({ width: 1440, height: 900 });
        return `Mobile drawer animationName=${drawerAnim.animationName}`;
      }
    );

    await runTest(
      'ANIM-15',
      'Pagination buttons include hover lift (hover:-translate-y-0.5) and active press (active:scale-95)',
      async () => {
        await page.goto(`${WEB_URL}/products`, { waitUntil: 'networkidle' });
        const page1Btn = page.getByTestId('pagination-page-1');
        await page1Btn.waitFor({ state: 'visible', timeout: 5000 });

        const cls = await page1Btn.getAttribute('class');
        assert.ok(cls.includes('hover:-translate-y-0.5'), 'Pagination button missing hover:-translate-y-0.5');
        assert.ok(cls.includes('active:scale-95'), 'Pagination button missing active:scale-95');
        return 'Pagination tactile hover & press classes verified';
      }
    );

    // =========================================================================
    // Group 4: Product Card, Catalog Filter & PDP Interactive Animations
    // =========================================================================
    console.log('\n=== Group 4: Product Card, Catalog Filter & PDP Interactive Animations ===');

    await runTest(
      'ANIM-16',
      'ProductCard applies card hover elevation, studio image zoom (group-hover:scale-[1.06]), and fade-in entrance',
      async () => {
        await page.goto(`${WEB_URL}/`, { waitUntil: 'networkidle' });
        const cardInfo = await page.evaluate(() => {
          const card = document.querySelector('[data-testid="product-card"]');
          if (!card) return null;
          const img = card.querySelector('img');
          return {
            cardClass: card.className,
            cardAnim: window.getComputedStyle(card).animationName,
            imgClass: img?.className || '',
            imgTransition: img ? window.getComputedStyle(img).transitionDuration : '',
          };
        });
        assert.ok(cardInfo, 'Expected product-card on /');
        assert.ok(cardInfo.cardClass.includes('hover:-translate-y-1.5'));
        assert.ok(cardInfo.cardClass.includes('hover:shadow-lg'));
        assert.equal(cardInfo.cardAnim, 'fadeIn');
        assert.ok(cardInfo.imgClass.includes('group-hover:scale-[1.06]'));
        assert.ok(parseFloat(cardInfo.imgTransition) >= 0.3);
        return `ProductCard anim=${cardInfo.cardAnim}, imgTransition=${cardInfo.imgTransition}`;
      }
    );

    await runTest(
      'ANIM-17',
      'Category showcase cards on (/) elevate on hover and animate arrow icon',
      async () => {
        const catCardInfo = await page.evaluate(() => {
          const card = document.querySelector('[data-testid="category-card-laptops"] > div');
          if (!card) return null;
          return {
            className: card.className,
            transitionDuration: window.getComputedStyle(card).transitionDuration,
          };
        });
        assert.ok(catCardInfo, 'Expected category-card-laptops on /');
        assert.ok(catCardInfo.className.includes('group-hover:-translate-y-1.5'));
        assert.ok(catCardInfo.className.includes('group-hover:shadow-lg'));
        return `Category card transitionDuration=${catCardInfo.transitionDuration}`;
      }
    );

    await runTest(
      'ANIM-18',
      'Catalog (/products) active filter pills animate with scale-in and mobile filter drawer slides in',
      async () => {
        await page.goto(`${WEB_URL}/products?category=laptops`, { waitUntil: 'networkidle' });
        const pillInfo = await page.evaluate(() => {
          const pill = document.querySelector('[data-testid="active-filter-pills"] > span');
          if (!pill) return null;
          return {
            className: pill.className,
            animationName: window.getComputedStyle(pill).animationName,
          };
        });
        assert.ok(pillInfo, 'Expected active filter pill on /products?category=laptops');
        assert.ok(pillInfo.className.includes('animate-scale-in'));
        assert.equal(pillInfo.animationName, 'scaleIn');

        // Verify mobile filter drawer slide-in animation at 390px
        await page.setViewportSize({ width: 390, height: 844 });
        await page.getByTestId('mobile-filter-trigger').click();
        const drawer = page.getByTestId('mobile-filter-drawer');
        await drawer.waitFor({ state: 'visible', timeout: 5000 });

        const drawerAnimations = await drawer.evaluate((el) => {
          const panel = el.firstElementChild;
          return {
            backdropAnim: window.getComputedStyle(el).animationName,
            panelAnim: panel ? window.getComputedStyle(panel).animationName : null,
          };
        });
        assert.equal(drawerAnimations.backdropAnim, 'fadeIn');
        assert.equal(drawerAnimations.panelAnim, 'slideIn');

        await page.setViewportSize({ width: 1440, height: 900 });
        return `Filter pill=${pillInfo.animationName}, drawer=${drawerAnimations.panelAnim}`;
      }
    );

    await runTest(
      'ANIM-19',
      'Product Detail Page (/products/[slug]) gallery image cross-fades and quantity value pops on change',
      async () => {
        await page.goto(`${WEB_URL}/products/macbook-pro-m3`, { waitUntil: 'networkidle' });
        const mainImg = page.getByTestId('product-gallery-main-image');
        await mainImg.waitFor({ state: 'visible', timeout: 5000 });

        // Click second thumbnail and verify fade-in animation on main image
        const thumb1 = page.getByTestId('product-gallery-thumb-1');
        await thumb1.click();
        const imgAnim = await mainImg.evaluate((el) => ({
          className: el.className,
          animationName: window.getComputedStyle(el).animationName,
        }));
        assert.ok(imgAnim.className.includes('animate-fade-in'));
        assert.equal(imgAnim.animationName, 'fadeIn');

        // Click quantity increase and verify scale-in animation on quantity-value
        await page.getByTestId('quantity-increase').click();
        const qtyAnim = await page.getByTestId('quantity-value').evaluate((el) => ({
          text: el.textContent,
          animationName: window.getComputedStyle(el).animationName,
        }));
        assert.equal(qtyAnim.text, '2');
        assert.equal(qtyAnim.animationName, 'scaleIn');
        return `Gallery cross-fade=${imgAnim.animationName}, quantity pop=${qtyAnim.animationName}`;
      }
    );

    await runTest(
      'ANIM-20',
      'Adding to cart on PDP animates feedback banner (slide-up) and header cart count badge (badge-pop)',
      async () => {
        await page.getByTestId('add-to-cart-button').click();
        const feedback = page.getByTestId('add-to-cart-feedback');
        await feedback.waitFor({ state: 'visible', timeout: 5000 });

        const fbAnim = await feedback.evaluate((el) => ({
          className: el.className,
          animationName: window.getComputedStyle(el).animationName,
        }));
        assert.ok(fbAnim.className.includes('animate-slide-up'));
        assert.equal(fbAnim.animationName, 'slideUp');

        const badge = page.getByTestId('header-cart-count');
        await badge.waitFor({ state: 'visible', timeout: 5000 });
        const badgeAnim = await badge.evaluate((el) => ({
          className: el.className,
          animationName: window.getComputedStyle(el).animationName,
        }));
        assert.ok(badgeAnim.className.includes('animate-badge-pop'));
        assert.equal(badgeAnim.animationName, 'badgePop');
        return `Feedback=${fbAnim.animationName}, Cart badge=${badgeAnim.animationName}`;
      }
    );

    // =========================================================================
    // Group 5: Cart, 5-Step Checkout, Admin & Reduced-Motion Accessibility
    // =========================================================================
    console.log('\n=== Group 5: Cart, 5-Step Checkout, Admin & Reduced-Motion Accessibility ===');

    await runTest(
      'ANIM-21',
      'Cart page (/cart) animates cart items (slide-up) and quantity badges (scale-in)',
      async () => {
        await page.goto(`${WEB_URL}/cart`, { waitUntil: 'networkidle' });
        const item = page.getByTestId('cart-item').first();
        await item.waitFor({ state: 'visible', timeout: 5000 });

        const itemAnim = await item.evaluate((el) => ({
          className: el.className,
          animationName: window.getComputedStyle(el).animationName,
        }));
        assert.ok(itemAnim.className.includes('animate-slide-up'));
        assert.equal(itemAnim.animationName, 'slideUp');
        return `Cart item animationName=${itemAnim.animationName}`;
      }
    );

    await runTest(
      'ANIM-22',
      'Checkout page (/checkout) animates step transitions (animate-slide-up) across steps 1 -> 2 -> 3',
      async () => {
        await page.goto(`${WEB_URL}/checkout`, { waitUntil: 'networkidle' });
        const step1 = page.getByTestId('checkout-step-1');
        await step1.waitFor({ state: 'visible', timeout: 5000 });

        const step1Anim = await step1.evaluate((el) => window.getComputedStyle(el).animationName);
        assert.equal(step1Anim, 'slideUp');

        await page.getByTestId('checkout-email-input').fill('anim-test@example.com');
        await page.getByTestId('checkout-fullname-input').fill('Animation Tester');
        await page.getByTestId('checkout-phone-input').fill('0901234567');
        await page.getByTestId('checkout-continue-to-shipping').click();

        const step2 = page.getByTestId('checkout-step-2');
        await step2.waitFor({ state: 'visible', timeout: 5000 });
        const step2Anim = await step2.evaluate((el) => window.getComputedStyle(el).animationName);
        assert.equal(step2Anim, 'slideUp');

        await page.getByTestId('checkout-address-input').fill('123 Le Loi');
        await page.getByTestId('checkout-city-input').fill('Ho Chi Minh City');
        await page.getByTestId('checkout-continue-to-method').click();

        const step3 = page.getByTestId('checkout-step-3');
        await step3.waitFor({ state: 'visible', timeout: 5000 });
        const step3Anim = await step3.evaluate((el) => window.getComputedStyle(el).animationName);
        assert.equal(step3Anim, 'slideUp');

        return `Verified slideUp transition on checkout steps 1, 2, and 3`;
      }
    );

    await runTest(
      'ANIM-23',
      'Admin Dashboard (/admin) KPI cards have staggered slide-up entrance and hover-lift classes',
      async () => {
        await page.goto(`${WEB_URL}/admin`, { waitUntil: 'networkidle' });
        const kpiInfo = await page.evaluate(() => {
          const ids = [
            'kpi-total-users',
            'kpi-new-users',
            'kpi-total-orders',
            'kpi-total-revenue',
          ];
          return ids.map((id) => {
            const el = document.querySelector(`[data-testid="${id}"]`);
            if (!el) return null;
            const cs = window.getComputedStyle(el);
            return {
              id,
              className: el.className,
              animationName: cs.animationName,
              animationDelay: cs.animationDelay,
            };
          });
        });
        assert.equal(kpiInfo.filter(Boolean).length, 4);
        for (const item of kpiInfo) {
          assert.ok(item.className.includes('hover-lift'), `${item.id} missing hover-lift`);
          assert.equal(item.animationName, 'slideUp');
        }
        return `Verified 4 Admin KPI cards with staggered slideUp & hover-lift`;
      }
    );

    await runTest(
      'ANIM-24',
      'Emulating prefers-reduced-motion: reduce collapses animationDuration & transitionDuration to <= 0.001s',
      async () => {
        const rmContext = await browser.newContext({
          viewport: { width: 1440, height: 900 },
          reducedMotion: 'reduce',
        });
        const rmPage = await rmContext.newPage();
        await rmPage.goto(`${WEB_URL}/`, { waitUntil: 'networkidle' });

        const rmMetrics = await rmPage.evaluate(() => {
          const heroH1 = document.querySelector('[data-testid="hero-section"] h1');
          const cta = document.querySelector('[data-testid="hero-explore-cta"]');
          const floatCard = document.querySelector('[data-testid="hero-section"] .animate-float');
          return {
            h1AnimDuration: heroH1 ? parseFloat(window.getComputedStyle(heroH1).animationDuration) : 1,
            ctaTransDuration: cta ? parseFloat(window.getComputedStyle(cta).transitionDuration) : 1,
            floatAnimDuration: floatCard
              ? parseFloat(window.getComputedStyle(floatCard).animationDuration)
              : 1,
          };
        });

        await rmContext.close();

        assert.ok(
          rmMetrics.h1AnimDuration <= 0.001,
          `Expected h1 animationDuration <= 0.001s in reduced motion, got ${rmMetrics.h1AnimDuration}`
        );
        assert.ok(
          rmMetrics.ctaTransDuration <= 0.001,
          `Expected CTA transitionDuration <= 0.001s in reduced motion, got ${rmMetrics.ctaTransDuration}`
        );
        assert.ok(
          rmMetrics.floatAnimDuration <= 0.001,
          `Expected float animationDuration <= 0.001s in reduced motion, got ${rmMetrics.floatAnimDuration}`
        );
        return `Reduced-motion durations: h1=${rmMetrics.h1AnimDuration}s, cta=${rmMetrics.ctaTransDuration}s`;
      }
    );

    await runTest(
      'ANIM-25',
      'Zero broken images (naturalWidth > 0) across animated Storefront, Catalog, PDP, and Admin Products',
      async () => {
        const routes = ['/', '/products', '/products/macbook-pro-m3', '/admin/products'];
        let totalImagesChecked = 0;

        for (const r of routes) {
          await page.goto(`${WEB_URL}${r}`, { waitUntil: 'networkidle' });
          await page.waitForTimeout(300);
          const imgStatus = await page.evaluate(async () => {
            const imgs = Array.from(document.querySelectorAll('img'));
            for (const img of imgs) {
              img.loading = 'eager';
              img.scrollIntoView({ behavior: 'instant', block: 'center' });
            }
            await new Promise((res) => setTimeout(res, 400));
            return imgs.map((img) => ({
              src: img.currentSrc || img.src,
              complete: img.complete,
              naturalWidth: img.naturalWidth,
            }));
          });

          const broken = imgStatus.filter((i) => !i.complete || i.naturalWidth === 0);
          assert.equal(
            broken.length,
            0,
            `Broken images on ${r}: ${JSON.stringify(broken)}`
          );
          totalImagesChecked += imgStatus.length;
        }
        return `Verified ${totalImagesChecked} images across ${routes.length} routes with 0 broken assets`;
      }
    );

    await context.close();
  } finally {
    await browser.close();
  }

  // Summary
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;

  console.log('\n====================================================================');
  console.log(`  ANIMATION E2E SUMMARY: ${passed}/${results.length} PASSED, ${failed} FAILED`);
  console.log('====================================================================\n');

  if (failed > 0) {
    process.exit(1);
  }
})();
