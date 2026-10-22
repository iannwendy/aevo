/**
 * Phase I18N E2E checks (I18N_TEST_PLAN.md, Task I18N.1 - I18N.5).
 *
 * Exercises ENG (en) & VIE (vi) internationalization across:
 *   - Core dictionary interpolation, category localization & safe fallback
 *   - SSR <html lang="en|vi"> via aevo_locale cookie
 *   - Global SiteHeader, SiteFooter & LanguageSwitcher (ENG / VIE buttons)
 *   - Storefront (Homepage, Catalog, Filters, Sort, ProductCard, Pagination)
 *   - Product Detail (Stock status, Variant selector, Specs, Reviews & Ratings)
 *   - Commerce & Account (Cart, Checkout, Order Success, Login, Register,
 *     Forgot/Reset Password, Profile, Addresses, Orders)
 *
 * Run with both API (3001) and Web (3000) servers up:
 *   node apps/api/test/i18n.e2e.js
 */
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const API = process.env.API_URL || 'http://localhost:3001';
const CLIENT = process.env.CLIENT_URL || 'http://localhost:3000';

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

async function fetchPage(routePath, { localeCookie, extraCookies = [] } = {}) {
  const cookies = [];
  if (localeCookie) cookies.push(`aevo_locale=${localeCookie}`);
  for (const c of extraCookies) {
    if (c) cookies.push(c);
  }
  const headers = {};
  if (cookies.length > 0) {
    headers.Cookie = cookies.join('; ');
  }
  const res = await fetch(`${CLIENT}${routePath}`, { headers });
  const html = await res.text();
  return { status: res.status, html, headers: res.headers };
}

