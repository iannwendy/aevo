# AEVO E-commerce — Adaptive Dark Mode Plan

> **⚠️ QUAN TRỌNG - QUY TẮC LÀM VIỆC:**
> - **Sau mỗi task HOÀN THÀNH → Commit ngay lập tức**
> - **Mỗi task phải có testcase đầy đủ trước khi đánh dấu hoàn thành**
> - **Sau mỗi phase → Chạy full test → Tất cả pass mới push lên remote**
> - **Không push code chưa test hoặc đang fail**

---

# Project Overview

| Thông tin | Chi tiết |
|-----------|----------|
| Project | AEVO - Premium Computing E-commerce (`AEVO Store` & `AEVO Control`) |
| Feature | Adaptive Dark Mode (`Light` / `Dark` / `System`) |
| Design Direction | Premium Minimal · Light-first · Optional Dark |
| Tech Stack | Next.js 14 (App Router, `.js`/`.jsx`), `next-themes`, Tailwind CSS, CSS Semantic Variables, Lucide React |
| Supported Modes | `light` (Default for new visitors), `dark` (Optional Dark), `system` (`prefers-color-scheme`) |
| Priority Order | `requirement.md` (Đề bài gốc) > `concept.md` (AEVO Light Concept) > `darkmode.md` (Adaptive Dark Mode Spec) |
| Base Reference | `darkmode.md`, `concept.md`, `requirement.md`, `E2E_TEST_PLAN.md`, `I18N_TEST_PLAN.md` |

---

# PHASE DARKMODE: AEVO Adaptive Theme (Light / Dark / System)

## Mục tiêu Phase DARKMODE
- Thiết lập hệ thống **Semantic Color Tokens** chuẩn xác cho cả **Light Mode** (`:root`) và **Dark Mode** (`.dark`) theo đúng bảng màu trong `darkmode.md`, đồng thời tích hợp mượt mà với Tailwind CSS (hỗ trợ đầy đủ opacity modifiers như `/80`, `/40`, `/10`)
- Triển khai `ThemeProvider` (`next-themes`) với **Light Mode làm mặc định** (`defaultTheme="light"`), hỗ trợ 3 chế độ **Light / Dark / System** (`enableSystem`), lưu trữ bền vững qua `localStorage`, chống nháy giao diện (FOUC) và tránh lỗi hydration mismatch (`suppressHydrationWarning`)
- Xây dựng component chuyển đổi giao diện `ThemeSwitcher` (`Light` / `Dark` / `System`) có đầy đủ biểu tượng Lucide (`Sun`, `Moon`, `Monitor`), hỗ trợ bàn phím (`focus-visible`), screen reader (`aria-label`, `aria-pressed`) và đa ngôn ngữ (`ENG` / `VIE`)
- Áp dụng Adaptive Dark Mode đồng bộ trên toàn bộ các trang:
  - **Storefront**: Homepage (`/`), Product Catalog (`/products`), Product Detail (`/products/[slug]`), Realtime Reviews
  - **Commerce**: Shopping Cart (`/cart`), Multi-step Checkout (`/checkout`), Order Confirmation (`/checkout/success`)
  - **Authentication & Account**: Login (`/login`), Register (`/register`), Forgot/Reset Password (`/forgot-password`, `/reset-password`), Profile (`/account/profile`), Delivery Addresses (`/account/addresses`), Order History & Tracking (`/account/orders`, `/account/orders/[id]`)
  - **Admin Foundation (AEVO Control)**: Cấu hình theme-aware tokens cho Charts (Recharts), Data Tables, Badges và Dialogs (không thêm bất kỳ module hay tính năng nào ngoài phạm vi đề bài)
- Tuyệt đối không dùng `filter: invert(1)` lên ảnh sản phẩm hoặc logo hãng; giữ nguyên 100% logic nghiệp vụ và tương thích ngược hoàn toàn với các bộ E2E test của Phase 1, Phase 2, Phase 3 và i18n

---

## Task DM.1: Semantic Color Tokens & Tailwind CSS Integration

