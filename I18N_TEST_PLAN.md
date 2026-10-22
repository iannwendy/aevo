# AEVO E-commerce — ENG/VIE Internationalization (i18n) Plan

> **⚠️ QUAN TRỌNG - QUY TẮC LÀM VIỆC:**
> - **Sau mỗi task HOÀN THÀNH → Commit ngay lập tức**
> - **Mỗi task phải có testcase đầy đủ trước khi đánh dấu hoàn thành**
> - **Sau mỗi phase → Chạy full test → Tất cả pass mới push lên remote**
> - **Không push code chưa test hoặc đang fail**

---

# Project Overview

| Thông tin | Chi tiết |
|-----------|----------|
| Project | AEVO - Premium Computing E-commerce |
| Feature | Multi-language Internationalization (`ENG` / `VIE`) |
| Tech Stack | Next.js 14 (App Router), React Context + SSR Cookie (`aevo_locale`), Tailwind CSS |
| Supported Locales | `en` (ENG - Default), `vi` (VIE - Tiếng Việt) |
| Base Reference | `E2E_TEST_PLAN.md`, `concept.md` |

---

# PHASE I18N: Multi-Language Internationalization (ENG / VIE)

## Mục tiêu Phase I18N
- Xây dựng kiến trúc đa ngôn ngữ (`ENG` / `VIE`) hỗ trợ cả SSR (Server-Side Rendering qua cookie `aevo_locale`) và CSR (Client-Side instant switching không cần reload trang)
- Lưu trữ tùy chọn ngôn ngữ bền vững trong Cookie (`aevo_locale`) và `localStorage`, đồng bộ thuộc tính `<html lang="en|vi">`
- Thiết kế bộ chuyển đổi ngôn ngữ `ENG / VIE` (`LanguageSwitcher`) theo đúng triết lý thiết kế "Refined Minimalism" của AEVO trên Header, Mobile và các trang Auth
- Việt hóa toàn diện và chuẩn xác thuật ngữ phần cứng/thương mại điện tử trên toàn bộ giao diện: Homepage, Product Catalog, Product Detail, Reviews, Shopping Cart, Login, Register, Forgot/Reset Password và Account Profile
- Đảm bảo tương thích ngược 100% với toàn bộ E2E test của Phase 1 & Phase 2 (mặc định `en`)

---

## Task I18N.1: Core i18n Architecture, Dictionaries & Persistence

### Checklist
- [x] Tạo bộ từ điển song ngữ `en` (ENG) và `vi` (VIE) đầy đủ tại `apps/web/lib/i18n/dictionaries.js`
- [x] Hỗ trợ nội suy biến động `{param}` (ví dụ: `{count}`, `{min}`, `{max}`, `{name}`) và dịch danh mục sản phẩm (`laptops`, `components`, `monitors`, `storage`, `peripherals`, `accessories`)
- [x] Tạo `I18nProvider` và hook `useI18n()` tại `apps/web/lib/i18n/index.js`
- [x] Đồng bộ trạng thái ngôn ngữ với cookie `aevo_locale`, `localStorage` và `<html lang="...">`
- [x] Tích hợp đọc cookie `aevo_locale` từ Server Component trong `apps/web/app/layout.js` để render đúng ngôn ngữ ngay từ SSR (không bị hydration flicker)

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|-----------------|
| I18N-01 | Mặc định render tiếng Anh (`en`) | 1. Request `/` không kèm cookie `aevo_locale` | `<html lang="en">`, hiển thị nội dung tiếng Anh mặc định |
| I18N-02 | SSR render tiếng Việt qua cookie `aevo_locale=vi` | 1. Request `/` với header `Cookie: aevo_locale=vi` | `<html lang="vi">`, nội dung SSR trả về tiếng Việt |
| I18N-03 | Fallback an toàn với locale không hợp lệ | 1. Request `/` với `Cookie: aevo_locale=fr` | Tự động fallback về `en`, không xảy ra lỗi runtime |
| I18N-04 | Dictionary interpolation & category localization | 1. Gọi `t('catalog.showingCount', { shown: 12, total: 24 })` ở cả `en` và `vi`<br>2. Gọi helper dịch category theo slug | Chuỗi được thay thế biến chính xác ở cả 2 ngôn ngữ |

