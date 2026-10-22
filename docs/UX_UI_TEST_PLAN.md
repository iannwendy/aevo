# AEVO E-Commerce — Comprehensive UX/UI & Chrome DevTools Test Plan

## 1. Overview & Objectives

This document specifies the automated browser-driven UX/UI and Chrome DevTools verification suite (`apps/api/test/ux-ui.e2e.js`) for the AEVO E-commerce platform.

The suite drives a real headless Chromium browser via Playwright while attaching Chrome DevTools protocol listeners across every storefront, catalog, product detail, cart, checkout, authentication, customer account, and administrator page:
- **Zero Chrome Console Errors**: `page.on('console')` asserts `0` unexpected `console.error` entries.
- **Zero Chrome Console Warnings**: `page.on('console')` asserts `0` `console.warn` entries (including React hydration, DOM accessibility, and WebSocket lifecycle checks).
- **Zero Uncaught Page Exceptions**: `page.on('pageerror')` asserts `0` runtime exceptions.
- **Zero Unexpected Network / 5xx Failures**: `page.on('requestfailed')` and `page.on('response')` assert `0` failed asset/API requests and `200 OK` on `/icon.svg`.
- **100% Visual Media Integrity**: Every `<img>` element is scrolled into view and verified for `img.complete === true && img.naturalWidth > 0`.
- **Zero Horizontal Overflow**: Every route is verified across Desktop (`1280x800`), Tablet (`900x800`), and Mobile (`375x812`) viewports for `document.documentElement.scrollWidth <= window.innerWidth`.

---

## 2. How to Run

With PostgreSQL (`localhost:5433`), API (`http://localhost:3001`), and Web (`http://localhost:3000`) running:

```bash
npm run test:ux-ui
# or directly:
node apps/api/test/ux-ui.e2e.js
```

---

## 3. Test Matrix (40 Test Cases — `UX-01` .. `UX-40`)

### Group 1: Chrome DevTools Console, Network & Asset Integrity (`UX-01` .. `UX-05`)

| TC ID | Test Case | Target Routes | Verification Criteria | Status |
|-------|-----------|---------------|-----------------------|--------|
| `UX-01` | Chrome DevTools Console Gate — Storefront, Catalog & PDP | `/`, `/products`, `/products/[slug]` | `0` `console.error`, `0` `console.warn`, `0` `pageerror` | ✅ PASS |
| `UX-02` | Chrome DevTools Console Gate — Commerce & Auth Routes | `/cart`, `/checkout`, `/login`, `/register`, `/forgot-password`, `/reset-password` | `0` `console.error`, `0` `console.warn`, `0` `pageerror`, hidden username accessibility field present | ✅ PASS |
| `UX-03` | Chrome DevTools Console Gate — Account & Admin Routes | `/account/profile`, `/account/addresses`, `/account/orders`, `/admin`, `/admin/products`, `/admin/products/new`, `/admin/users`, `/admin/orders`, `/admin/discounts` | `0` `console.error`, `0` `console.warn`, `0` `pageerror` | ✅ PASS |
| `UX-04` | Chrome DevTools Network & Favicon Gate | `/icon.svg`, `/` | `/icon.svg` returns `200 OK` valid SVG; `0` failed requests | ✅ PASS |
| `UX-05` | Visual Media & Image Rendering Gate | `/`, `/products`, `/products/[slug]` | All 38+ product & hero `<img>` elements load with `naturalWidth > 0` | ✅ PASS |

### Group 2: Responsive Viewports, Grid Adaptation & Mobile Drawers (`UX-06` .. `UX-10` / `RESP-01` .. `RESP-05`)