### Checklist
- [ ] Khai báo đầy đủ bộ biến CSS semantic tokens cho `:root` (Light Mode — `color-scheme: light`) và `.dark` (Dark Mode — `color-scheme: dark`) trong `apps/web/app/globals.css` theo `darkmode.md` Mục 3 & 5.2:
  - `--aevo-bg`: `#F5F5F3` (Light) / `#111214` (Dark)
  - `--aevo-surface`: `#FFFFFF` (Light) / `#1C1D20` (Dark)
  - `--aevo-surface-muted`: `#F0F0EE` (Light) / `#25262A` (Dark)
  - `--aevo-text`: `#171717` (Light) / `#F5F5F3` (Dark)
  - `--aevo-text-muted`: `#737373` (Light) / `#A3A7AD` (Dark)
  - `--aevo-border`: `#E5E5E3` (Light) / `#333438` (Dark)
  - `--aevo-primary`: `#171717` (Light) / `#F5F5F3` (Dark)
  - `--aevo-primary-foreground`: `#FFFFFF` (Light) / `#171717` (Dark)
  - `--aevo-accent`: `#52665C` (Light) / `#9DB7A5` (Dark)
  - `--aevo-focus`: `#52665C` (Light) / `#A9C4B3` (Dark)
  - `--aevo-danger`: `#B42318` (Light) / `#FF8A80` (Dark)
  - `--aevo-success`: `#237A4B` (Light) / `#70D8A0` (Dark)
  - `--aevo-warning`: `#946200` (Light) / `#F0C674` (Dark)
- [ ] Cung cấp các biến kênh màu RGB tương ứng (`--aevo-bg-rgb`, `--aevo-surface-rgb`, `--aevo-text-rgb`, ...) và giữ lại các biến `--color-canvas: #F5F5F3` / `--color-surface: #FFFFFF` trong `:root` để tương thích 100% với E2E test `FE-02`
- [ ] Cập nhật `apps/web/tailwind.config.js` (`darkMode: ["class"]`) ánh xạ toàn bộ semantic tokens (`canvas`, `bg`, `surface`, `surface-muted`, `ink`, `primary`, `primary-foreground`, `secondary`, `border`, `sage`, `accent`, `focus`, `danger`, `success`, `warning`) hỗ trợ cú pháp `<alpha-value>` của Tailwind
- [ ] Cập nhật các utility classes `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.focus-ring` trong `apps/web/app/globals.css` để tự động đảo màu chữ/nền chuẩn xác giữa Light & Dark Mode và tôn trọng `prefers-reduced-motion: reduce`
- [ ] Đảm bảo `apps/web/components.json` giữ cấu hình `"tsx": false` và `"cssVariables": true`

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|-----------------|
| DM-01 | Biến CSS `:root` (Light Mode) đúng mã màu chuẩn AEVO | 1. Kiểm tra stylesheet trả về từ frontend<br>2. Đối chiếu các biến `:root` | Có `color-scheme: light`, `--aevo-bg: #F5F5F3`, `--aevo-surface: #FFFFFF`, `--aevo-text: #171717`, `--aevo-border: #E5E5E3`, `--aevo-accent: #52665C` |
| DM-02 | Biến CSS `.dark` (Dark Mode) đúng mã màu chuẩn AEVO | 1. Kiểm tra khối `.dark` trong stylesheet | Có `color-scheme: dark`, `--aevo-bg: #111214`, `--aevo-surface: #1C1D20`, `--aevo-surface-muted: #25262A`, `--aevo-text: #F5F5F3`, `--aevo-text-muted: #A3A7AD`, `--aevo-border: #333438`, `--aevo-accent: #9DB7A5` |
| DM-03 | Primary CTA & Status tokens hỗ trợ cả 2 theme | 1. Kiểm tra `--aevo-primary`, `--aevo-primary-foreground`, `--aevo-danger`, `--aevo-success`, `--aevo-warning` | Light: `#171717`/`#FFFFFF`; Dark: `#F5F5F3`/`#171717` cùng đầy đủ màu trạng thái |
| DM-04 | Tương thích ngược với `FE-02` & cấu hình `components.json` | 1. Chạy kiểm tra token `#F5F5F3` của `FE-02`<br>2. Kiểm tra `components.json` | `FE-02` PASS, `components.json` có `"tsx": false` |

### Test Command
```bash
curl -s http://localhost:3000/ | grep -o '/_next/static/css/[^"]*\.css' | head -n 1 | xargs -I {} curl -s "http://localhost:3000{}" | grep -E "aevo-bg|aevo-surface|color-scheme"
```

---