### Test Command
```bash
curl -s http://localhost:3000/ | grep -o '<html lang="[^"]*"'
curl -s -H "Cookie: aevo_locale=vi" http://localhost:3000/ | grep -o '<html lang="[^"]*"'
```

---

## Task I18N.2: Global Layout, Header, Footer & Language Switcher (`ENG` / `VIE`)

### Checklist
- [x] Xây dựng component `LanguageSwitcher` (`data-testid="language-switcher"`) với 2 nút `ENG` (`data-testid="lang-btn-en"`) và `VIE` (`data-testid="lang-btn-vi"`)
- [x] Tích hợp `LanguageSwitcher` vào `SiteHeader` (hiển thị rõ ràng, tinh tế cạnh thanh điều hướng và giỏ hàng)
- [x] Dịch toàn bộ navigation links trên `SiteHeader` (`Shop`, `Laptops`, `Components`, `Monitors`, `Search`, `Account`, `Cart`)
- [x] Chuyển `SiteFooter` sang hỗ trợ đa ngôn ngữ (tagline, footer links, bản quyền)

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|-----------------|
| I18N-05 | Hiển thị nút chuyển đổi `ENG` / `VIE` trên Header | 1. Truy cập `/` hoặc `/products`<br>2. Kiểm tra `data-testid="language-switcher"` | Có đầy đủ nút `ENG` và `VIE`, trạng thái active (`aria-pressed="true"`) đúng với locale hiện tại |
| I18N-06 | Header dịch sang Tiếng Việt | 1. Chuyển sang `VIE`<br>2. Kiểm tra các link trên Header | Hiển thị `Cửa hàng`, `Laptop`, `Linh kiện`, `Màn hình`, `Tìm kiếm`, `Tài khoản`, `Giỏ hàng` |
| I18N-07 | Footer dịch sang Tiếng Việt | 1. Chuyển sang `VIE`<br>2. Kiểm tra Footer | Hiển thị tagline & liên kết chân trang bằng tiếng Việt |
| I18N-08 | Lưu giữ ngôn ngữ khi chuyển trang | 1. Chọn `VIE` ở `/` <br>2. Điều hướng sang `/products` và `/cart` | Cookie `aevo_locale=vi` được giữ nguyên, các trang tiếp theo đều hiển thị Tiếng Việt |

### Test Command
```bash
curl -s -H "Cookie: aevo_locale=vi" http://localhost:3000/ | grep -E "Cửa hàng|Tài khoản|Giỏ hàng"
```

---

## Task I18N.3: Storefront Localization (Homepage, Product Catalog, Product Card, Pagination)