| TC ID | Plan Ref | Viewport | Verification Criteria | Status |
|-------|----------|----------|-----------------------|--------|
| `UX-06` | `RESP-01` | Desktop (`1280x800`) | Home grid = 4 columns, Catalog grid = 3 columns, desktop sidebar visible, mobile menu hidden, `scrollWidth <= innerWidth` | ✅ PASS |
| `UX-07` | `RESP-02` | Tablet (`900x800`) | Home & Catalog grids adapt to 2 columns, `scrollWidth <= innerWidth` | ✅ PASS |
| `UX-08` | `RESP-03` | Mobile (`375x812`) | Home & Catalog grids adapt to 1 column; `0` horizontal overflow across `/`, `/products`, `/products/[slug]`, `/cart`, `/checkout`, `/login` | ✅ PASS |
| `UX-09` | `RESP-04` | Mobile (`375x812`) | `[data-testid="mobile-menu-toggle"]` opens `[data-testid="mobile-menu-drawer"]`, `aria-expanded` toggles, closes on `Escape` and link navigation | ✅ PASS |
| `UX-10` | `RESP-05` | Mobile (`375x812`) | `[data-testid="mobile-filter-trigger"]` opens `[data-testid="mobile-filter-drawer"]`, applies category filter, and closes cleanly | ✅ PASS |

### Group 3: Interactive Theme (`Light` / `Dark` / `System`) & Localization (`ENG` / `VIE`) UX (`UX-11` .. `UX-15`)

| TC ID | Test Case | Verification Criteria | Status |
|-------|-----------|-----------------------|--------|
| `UX-11` | `SettingsMenu` Popover UX | Opens on trigger click (`aria-expanded="true"`), closes on `Escape` key and outside click | ✅ PASS |
| `UX-12` | Interactive Dark Mode Toggle | Applies `html.dark`, sets body `backgroundColor: rgb(17, 18, 20)` (`#111214`) and `color: rgb(245, 245, 243)` (`#F5F5F3`), persists across reload | ✅ PASS |
| `UX-13` | Interactive System & Light Mode Toggle | Restores Warm Alabaster `rgb(245, 245, 243)` background and Deep Obsidian `rgb(23, 23, 23)` ink | ✅ PASS |
| `UX-14` | Interactive Language Switcher (`ENG` ↔ `VIE`) | Updates `<html lang="vi">`, sets `aevo_locale=vi` cookie, translates UI text in-place without reload, and restores English on `ENG` click | ✅ PASS |
| `UX-15` | Accessibility & Form Control Styling Gate | Verifies `.input-field` (`44px` height, `12px` radius) and `.btn-primary` flex alignment across Admin forms | ✅ PASS |

### Group 4: Storefront Homepage & Catalog Interactive Flows (`UX-16` .. `UX-22`)

| TC ID | Test Case | Verification Criteria | Status |
|-------|-----------|-----------------------|--------|
| `UX-16` | Homepage Client-Side Pagination | Paginates New Arrivals and Category Showcases without page reload | ✅ PASS |
| `UX-17` | Catalog Keyword Search & URL Sync | Filters products by keyword (`MacBook`), updates URL `?search=MacBook`, and renders active filter pill | ✅ PASS |
| `UX-18` | Catalog Category & Multi-Brand Filter | Applies category (`laptops`) + brand checkbox (`Apple`), syncing URL and checked state | ✅ PASS |
| `UX-19` | Catalog Price Range, Star Rating & In-Stock Filter | Applies min/max price (`1,000,000`–`80,000,000` VND), `4★ & up`, and `In Stock Only` | ✅ PASS |
| `UX-20` | Catalog Sort Modes (All 6 Options) | Verifies ascending/descending price ordering and all 6 sort modes (`price_asc`, `price_desc`, `name_asc`, `name_desc`, `best-selling`, `newest`) | ✅ PASS |
| `UX-21` | Catalog Grid/List View Toggle & Reset All | Switches between multi-column grid and detailed list view; `Reset All Filters` clears query params | ✅ PASS |
| `UX-22` | Catalog Empty State & Recovery | Renders `[data-testid="catalog-empty-state"]` on unmatched query and restores catalog on reset click | ✅ PASS |

### Group 5: Product Detail Page, Variants, Cart Badge & Realtime Reviews (`UX-23` .. `UX-26`)