## Task DM.2: Theme Provider, Anti-FOUC SSR Setup & Theme Switcher (`Light` / `Dark` / `System`)

### Checklist
- [ ] Cài đặt `next-themes` vào `apps/web/package.json` (giữ nguyên `lucide-react` hiện có)
- [ ] Tạo `apps/web/components/providers/theme-provider.jsx` cấu hình `NextThemesProvider` với `attribute="class"`, `defaultTheme="light"`, `enableSystem`, `disableTransitionOnChange`
- [ ] Tích hợp `ThemeProvider` vào `apps/web/app/layout.js` và thêm `suppressHydrationWarning` vào thẻ `<html>` để ngăn lỗi hydration mismatch và FOUC
- [ ] Xây dựng component `ThemeSwitcher` (`apps/web/components/ThemeSwitcher.js` & `apps/web/components/theme-switcher.jsx`) hỗ trợ 3 chế độ:
  - `light` (`Light` / `Sáng` — icon `Sun`)
  - `dark` (`Dark` / `Tối` — icon `Moon`)
  - `system` (`System` / `Hệ thống` — icon `Monitor`)
- [ ] Đảm bảo accessibility cho `ThemeSwitcher`: dùng `<fieldset>` / `role="group"`, `aria-label`, `aria-pressed`, `focus-visible` outline theo `--aevo-focus`, và placeholder kích thước cố định khi chưa mount để tránh layout shift (CLS)
- [ ] Bổ sung từ khóa đa ngôn ngữ (`ENG` / `VIE`) cho `ThemeSwitcher` trong `apps/web/lib/i18n/dictionaries.js`
- [ ] Tích hợp `ThemeSwitcher` lên `SiteHeader` (cạnh `LanguageSwitcher`) và trên các trang Auth (`/login`, `/register`, `/forgot-password`, `/reset-password`)

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|-----------------|
| DM-05 | Mặc định là Light Mode cho khách truy cập mới | 1. Truy cập `/` lần đầu (chưa có `localStorage.theme`)<br>2. Kiểm tra cấu hình `ThemeProvider` | `defaultTheme="light"`, `attribute="class"`, `enableSystem=true`, không tự ý ép sang Dark khi chưa chọn |
| DM-06 | Chống FOUC & Hydration Mismatch trên SSR | 1. Request `/` qua HTTP<br>2. Kiểm tra thẻ `<html>` và script khởi tạo theme của `next-themes` | Thẻ `<html>` có tích hợp anti-FOUC script của `next-themes`, không báo lỗi hydration |
| DM-07 | Hiển thị `ThemeSwitcher` trên Header và trang Auth | 1. Kiểm tra HTML/DOM của `/`, `/products`, `/login`, `/register`<br>2. Tìm `data-testid="theme-switcher"` | Hiển thị `ThemeSwitcher` với 3 lựa chọn `light`, `dark`, `system` |
| DM-08 | `ThemeSwitcher` hỗ trợ đa ngôn ngữ `ENG` / `VIE` và Accessibility | 1. Kiểm tra `ThemeSwitcher` ở locale `en` và `vi`<br>2. Kiểm tra `aria-label`, `aria-pressed` | Hiển thị `Light/Dark/System` (`en`) và `Sáng/Tối/Hệ thống` (`vi`), đầy đủ thuộc tính ARIA |

### Test Command
```bash
curl -s http://localhost:3000/ | grep -o 'data-testid="theme-switcher"'
curl -s http://localhost:3000/login | grep -o 'data-testid="theme-switcher"'
```

---

## Task DM.3: Dark Mode Storefront (Homepage, Catalog, Product Card, Pagination & Product Detail)

### Checklist
- [ ] Cập nhật `SiteHeader.js` và `SiteFooter.js`: badge số lượng giỏ hàng (`header-cart-count`), thanh điều hướng cố định (`bg-surface/80 backdrop-blur-md`) và chữ logo `aevo.` tự động chuyển sang `#F5F5F3` trên nền tối
- [ ] Cập nhật `HomeClient.js`:
  - Hero CTA chính dùng `bg-primary text-primary-foreground` (nền sáng `#F5F5F3`, chữ tối `#171717` trong Dark Mode)
  - Khung thông báo lỗi tải dữ liệu hỗ trợ Dark Mode (`dark:bg-amber-950/40 dark:border-amber-800/60 dark:text-amber-200`)
  - Không áp dụng `filter: invert(1)` lên ảnh Hero hay ảnh sản phẩm