### Checklist
- [x] Đa ngôn ngữ hóa `HomeClient.js`: Hero banner, New Arrivals, Best Sellers, Hardware Categories, 3 Category Showcases và thông báo lỗi
- [x] Đa ngôn ngữ hóa `CatalogClient.js`: Breadcrumb, tiêu đề, bộ lọc Sidebar & Mobile Drawer (Keyword Search, Category, Brand, Price Range, Quick Price Ranges, Customer Rating, Availability & Tags), Sort options, Active filter pills, Empty state
- [x] Đa ngôn ngữ hóa `ProductCard.js`: Badges (`New Arrival` / `Hàng mới`, `Best Seller` / `Bán chạy`), số lượng biến thể (`variant` / `tùy chọn`), nút xem sản phẩm (`View` / `Xem`)
- [x] Đa ngôn ngữ hóa `Pagination.js`: Thông tin hiển thị số lượng sản phẩm, nút `Prev` / `Trước` và `Next` / `Sau`

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|-----------------|
| I18N-09 | Homepage hiển thị Tiếng Việt | 1. Truy cập `/` với `aevo_locale=vi` | Hero hiển thị `"Công nghệ, tinh chỉnh."`, `"Khám phá bộ sưu tập"`, `"Sản phẩm mới"`, `"Bán chạy nhất"` |
| I18N-10 | Danh mục sản phẩm trên Homepage được Việt hóa | 1. Kiểm tra mục Categories ở chế độ `VIE` | Tên và mô tả danh mục (`Laptop`, `Linh kiện`, `Màn hình`, ...) hiển thị bằng tiếng Việt |
| I18N-11 | Catalog page & Sidebar filters hiển thị Tiếng Việt | 1. Truy cập `/products` với `aevo_locale=vi` | Hiển thị `"Khám phá phần cứng."`, `"Tìm kiếm từ khóa"`, `"Khoảng giá (VND)"`, `"Đánh giá khách hàng"`, `"Còn hàng"` |
| I18N-12 | Sort options & Active filter pills hiển thị Tiếng Việt | 1. Truy cập `/products?category=laptops&sort=price_asc` với `aevo_locale=vi` | Dropdown sort hiển thị `"Giá: Thấp đến Cao"`, badge lọc hiển thị `"Danh mục: ..."` |
| I18N-13 | ProductCard & Pagination hiển thị Tiếng Việt | 1. Kiểm tra thẻ sản phẩm & phân trang ở chế độ `VIE` | Hiển thị `"Hàng mới"`, `"Bán chạy"`, `"Hiển thị 1–12 trong 24 sản phẩm"`, `"Trước"` / `"Sau"` |

### Test Command
```bash
curl -s -H "Cookie: aevo_locale=vi" http://localhost:3000/products
```

---

## Task I18N.4: Product Detail, Variants, Specifications & Realtime Reviews Localization

### Checklist
- [x] Đa ngôn ngữ hóa `ProductDetailClient.js`: Breadcrumb, trạng thái kho (`In stock` / `Còn hàng`, `Out of stock` / `Hết hàng`), chọn cấu hình (`Select Configuration` / `Chọn cấu hình`), nút `Add to cart` / `Thêm vào giỏ`, thông báo thêm giỏ hàng
- [x] Đa ngôn ngữ hóa bảng `Technical Specifications` / `Thông số kỹ thuật` (Thương hiệu, Danh mục, Cấu hình đã chọn, Phiên bản hiện có, Thẻ)
- [x] Đa ngôn ngữ hóa khu vực `Reviews & Ratings`: Điểm trung bình, phân bổ sao, trạng thái WebSocket (`Live updates active` / `Cập nhật trực tiếp`), form gửi đánh giá (thành viên & khách) và danh sách đánh giá (`Verified Buyer` / `Đã mua hàng`, `Member` / `Thành viên`, `Guest` / `Khách`)
- [x] Định dạng ngày đánh giá theo đúng locale (`en-US` khi `ENG`, `vi-VN` khi `VIE`)

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|-----------------|
| I18N-14 | Product Detail hiển thị thông tin & tồn kho bằng Tiếng Việt | 1. Truy cập `/products/macbook-pro-m3` với `aevo_locale=vi` | Hiển thị `"Chọn cấu hình"`, `"Còn hàng · ... sản phẩm"`, `"Thêm vào giỏ"` |
| I18N-15 | Bảng Thông số kỹ thuật hiển thị Tiếng Việt | 1. Kiểm tra mục Specifications ở chế độ `VIE` | Hiển thị `"Thông số kỹ thuật"`, `"Thương hiệu"`, `"Danh mục"`, `"Cấu hình đã chọn"` |
| I18N-16 | Khu vực Đánh giá & Form bình luận hiển thị Tiếng Việt | 1. Kiểm tra mục Reviews ở chế độ `VIE` | Hiển thị `"Phản hồi từ cộng đồng."`, `"Viết đánh giá"`, `"Đăng bình luận khách"` |
| I18N-17 | Trang không tìm thấy sản phẩm (404 Product) hiển thị Tiếng Việt | 1. Xem sản phẩm không tồn tại ở chế độ `VIE` | Hiển thị `"Không tìm thấy sản phẩm"` và nút `"Quay lại cửa hàng"` |