| TC ID | Test Case | Verification Criteria | Status |
|-------|-----------|-----------------------|--------|
| `UX-23` | PDP Image Gallery Thumbnail Switching | Clicking thumbnail updates main product image `src` | ✅ PASS |
| `UX-24` | PDP Variant Switching & Quantity Stepper | Switching variant updates SKU and price; quantity stepper enforces `1..stock` boundaries | ✅ PASS |
| `UX-25` | PDP Add to Cart & Live Header Badge | Clicking Add to Cart shows confirmation banner and increments `[data-testid="header-cart-count"]` live | ✅ PASS |
| `UX-26` | PDP Socket.IO Live Status, Guest Comment & 5-Star Review | Verifies `Live` Socket.IO badge, posts guest comment without login (`E2E-05`), logs in and posts 5-star review (`E2E-06`) | ✅ PASS |

### Group 6: Shopping Cart & 5-Step Multi-Step Checkout UX (`UX-27` .. `UX-30`)

| TC ID | Plan Ref | Test Case | Verification Criteria | Status |
|-------|----------|-----------|-----------------------|--------|
| `UX-27` | `CART-03` | Shopping Cart Live Quantity & Summary Math | Incrementing/decrementing quantity recalculates line totals and subtotal without reload | ✅ PASS |
| `UX-28` | `CHECK-08` | Checkout Step 1 Validation UX | Empty contact fields block progression and display `[data-testid="checkout-error"]` | ✅ PASS |
| `UX-29` | `E2E-01`, `E2E-04` | Guest 5-Step Checkout + Coupon + Order Confirmation | Completes all 5 steps as guest, validates invalid vs valid 5-char coupon, places order, and verifies `/checkout/success` | ✅ PASS |
| `UX-30` | `E2E-02`, `E2E-04` | Logged-In Customer Checkout + Pre-Fill + Loyalty Points | Pre-fills saved default address, redeems loyalty points (`10 pts = 10,000 VND`), places order, and verifies `/checkout/success` | ✅ PASS |

### Group 7: Authentication & Customer Account Management UX (`UX-31` .. `UX-34`)

| TC ID | Test Case | Verification Criteria | Status |
|-------|-----------|-----------------------|--------|
| `UX-31` | Auth Form Validation (`/login`, `/register`, `/forgot-password`, `/reset-password`) | Verifies inline validation messages and missing-token alert | ✅ PASS |
| `UX-32` | Account Profile Update (`/account/profile`) | Updates profile full name and verifies status confirmation banner | ✅ PASS |
| `UX-33` | Account Delivery Addresses CRUD (`/account/addresses`) | Creates new delivery address and verifies rendering in address list | ✅ PASS |
| `UX-34` | Account Order History & Status Timeline (`/account/orders/[id]`) | Navigates from order history to order detail and verifies reverse-chronological `[data-testid="status-history-table"]` | ✅ PASS |

### Group 8: Admin Control Panel, Analytics & Management UX (`UX-35` .. `UX-40`)

| TC ID | Plan Ref | Test Case | Verification Criteria | Status |
|-------|----------|-----------|-----------------------|--------|
| `UX-35` | `FE-24` | Admin Simple Dashboard KPIs & Recharts SVGs | Verifies 4 KPI cards and Recharts SVG chart surfaces on `/admin` | ✅ PASS |
| `UX-36` | `DASH-04..08` | Admin Advanced Dashboard Timeframes & Custom Range | Switches `year`, `quarter`, `month`, `week`, and `custom` date range picker | ✅ PASS |
| `UX-37` | `FE-25`, `FE-26` | Admin Products, Category Manager & Create Product Form | Opens Category Manager on `/admin/products` and adds dynamic variant rows on `/admin/products/new` | ✅ PASS |
| `UX-38` | `FE-27` | Admin Users Search & User Account Inspector | Searches user by email and opens `[data-testid="admin-user-detail-panel"]` | ✅ PASS |
| `UX-39` | `E2E-03`, `FE-28`, `FE-29` | Admin Orders Time Presets & Order Detail Status Update | Filters by time presets (`today`, `week`, `month`, `all`), updates order status to `CONFIRMED` with note, and verifies timeline | ✅ PASS |
| `UX-40` | `ADMIN-16..19` | Admin Discounts 5-Char Generator, Create & Deactivate | Generates 5-char uppercase alphanumeric code, creates discount, verifies table row, and deactivates code | ✅ PASS |