- [ ] Cập nhật `ProductCard.js` & `Pagination.js`:
  - Badge `NEW ARRIVAL` và nút trang hiện tại (`isCurrent`) dùng `bg-primary text-primary-foreground` thay vì `bg-ink text-white` cứng
  - Khung ảnh sản phẩm giữ nền trung tính, không biến đổi màu ảnh gốc
- [ ] Cập nhật `CatalogClient.js`:
  - Các nút category đang chọn, quick price range đang chọn, rating filter đang chọn, tag filter đang chọn và nút Apply Filters dùng `bg-primary text-primary-foreground`
  - Biểu tượng ngôi sao trong bộ lọc đánh giá hiển thị rõ ở cả hai chế độ
  - Mobile filter drawer có lớp phủ tối (`bg-black/60 backdrop-blur-xs`) và nút đóng rõ ràng
- [ ] Cập nhật `ProductDetailClient.js`:
  - Nút `Add to cart` và nút gửi đánh giá dùng `bg-primary text-primary-foreground`
  - Trạng thái tồn kho (`In stock` / `Out of stock`), thông báo thêm giỏ hàng và thông báo gửi bình luận dùng token màu ngữ nghĩa (`text-success`, `text-danger`, nền thông báo tương thích Dark Mode)
  - Khu vực Reviews, Rating distribution bars và trạng thái Socket.IO (`Live updates active`) hiển thị độ tương phản cao trên nền `#1C1D20`

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|-----------------|
| DM-09 | Homepage (`/`) tương thích Dark Mode & không đảo màu ảnh | 1. Truy cập `/`<br>2. Kiểm tra Hero, Product Cards, Category Showcases | Các bề mặt dùng semantic tokens (`bg-surface`, `bg-canvas`), CTA dùng `text-primary-foreground`, ảnh sản phẩm không có `invert` |
| DM-10 | Catalog (`/products`) filters, sort, pills & drawer tương thích Dark Mode | 1. Truy cập `/products?category=laptops&sort=price_asc`<br>2. Kiểm tra sidebar, sort select, active pills, pagination | Trạng thái active có cả viền/chữ rõ ràng, không bị chữ trắng trên nền trắng khi bật `.dark` |
| DM-11 | Product Detail (`/products/macbook-pro-m3`) gallery, variants & reviews tương thích Dark Mode | 1. Truy cập `/products/macbook-pro-m3`<br>2. Kiểm tra gallery, variant selector, stock badge, specs, reviews | Variant đang chọn có border/ring rõ, giá và nút Add to cart nổi bật, không hardcode màu sáng |

### Test Command
```bash
curl -s http://localhost:3000/products/macbook-pro-m3 | grep -o 'data-testid="product-detail-page"'
```

---

## Task DM.4: Dark Mode Commerce & Customer Account (Cart, Checkout, Auth, Profile, Addresses & Orders)

### Checklist
- [ ] Cập nhật `CartClient.js`:
  - Nút `Checkout`, nút `Explore Collection` (khi giỏ trống) dùng `bg-primary text-primary-foreground`
  - Khung `Order Summary` dùng `bg-surface` nổi bật trên nền `bg-canvas` (`#1C1D20` trên `#111214`)
  - Thông báo lỗi tồn kho / giỏ hàng dùng màu ngữ nghĩa hỗ trợ Dark Mode
- [ ] Cập nhật `CheckoutClient.js` và `app/(store)/checkout/success/page.js`:
  - Thanh tiến trình 5 bước (`1. Information` → `5. Review`) hiển thị trạng thái hiện tại / hoàn thành rõ ràng ở cả Light và Dark Mode
  - Các ô input, textarea, nút chọn địa chỉ đã lưu, phương thức vận chuyển, phương thức thanh toán (radio indicator), mã giảm giá và điểm thưởng hiển thị rõ trên nền tối
  - Hoàn thiện đồng bộ hiển thị đa ngôn ngữ (`ENG`/`VIE`) trên `CheckoutClient.js` mà vẫn giữ nguyên 100% tương thích với `phase3.e2e.js`
  - Trang `/checkout/success` hiển thị chi tiết đơn hàng, trạng thái, điểm thưởng và nút điều hướng chuẩn Dark Mode