### Test Command
```bash
curl -s -H "Cookie: aevo_locale=vi" http://localhost:3000/products/macbook-pro-m3
```

---

## Task I18N.5: Commerce & Account Pages Localization (Cart, Auth & Profile)

### Checklist
- [x] Đa ngôn ngữ hóa `CartClient.js`: Tiêu đề giỏ hàng, danh sách sản phẩm, trạng thái giỏ hàng trống, bảng `Order Summary` / `Tóm tắt đơn hàng` (Tạm tính, Phí vận chuyển, Thuế VAT, Tổng cộng, thông báo miễn phí vận chuyển, nút Thanh toán)
- [x] Đa ngôn ngữ hóa các trang Auth: `/login`, `/register`, `/forgot-password`, `/reset-password`, `/logout` và tích hợp `LanguageSwitcher` trên các trang Auth
- [x] Đa ngôn ngữ hóa trang `/account/profile`: Thông tin tài khoản, điểm thưởng (`Loyalty points` / `Điểm thưởng`), vai trò, phương thức đăng nhập, form cập nhật thông tin cá nhân, form đổi mật khẩu và sổ địa chỉ
- [ ] Đa ngôn ngữ hóa các trang Checkout (`/checkout`, `/checkout/success`), Lịch sử đơn hàng (`/account/orders`, `/account/orders/[id]`), Sổ địa chỉ (`/account/addresses`) và Admin Dashboard (sau khi hoàn tất các phase còn lại)
- [ ] Viết và chạy bộ kiểm thử E2E `apps/api/test/i18n.e2e.js` (sau khi hoàn tất các phase còn lại)

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|-----------------|
| I18N-18 | Trang Giỏ hàng (`/cart`) hiển thị Tiếng Việt | 1. Truy cập `/cart` với `aevo_locale=vi` | Hiển thị `"Giỏ hàng của bạn."`, `"Giỏ hàng đang trống"` hoặc `"Tóm tắt đơn hàng"`, `"Thanh toán"` |
| I18N-19 | Trang Đăng nhập (`/login`) & Đăng ký (`/register`) hiển thị Tiếng Việt | 1. Truy cập `/login` và `/register` với `aevo_locale=vi` | Hiển thị `"Chào mừng trở lại."`, `"Tiếp tục với Google"`, `"Tạo tài khoản"`, kèm nút chuyển đổi `ENG/VIE` |
| I18N-20 | Trang Quên mật khẩu & Đặt lại mật khẩu hiển thị Tiếng Việt | 1. Truy cập `/forgot-password` và `/reset-password` với `aevo_locale=vi` | Hiển thị `"Đặt lại mật khẩu"`, `"Gửi liên kết đặt lại"`, `"Chọn mật khẩu mới"` |
| I18N-21 | Trang Hồ sơ cá nhân (`/account/profile`) hiển thị Tiếng Việt | 1. Truy cập `/account/profile` với `aevo_locale=vi` | Hiển thị `"Tài khoản"`, `"Bạn chưa đăng nhập."` (khi guest) hoặc `"Điểm thưởng"`, `"Thông tin cá nhân"`, `"Đổi mật khẩu"` (khi đã đăng nhập) |
| I18N-22 | Tương thích ngược toàn bộ E2E Test Phase 1 & Phase 2 | 1. Chạy `phase1.e2e.js`<br>2. Chạy `phase2.e2e.js`<br>3. Chạy `i18n.e2e.js` | Tất cả test cases đều PASS 100% |

### Test Command
```bash
node apps/api/test/phase1.e2e.js
node apps/api/test/phase2.e2e.js
node apps/api/test/i18n.e2e.js
```

---

## Phase I18N Completion Criteria