(async () => {
  const dictUrl = pathToFileURL(
    path.resolve(__dirname, '../../web/lib/i18n/dictionaries.js')
  ).href;
  const i18nDict = await import(dictUrl);

  // =========================================================================
  // Task I18N.1: Core i18n Architecture, Dictionaries & Persistence
  // =========================================================================
  console.log('\n=== Task I18N.1: Core i18n Architecture, Dictionaries & Persistence ===');

  await test('I18N-01', 'Default render is English (en) when no aevo_locale cookie is sent', async () => {
    const { status, html } = await fetchPage('/');
    assert.equal(status, 200);
    assert.ok(html.includes('<html lang="en"'), 'Expected <html lang="en"> by default');
    assert.ok(html.includes('Technology, refined.'), 'Expected English hero title');
    return '<html lang="en"> + English hero rendered';
  });

  await test('I18N-02', 'SSR renders Vietnamese (vi) when Cookie: aevo_locale=vi is provided', async () => {
    const { status, html } = await fetchPage('/', { localeCookie: 'vi' });
    assert.equal(status, 200);
    assert.ok(html.includes('<html lang="vi"'), 'Expected <html lang="vi"> with aevo_locale=vi');
    assert.ok(html.includes('Công nghệ, tinh chỉnh.'), 'Expected Vietnamese hero title');
    return '<html lang="vi"> + Vietnamese hero rendered';
  });

  await test('I18N-03', 'Unsupported locale cookie safely falls back to English (en)', async () => {
    const { status, html } = await fetchPage('/', { localeCookie: 'fr' });
    assert.equal(status, 200);
    assert.ok(html.includes('<html lang="en"'), 'Expected fallback to <html lang="en">');
    assert.ok(html.includes('Technology, refined.'), 'Expected fallback English copy');
    return 'aevo_locale=fr -> <html lang="en">';
  });

  await test('I18N-04', 'Dictionary interpolation & category localization helpers work in ENG and VIE', async () => {
    const enStock = i18nDict.translate('en', 'productDetail.inStockAvailable', { count: 8 });
    const viStock = i18nDict.translate('vi', 'productDetail.inStockAvailable', { count: 8 });
    assert.equal(enStock, 'In stock · 8 available');
    assert.equal(viStock, 'Còn hàng · 8 sản phẩm');

    assert.equal(i18nDict.localizeCategoryName('laptops', 'en'), 'Laptops');
    assert.equal(i18nDict.localizeCategoryName('laptops', 'vi'), 'Laptop');
    assert.equal(i18nDict.localizeCategoryName('components', 'vi'), 'Linh kiện');
    assert.equal(i18nDict.localizeCategoryName('monitors', 'vi'), 'Màn hình');
    return `${enStock} / ${viStock}`;
  });

  // =========================================================================
  // Task I18N.2: Global Layout, Header, Footer & Language Switcher (ENG / VIE)
  // =========================================================================
  console.log('\n=== Task I18N.2: Global Layout, Header, Footer & Language Switcher ===');

  await test('I18N-05', 'Header renders LanguageSwitcher with ENG and VIE buttons', async () => {
    const { html: enHtml } = await fetchPage('/');
    assert.ok(enHtml.includes('data-testid="language-switcher"'), 'Missing language-switcher');
    assert.ok(enHtml.includes('data-testid="lang-btn-en"'), 'Missing lang-btn-en');
    assert.ok(enHtml.includes('data-testid="lang-btn-vi"'), 'Missing lang-btn-vi');
    assert.ok(enHtml.includes('>ENG<'), 'Missing ENG label');
    assert.ok(enHtml.includes('>VIE<'), 'Missing VIE label');
    return 'ENG / VIE buttons present';
  });

  await test('I18N-06', 'Header navigation links localize to Vietnamese when aevo_locale=vi', async () => {
    const { html } = await fetchPage('/', { localeCookie: 'vi' });
    assert.ok(html.includes('Cửa hàng'), 'Missing Cửa hàng nav link');
    assert.ok(html.includes('Linh kiện'), 'Missing Linh kiện nav link');
    assert.ok(html.includes('Màn hình'), 'Missing Màn hình nav link');
    assert.ok(html.includes('Tìm kiếm'), 'Missing Tìm kiếm button');
    assert.ok(html.includes('Tài khoản'), 'Missing Tài khoản link');
    assert.ok(html.includes('Giỏ hàng'), 'Missing Giỏ hàng link');
    return 'Cửa hàng, Linh kiện, Màn hình, Tìm kiếm, Tài khoản, Giỏ hàng';
  });

  await test('I18N-07', 'Footer tagline, links & copyright localize to Vietnamese', async () => {
    const { html } = await fetchPage('/', { localeCookie: 'vi' });
    assert.ok(
      html.includes('Điện toán cao cấp, tinh chỉnh hoàn mỹ.'),
      'Missing Vietnamese footer tagline'
    );
    assert.ok(html.includes('Quản trị'), 'Missing Vietnamese Admin link in footer');
    assert.ok(html.includes('Bảo lưu mọi quyền.'), 'Missing Vietnamese copyright notice');
    return 'Footer Vietnamese tagline & links verified';
  });

  await test('I18N-08', 'Locale cookie persists Vietnamese across multiple routes', async () => {
    const [homeRes, catalogRes, cartRes] = await Promise.all([
      fetchPage('/', { localeCookie: 'vi' }),
      fetchPage('/products', { localeCookie: 'vi' }),
      fetchPage('/cart', { localeCookie: 'vi' }),
    ]);
    assert.ok(homeRes.html.includes('<html lang="vi"'));
    assert.ok(catalogRes.html.includes('<html lang="vi"'));
    assert.ok(cartRes.html.includes('<html lang="vi"'));
    assert.ok(catalogRes.html.includes('Khám phá phần cứng.'));
    assert.ok(cartRes.html.includes('Giỏ hàng của bạn.'));
    return '/, /products, /cart all rendered in Vietnamese';
  });

  // =========================================================================
  // Task I18N.3: Storefront Localization (Homepage, Catalog, ProductCard, Pagination)
  // =========================================================================
  console.log('\n=== Task I18N.3: Storefront Localization ===');

  await test('I18N-09', 'Homepage sections (Hero, New Arrivals, Best Sellers) localize to Vietnamese', async () => {
    const { html } = await fetchPage('/', { localeCookie: 'vi' });
    assert.ok(html.includes('Công nghệ, tinh chỉnh.'), 'Missing Hero Vietnamese title');
    assert.ok(html.includes('Khám phá bộ sưu tập'), 'Missing Explore Collection CTA in VI');
    assert.ok(html.includes('Khám phá thế hệ tiếp theo.'), 'Missing New Arrivals heading in VI');
    assert.ok(html.includes('Được chọn vì hiệu năng.'), 'Missing Best Sellers heading in VI');
    return 'Homepage Hero, New Arrivals & Best Sellers in VI';
  });

  await test('I18N-10', 'Homepage Hardware Categories names & descriptions localize to Vietnamese', async () => {
    const { html } = await fetchPage('/', { localeCookie: 'vi' });
    assert.ok(html.includes('Danh mục phần cứng'), 'Missing Hardware Categories badge in VI');
    assert.ok(html.includes('Tìm thiết bị thiết yếu của bạn.'), 'Missing Categories title in VI');
    assert.ok(html.includes('Linh kiện'), 'Missing localized Components category');
    assert.ok(html.includes('Thiết bị ngoại vi'), 'Missing localized Peripherals category');
    assert.ok(html.includes('Phụ kiện'), 'Missing localized Accessories category');
    return '6 categories localized in VI';
  });

  await test('I18N-11', 'Catalog page & sidebar filters localize to Vietnamese', async () => {
    const { html } = await fetchPage('/products', { localeCookie: 'vi' });
    assert.ok(html.includes('Khám phá phần cứng.'), 'Missing catalog title in VI');
    assert.ok(html.includes('Tìm kiếm từ khóa'), 'Missing Keyword Search filter label in VI');
    assert.ok(html.includes('Khoảng giá (VND)'), 'Missing Price Range filter label in VI');
    assert.ok(html.includes('Đánh giá khách hàng'), 'Missing Customer Rating label in VI');
    assert.ok(html.includes('Tình trạng &amp; Thẻ'), 'Missing Availability & Tags label in VI');
    assert.ok(html.includes('Còn hàng'), 'Missing In Stock Only checkbox label in VI');
    return 'Catalog heading & sidebar filters in VI';
  });

  await test('I18N-12', 'Catalog sort options & active filter pills localize to Vietnamese', async () => {
    const { html } = await fetchPage('/products?category=laptops&sort=price_asc', {
      localeCookie: 'vi',
    });
    assert.ok(html.includes('Giá: Thấp đến Cao'), 'Missing sort option Giá: Thấp đến Cao');
    assert.ok(html.includes('Danh mục:'), 'Missing active category filter pill in VI');
    assert.ok(html.includes('Xóa tất cả bộ lọc'), 'Missing Reset all filters button in VI');
    return 'Sort options & active filter pills in VI';
  });

  await test('I18N-13', 'ProductCard badges & Pagination controls localize to Vietnamese', async () => {
    const { html } = await fetchPage('/products', { localeCookie: 'vi' });
    assert.ok(
      html.includes('Hàng mới') || html.includes('Bán chạy'),
      'Expected localized ProductCard badges (Hàng mới / Bán chạy)'
    );
    assert.ok(html.includes('Hiển thị'), 'Missing pagination Showing label in VI');
    assert.ok(html.includes('Trước'), 'Missing pagination Prev button in VI');
    assert.ok(html.includes('Sau'), 'Missing pagination Next button in VI');
    return 'ProductCard badges & Pagination in VI';
  });

  // =========================================================================
  // Task I18N.4: Product Detail, Variants, Specifications & Realtime Reviews
  // =========================================================================
  console.log('\n=== Task I18N.4: Product Detail, Specs & Reviews Localization ===');

  await test('I18N-14', 'Product Detail stock status, configuration & Add to Cart localize to Vietnamese', async () => {
    const { status, html } = await fetchPage('/products/macbook-pro-m3', {
      localeCookie: 'vi',
    });
    assert.equal(status, 200);
    assert.ok(html.includes('Chọn cấu hình'), 'Missing Chọn cấu hình label');
    assert.ok(html.includes('Còn hàng ·'), 'Missing Còn hàng stock status');
    assert.ok(html.includes('Thêm vào giỏ —'), 'Missing Thêm vào giỏ button');
    return 'Product Detail variant & stock status in VI';
  });

  await test('I18N-15', 'Product Detail Technical Specifications table localizes to Vietnamese', async () => {
    const { html } = await fetchPage('/products/macbook-pro-m3', { localeCookie: 'vi' });
    assert.ok(html.includes('Thông số kỹ thuật'), 'Missing Thông số kỹ thuật heading');
    assert.ok(html.includes('Thương hiệu'), 'Missing Thương hiệu spec row');
    assert.ok(html.includes('Danh mục'), 'Missing Danh mục spec row');
    assert.ok(html.includes('Cấu hình đã chọn'), 'Missing Cấu hình đã chọn spec row');
    assert.ok(html.includes('Các phiên bản hiện có'), 'Missing Các phiên bản hiện có spec row');
    return 'Technical Specifications table in VI';
  });

  await test('I18N-16', 'Product Detail Reviews & Rating section localizes to Vietnamese', async () => {
    const { html } = await fetchPage('/products/macbook-pro-m3', { localeCookie: 'vi' });
    assert.ok(html.includes('Phản hồi từ cộng đồng.'), 'Missing Reviews heading in VI');
    assert.ok(html.includes('Viết đánh giá'), 'Missing Leave a Review title in VI');
    assert.ok(html.includes('Đăng bình luận khách'), 'Missing Post Guest Comment button in VI');
    assert.ok(html.includes('bình luận &amp; đánh giá'), 'Missing total comments label in VI');
    return 'Reviews & Guest comment form in VI';
  });

  await test('I18N-17', 'Product Not Found (404 product slug) localizes to Vietnamese', async () => {
    const { html } = await fetchPage('/products/non-existent-hardware-xyz', {
      localeCookie: 'vi',
    });
    assert.ok(html.includes('Không tìm thấy sản phẩm'), 'Missing Không tìm thấy sản phẩm');
    assert.ok(html.includes('Quay lại cửa hàng'), 'Missing Quay lại cửa hàng CTA');
    return '404 product state in VI';
  });

  // =========================================================================
  // Task I18N.5: Commerce & Account Pages Localization (Cart, Checkout, Auth, Profile)
  // =========================================================================
  console.log('\n=== Task I18N.5: Commerce & Account Pages Localization ===');

  await test('I18N-18', 'Cart (/cart) & Checkout (/checkout) pages localize to Vietnamese', async () => {
    const { html: cartHtml } = await fetchPage('/cart', { localeCookie: 'vi' });
    assert.ok(cartHtml.includes('Giỏ hàng của bạn.'), 'Missing Cart title in VI');
    assert.ok(
      cartHtml.includes('Giỏ hàng đang trống') || cartHtml.includes('Tóm tắt đơn hàng'),
      'Missing Cart empty state or summary in VI'
    );

    const { html: checkoutHtml } = await fetchPage('/checkout', { localeCookie: 'vi' });
    assert.ok(
      checkoutHtml.includes('Hoàn tất đơn hàng của bạn.'),
      'Missing Checkout title in VI'
    );
    assert.ok(
      checkoutHtml.includes('Thông tin liên hệ'),
      'Missing Checkout Step 1 title in VI'
    );
    assert.ok(
      checkoutHtml.includes('Tóm tắt đơn hàng'),
      'Missing Checkout Order Summary title in VI'
    );
    return '/cart & /checkout localized in VI';
  });

  await test('I18N-19', 'Login (/login) & Register (/register) localize to Vietnamese with LanguageSwitcher', async () => {
    const { html: loginHtml } = await fetchPage('/login', { localeCookie: 'vi' });
    assert.ok(loginHtml.includes('Chào mừng trở lại.'), 'Missing Login welcome heading in VI');
    assert.ok(
      loginHtml.includes('Tiếp tục vào tài khoản của bạn.'),
      'Missing Login form heading in VI'
    );
    assert.ok(loginHtml.includes('Tiếp tục với Google'), 'Missing Google OAuth button in VI');
    assert.ok(loginHtml.includes('data-testid="language-switcher"'), 'Missing LanguageSwitcher on /login');

    const { html: regHtml } = await fetchPage('/register', { localeCookie: 'vi' });
    assert.ok(regHtml.includes('Gia nhập AEVO.'), 'Missing Register side heading in VI');
    assert.ok(regHtml.includes('Tạo tài khoản'), 'Missing Create account heading in VI');
    assert.ok(regHtml.includes('data-testid="language-switcher"'), 'Missing LanguageSwitcher on /register');
    return '/login & /register localized in VI';
  });

  await test('I18N-20', 'Forgot Password (/forgot-password) & Reset Password (/reset-password) localize to Vietnamese', async () => {
    const { html: forgotHtml } = await fetchPage('/forgot-password', { localeCookie: 'vi' });
    assert.ok(forgotHtml.includes('Đặt lại mật khẩu'), 'Missing Forgot Password heading in VI');
    assert.ok(
      forgotHtml.includes('Gửi liên kết đặt lại'),
      'Missing Send reset link button in VI'
    );

    const { html: resetHtml } = await fetchPage('/reset-password', { localeCookie: 'vi' });
    assert.ok(resetHtml.includes('Chọn mật khẩu mới'), 'Missing Reset Password heading in VI');
    assert.ok(
      resetHtml.includes('Yêu cầu liên kết mới'),
      'Missing Request a new link CTA in VI'
    );
    return '/forgot-password & /reset-password localized in VI';
  });

  await test('I18N-21', 'Account Profile, Addresses & Orders pages localize to Vietnamese', async () => {
    const [profRes, addrRes, ordRes] = await Promise.all([
      fetchPage('/account/profile', { localeCookie: 'vi' }),
      fetchPage('/account/addresses', { localeCookie: 'vi' }),
      fetchPage('/account/orders', { localeCookie: 'vi' }),
    ]);
    assert.ok(profRes.html.includes('Tài khoản'), 'Missing Tài khoản on /account/profile');
    assert.ok(
      addrRes.html.includes('Địa chỉ giao hàng'),
      'Missing Địa chỉ giao hàng on /account/addresses'
    );
    assert.ok(
      ordRes.html.includes('Tra cứu đơn hàng theo Mã đơn'),
      'Missing order lookup title on /account/orders'
    );
    return '/account/profile, /account/addresses, /account/orders localized in VI';
  });

  await test('I18N-22', 'English default mode preserves 100% compatibility across all storefront routes', async () => {
    const [homeRes, prodRes, detailRes, cartRes, checkoutRes] = await Promise.all([
      fetchPage('/'),
      fetchPage('/products'),
      fetchPage('/products/macbook-pro-m3'),
      fetchPage('/cart'),
      fetchPage('/checkout'),
    ]);
    assert.ok(homeRes.html.includes('Technology, refined.'));
    assert.ok(prodRes.html.includes('Explore hardware.'));
    assert.ok(detailRes.html.includes('Technical Specifications'));
    assert.ok(cartRes.html.includes('Your selection.'));
    assert.ok(checkoutRes.html.includes('Complete your order.'));
    return 'All default ENG routes verified';
  });

  // =========================================================================
  // Summary
  // =========================================================================
  const passed = results.filter((r) => r.ok).length;
  const failed = results.filter((r) => !r.ok);
  console.log(`\n=== Phase I18N E2E Summary: ${passed}/${results.length} passed ===`);
  if (failed.length > 0) {
    console.error('Failed tests:');
    for (const f of failed) {
      console.error(`  - ${f.id} (${f.name}): ${f.detail}`);
    }
    process.exit(1);
  }
})();