- [ ] Cập nhật các trang Auth (`/login`, `/register`, `/forgot-password`, `/reset-password`, `/logout`):
  - Tích hợp `ThemeSwitcher` cạnh `LanguageSwitcher`
  - Các thông báo lỗi/thành công và input lỗi hiển thị tương phản tốt trên nền tối
- [ ] Cập nhật các trang Account (`/account/profile`, `/account/addresses`, `/account/orders`, `/account/orders/[id]`):
  - Thanh tab điều hướng Account (`Profile & Security`, `Delivery Addresses`, `Order History`) dùng `bg-primary text-primary-foreground` cho tab đang chọn
  - Badge trạng thái đơn hàng (`PENDING`, `CONFIRMED`, `SHIPPING`, `DELIVERED`, `CANCELLED`) và bảng lịch sử trạng thái (`status-history-table`) hỗ trợ Dark Mode rõ ràng, kết hợp cả icon + text + màu sắc

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|-----------------|
| DM-12 | Shopping Cart (`/cart`) tương thích Dark Mode | 1. Truy cập `/cart`<br>2. Kiểm tra cart items, quantity stepper, order summary | Các thành phần dùng semantic tokens, nút Checkout có độ tương phản chuẩn |
| DM-13 | Checkout (`/checkout`) & Order Success (`/checkout/success`) tương thích Dark Mode | 1. Truy cập `/checkout` và `/checkout/success`<br>2. Kiểm tra các bước, form inputs, summary, success screen | Không bị lỗi chữ trắng trên nền trắng, giữ nguyên toàn bộ logic guest checkout, discount, loyalty |
| DM-14 | Các trang Auth (`/login`, `/register`, `/forgot-password`, `/reset-password`) tương thích Dark Mode | 1. Truy cập từng trang Auth<br>2. Kiểm tra split layout, form inputs, notices, `ThemeSwitcher` | Tất cả trang Auth render 200 OK, có `ThemeSwitcher` và dùng semantic tokens |
| DM-15 | Các trang Account (`/account/profile`, `/account/addresses`, `/account/orders`, `/account/orders/[id]`) tương thích Dark Mode | 1. Truy cập các trang Account<br>2. Kiểm tra tabs, cards, address form, order status badges & timeline | Hiển thị đồng nhất theo semantic tokens, timeline đơn hàng có cả icon và text |

### Test Command
```bash
curl -s http://localhost:3000/checkout | grep -o 'data-testid="checkout-page"'
curl -s http://localhost:3000/account/orders | grep -o 'data-testid="orders-history-page"'
```

---

## Task DM.5: Dark Mode Admin Foundation & Theme-Aware Chart/Table Helpers (AEVO Control)

### Checklist
- [ ] Tạo module cấu hình theme cho biểu đồ & bảng quản trị tại `apps/web/lib/theme-config.js` (cung cấp bảng màu `LIGHT_THEME_TOKENS`, `DARK_THEME_TOKENS` và helper `getChartTheme(resolvedTheme)` cho Recharts: axis ticks, grid lines, tooltip surface/border/text, primary/accent/success/warning/danger series)
- [ ] Bổ sung các utility classes cho Data Table & Admin Surface trong `apps/web/app/globals.css` (`.surface-card`, `.surface-muted-panel`, `.table-row-interactive`) để phục vụ các trang AEVO Control (`Dashboard`, `Products`, `Users`, `Orders`, `Discounts`)
- [ ] Tuân thủ tuyệt đối giới hạn của `requirement.md` và `darkmode.md`: không thêm bất kỳ module quản trị hay tính năng nghiệp vụ nào ngoài đề bài

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|-----------------|
| DM-16 | Helper `getChartTheme` trả về cấu hình Recharts chuẩn cho cả Light & Dark Mode | 1. Gọi `getChartTheme('light')` và `getChartTheme('dark')`<br>2. Kiểm tra màu axis, grid, tooltip, series | Light: tooltip `#FFFFFF`, text `#171717`, grid `#E5E5E3`; Dark: tooltip `#1C1D20`, text `#F5F5F3`, grid `#333438` (không hardcode chữ đen trong tooltip) |
| DM-17 | Không phát sinh module ngoài phạm vi đề bài | 1. Kiểm tra danh sách routes và modules | Chỉ giữ nguyên các route trong sitemap AEVO, không thêm tính năng thừa |

---