| Criteria | Status |
|----------|--------|
| Core i18n Provider, Dictionaries (`ENG` / `VIE`) & Cookie SSR hoạt động | ✅ |
| Language Switcher (`ENG` / `VIE`) trên Header, Footer & Auth pages hoạt động | ✅ |
| Storefront (Homepage, Catalog, Product Card, Pagination) song ngữ hoàn chỉnh | ✅ |
| Product Detail, Specs & Realtime Reviews song ngữ hoàn chỉnh | ✅ |
| Cart, Login, Register, Forgot/Reset Password & Profile song ngữ hoàn chỉnh | ✅ |
| Checkout, Orders, Addresses & Admin Dashboard (Phase 3–4) song ngữ hoàn chỉnh | ⬜ |
| Tất cả test cases (`phase1.e2e.js`, `phase2.e2e.js`, `i18n.e2e.js`) pass | ⬜ |

---

# Appendix: Test Summary Table

## i18n Core & Layout Tests (Task I18N.1 - I18N.2)
| TC ID | Test Name | Expected |
|-------|-----------|----------|
| I18N-01 | Default English locale (`en`) | `<html lang="en">` + English copy |
| I18N-02 | Vietnamese SSR via cookie (`aevo_locale=vi`) | `<html lang="vi">` + Vietnamese copy |
| I18N-03 | Invalid locale fallback | Fallback to `en` safely |
| I18N-04 | Dictionary interpolation & category translation | Accurate variable & slug translation |
| I18N-05 | LanguageSwitcher component in Header | `ENG` & `VIE` buttons rendered |
| I18N-06 | Header navigation in Vietnamese | Vietnamese nav labels |
| I18N-07 | Footer content in Vietnamese | Vietnamese footer links & tagline |
| I18N-08 | Locale persistence across routes | Cookie & state preserved |

## Storefront, Product & Commerce i18n Tests (Task I18N.3 - I18N.5)
| TC ID | Test Name | Expected |
|-------|-----------|----------|
| I18N-09 | Homepage Vietnamese localization | Hero + sections localized |
| I18N-10 | Category cards Vietnamese localization | Category names & descriptions localized |
| I18N-11 | Catalog page & filters Vietnamese localization | Filters + headings localized |
| I18N-12 | Sort options & active filter pills localization | Sort & badges localized |
| I18N-13 | ProductCard & Pagination localization | Badges & page counts localized |
| I18N-14 | Product Detail & stock status localization | Variant & stock copy localized |
| I18N-15 | Technical Specifications localization | Spec labels localized |
| I18N-16 | Reviews & Rating form localization | Review stats & form localized |
| I18N-17 | Product Not Found localization | 404 product state localized |
| I18N-18 | Shopping Cart localization | Cart items, summary & empty state localized |
| I18N-19 | Login & Register localization | Auth forms + switcher localized |
| I18N-20 | Forgot & Reset Password localization | Password recovery forms localized |
| I18N-21 | Account Profile localization | Profile sections & forms localized |
| I18N-22 | Full regression pass (Phase 1 + Phase 2 + i18n) | 100% pass |

---

# Definition of Done

| Task | Done Criteria |
|------|---------------|
| Task I18N.1 | `lib/i18n/dictionaries.js` + `lib/i18n/index.js` + SSR cookie integration in `app/layout.js` |
| Task I18N.2 | `LanguageSwitcher.js` + `SiteHeader.js` + `SiteFooter.js` localized |
| Task I18N.3 | `HomeClient.js` + `CatalogClient.js` + `ProductCard.js` + `Pagination.js` localized |
| Task I18N.4 | `ProductDetailClient.js` localized (gallery, stock, specs, realtime reviews) |
| Task I18N.5 | `CartClient.js` + Auth pages + `ProfilePage` localized + `i18n.e2e.js` all pass |

---

# Notes

1. **Mỗi task hoàn thành → Commit ngay**
2. **Mỗi task cần test case pass trước khi commit**
3. **Mặc định luôn là `en` (`ENG`) khi chưa có cookie `aevo_locale` để đảm bảo không ảnh hưởng các E2E test hiện có**
4. **Test case fail → Fix → Retest → Pass → Commit**
5. **Documentation đầy đủ trong commit message**

---

**Document Version:** 1.0
**Created:** 2026
**Project:** AEVO E-commerce