## Task DM.6: End-to-End Verification & Regression Suite (`darkmode.e2e.js`)

### Checklist
- [ ] Viết bộ kiểm thử tự động `apps/api/test/darkmode.e2e.js` kiểm tra toàn diện các tiêu chí nghiệm thu trong `darkmode.md` (Mục 9 — Testing Matrix & Acceptance Criteria)
- [ ] Kiểm tra kết hợp đồng thời cả 2 tính năng mở rộng: **Adaptive Dark Mode** (`light`/`dark`/`system`) + **Internationalization** (`ENG`/`VIE`)
- [ ] Chạy lại toàn bộ các bộ E2E test hiện có (`phase1.e2e.js`, `phase2.e2e.js`, `phase3.e2e.js`) cùng `darkmode.e2e.js` để đảm bảo 100% PASS không có bất kỳ hồi quy (regression) nào

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|-----------------|
| DM-18 | Kiểm tra toàn bộ Acceptance Criteria của `darkmode.md` | 1. Chạy `node apps/api/test/darkmode.e2e.js` | Toàn bộ test cases `DM-01` → `DM-20` đều PASS |
| DM-19 | Kết hợp Dark Mode + Tiếng Việt (`aevo_locale=vi`) hoạt động mượt mà | 1. Request các trang với `Cookie: aevo_locale=vi`<br>2. Kiểm tra `ThemeSwitcher` và nội dung trang | `ThemeSwitcher` hiển thị nhãn Tiếng Việt (`Giao diện`, `Sáng`, `Tối`, `Hệ thống`), không xung đột state |
| DM-20 | Toàn bộ Regression Suite (Phase 1 + Phase 2 + Phase 3 + Dark Mode) PASS 100% | 1. Chạy `phase1.e2e.js`<br>2. Chạy `phase2.e2e.js`<br>3. Chạy `phase3.e2e.js`<br>4. Chạy `darkmode.e2e.js` | Tất cả 4 bộ test đều PASS 100% |

### Test Command
```bash
node apps/api/test/phase1.e2e.js
node apps/api/test/phase2.e2e.js
node apps/api/test/phase3.e2e.js
node apps/api/test/darkmode.e2e.js
```

---

## Phase DARKMODE Completion Criteria

| Criteria | Status |
|----------|--------|
| Semantic color tokens (`:root` & `.dark`) trong `globals.css` và `tailwind.config.js` hoàn chỉnh | ✅ |
| `ThemeProvider` (`next-themes`, `defaultTheme="light"`, `enableSystem`) & chống FOUC hoạt động | ✅ |
| `ThemeSwitcher` (`Light` / `Dark` / `System`) hỗ trợ bàn phím, ARIA và song ngữ `ENG`/`VIE` | ✅ |
| Storefront (Homepage, Catalog, Product Detail, Reviews) tương thích Dark Mode & không invert ảnh | ✅ |
| Commerce & Account (Cart, Checkout, Success, Auth, Profile, Addresses, Orders) tương thích Dark Mode | ✅ |
| Recharts / Admin theme helpers (`lib/theme-config.js`) sẵn sàng cho AEVO Control | ✅ |
| Tất cả test cases (`phase1.e2e.js`, `phase2.e2e.js`, `phase3.e2e.js`, `darkmode.e2e.js`) pass 100% | ✅ |

---

# Appendix: Test Summary Table

## Semantic Tokens, Provider & Switcher Tests (Task DM.1 - DM.2)
| TC ID | Test Name | Expected |
|-------|-----------|----------|
| DM-01 | Light Mode CSS tokens (`:root`) | `--aevo-bg: #F5F5F3`, `--aevo-surface: #FFFFFF`, `--aevo-text: #171717`, `color-scheme: light` |
| DM-02 | Dark Mode CSS tokens (`.dark`) | `--aevo-bg: #111214`, `--aevo-surface: #1C1D20`, `--aevo-text: #F5F5F3`, `color-scheme: dark` |
| DM-03 | Primary CTA & semantic status tokens | `--aevo-primary`, `--aevo-primary-foreground`, `--aevo-danger`, `--aevo-success`, `--aevo-warning` defined |
| DM-04 | Backward compatibility with `FE-02` & `components.json` | `#F5F5F3` token check passes & `"tsx": false` preserved |
| DM-05 | Default Light Mode & `ThemeProvider` config | `defaultTheme="light"`, `enableSystem`, `attribute="class"` |
| DM-06 | Anti-FOUC script & `suppressHydrationWarning` | NextThemes anti-FOUC script injected in SSR HTML |
| DM-07 | `ThemeSwitcher` rendered in Header & Auth pages | `data-testid="theme-switcher"` present on storefront & auth routes |
| DM-08 | `ThemeSwitcher` ARIA attributes & `ENG`/`VIE` localization | `aria-label`, `aria-pressed`, localized labels (`Light/Dark/System` & `Sáng/Tối/Hệ thống`) |

## Storefront, Commerce, Account & Regression Tests (Task DM.3 - DM.6)
| TC ID | Test Name | Expected |
|-------|-----------|----------|
| DM-09 | Homepage Dark Mode styling & non-inverted product photos | Semantic surfaces/CTAs used, no `filter: invert` on product images |
| DM-10 | Catalog page Dark Mode styling (filters, sort, pills, drawer) | Semantic active states & borders across filter controls |
| DM-11 | Product Detail & Realtime Reviews Dark Mode styling | Gallery, variants, stock badges & review cards theme-aware |
| DM-12 | Shopping Cart Dark Mode styling | Cart item cards, stepper & summary panel theme-aware |
| DM-13 | Checkout & Order Success Dark Mode styling | 5-step checkout, discount/loyalty inputs & confirmation page theme-aware |
| DM-14 | Auth pages (`/login`, `/register`, `/forgot-password`, `/reset-password`) Dark Mode | Split layout, inputs, notices & `ThemeSwitcher` rendered |
| DM-15 | Account pages (`profile`, `addresses`, `orders`, `orders/[id]`) Dark Mode | Account tabs, address cards, status badges & history table theme-aware |
| DM-16 | Admin Recharts & Table theme configuration (`lib/theme-config.js`) | Theme-aware axis, grid, tooltip & series colors for Light & Dark |
| DM-17 | Strict rubric compliance (no extra modules) | Sitemap & feature set strictly adhere to `requirement.md` |
| DM-18 | Full Dark Mode E2E suite (`darkmode.e2e.js`) | All Dark Mode tests pass |
| DM-19 | Combined Dark Mode + Vietnamese (`aevo_locale=vi`) integration | Seamless coexistence of theme & locale switchers |
| DM-20 | Full Regression Suite (Phase 1 + Phase 2 + Phase 3 + Dark Mode) | 100% pass across all E2E test suites |

---

# Definition of Done

| Task | Done Criteria |
|------|---------------|
| Task DM.1 | `apps/web/app/globals.css` + `apps/web/tailwind.config.js` với đầy đủ `--aevo-*` semantic tokens cho `:root` và `.dark` |
| Task DM.2 | `next-themes` cài đặt + `components/providers/theme-provider.jsx` + `components/ThemeSwitcher.js` + tích hợp vào `app/layout.js`, `SiteHeader.js` và Auth pages |
| Task DM.3 | `HomeClient.js` + `CatalogClient.js` + `ProductCard.js` + `Pagination.js` + `ProductDetailClient.js` tương thích hoàn toàn với Dark Mode |
| Task DM.4 | `CartClient.js` + `CheckoutClient.js` + `checkout/success/page.js` + Auth pages + Account pages (`profile`, `addresses`, `orders`) tương thích hoàn toàn với Dark Mode |
| Task DM.5 | `apps/web/lib/theme-config.js` cung cấp cấu hình màu semantic & Recharts theme-aware cho AEVO Control |
| Task DM.6 | `apps/api/test/darkmode.e2e.js` + toàn bộ `phase1.e2e.js`, `phase2.e2e.js`, `phase3.e2e.js` PASS 100% |

---

# Notes

1. **Mỗi task hoàn thành → Commit ngay**
2. **Mỗi task cần test case pass trước khi commit**
3. **Giao diện mặc định luôn là `light` khi người dùng chưa chọn theme (theo đúng quy tắc AEVO Light-first trong `concept.md` và `darkmode.md`)**
4. **Không áp filter đảo màu (`invert`) lên ảnh sản phẩm hoặc logo thương hiệu**
5. **Test case fail → Fix → Retest → Pass → Commit**

---

**Document Version:** 1.0  
**Created:** 2026  
**Project:** AEVO E-commerce
