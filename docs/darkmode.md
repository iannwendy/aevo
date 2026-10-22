# AEVO — Adaptive Dark Mode Specification

> **Companion document:** `AEVO_Premium_Minimal_Concept.md`  
> **Project:** AEVO Store & AEVO Control  
> **Design direction:** Premium Minimal · Light-first · Optional Dark  
> **Status:** Đề xuất mở rộng UI/UX, **không phải chức năng bắt buộc của đề bài**.

## 1. Mục tiêu và nguyên tắc

AEVO sử dụng **Light Mode làm giao diện mặc định** như đã định nghĩa trong concept gốc. Dark Mode là chế độ tùy chọn nhằm cải thiện trải nghiệm sử dụng trong môi trường ánh sáng yếu và bổ sung cảm giác hiện đại cho thương hiệu. **Không thay đổi tên thương hiệu, bố cục, nghiệp vụ, sitemap hay giới hạn tính năng admin** khi đổi theme.

**Thứ tự ưu tiên:** (1) hoàn thành yêu cầu NodeJS Final Project; (2) hoàn thiện Light Mode; (3) triển khai Dark Mode; (4) kiểm thử cả hai chế độ. Nếu xung đột, **đề bài gốc > concept AEVO > tài liệu dark mode này**.

**Phạm vi áp dụng:** Homepage, catalog, product detail, cart, checkout, authentication, account, order tracking và toàn bộ các trang quản trị được phép trong AEVO Control. Không tạo thêm module admin hay nghiệp vụ mới.

## 2. Brand identity trong Dark Mode

| Thuộc tính | Light (concept gốc) | Dark (đề xuất) |
|---|---|---|
| Logo | `aevo.` màu `#171717` | `aevo.` màu `#F5F5F3` |
| Canvas | Porcelain `#F5F5F3` | Charcoal `#111214` |
| Surface | White `#FFFFFF` | Graphite `#1C1D20` |
| Primary text | Obsidian `#171717` | Porcelain `#F5F5F3` |
| Secondary text | `#737373` | Titanium `#A3A7AD` |
| Border | `#E5E5E3` | `#333438` |
| Primary CTA | Đen, chữ trắng | Trắng ngà, chữ tối |
| Accent | Sage `#52665C` | Sage sáng hơn `#9DB7A5` (đề xuất) |

- Giữ nguyên tagline **Technology, refined.**, brand promise **Exceptional hardware. Effortless experience.** và typography **Geist + Inter**.
- Dark Mode không đồng nghĩa với nền đen tuyệt đối `#000000`, neon, RGB gaming hoặc gradient rực rỡ.
- Ưu tiên phân cấp bằng tương phản, khoảng trắng, đường viền và ảnh sản phẩm; shadow trên nền tối chỉ là yếu tố phụ.
- Icon dùng **Lucide React** với màu kế thừa từ text semantic token.

## 3. Semantic color tokens

**Quan trọng:** Màu hex dưới đây là **thiết kế đề xuất**, không phải yêu cầu công nghệ từ đề bài. Không hardcode màu theo từng trang; sử dụng semantic tokens để hỗ trợ hai theme.

| Token | Light | Dark | Dùng cho |
|---|---|---|---|
| `--aevo-bg` | `#F5F5F3` | `#111214` | Page canvas |
| `--aevo-surface` | `#FFFFFF` | `#1C1D20` | Card / modal |
| `--aevo-surface-muted` | `#F0F0EE` | `#25262A` | Hover / inset panel |
| `--aevo-text` | `#171717` | `#F5F5F3` | Heading / body |
| `--aevo-text-muted` | `#737373` | `#A3A7AD` | Metadata |
| `--aevo-border` | `#E5E5E3` | `#333438` | Divider / outline |
| `--aevo-primary` | `#171717` | `#F5F5F3` | Primary CTA |
| `--aevo-primary-foreground` | `#FFFFFF` | `#171717` | CTA text |
| `--aevo-accent` | `#52665C` | `#9DB7A5` | Accent |
| `--aevo-focus` | `#52665C` | `#A9C4B3` | Focus ring |
| `--aevo-danger` | `#B42318` | `#FF8A80` | Error / destructive |
| `--aevo-success` | `#237A4B` | `#70D8A0` | Success |
| `--aevo-warning` | `#946200` | `#F0C674` | Warning |

**Accessibility:** Đo contrast trên từng cặp foreground/background thực tế, ưu tiên WCAG AA: 4.5:1 cho chữ thường, 3:1 cho chữ lớn và ranh giới UI quan trọng. Bảng màu này là điểm khởi đầu; không mặc định mọi cặp đã đạt chuẩn. Không dùng màu làm tín hiệu trạng thái duy nhất.

## 4. Theme behavior và persistence

Ba lựa chọn trong theme switcher:

1. **Light** — luôn hiển thị Light Mode.
2. **Dark** — luôn hiển thị Dark Mode.
3. **System** — theo `prefers-color-scheme` của hệ điều hành.

**Quy tắc mặc định của AEVO:** Nếu người dùng chưa chọn theme, **Light** được sử dụng (không tự động chuyển sang Dark theo OS). Khi chọn System, ứng dụng mới theo OS.

- Theme switcher đặt ở menu tài khoản hoặc header; admin có thể đặt trong khu vực profile/header.
- Lưu lựa chọn trên trình duyệt bằng `localStorage` thông qua `next-themes` (hoặc cơ chế tương đương).
- Áp dụng theme trước khi render nội dung tương tác để tránh nháy màu (FOUC) và hydration mismatch.
- Giữ lựa chọn khi đổi route hoặc refresh.
- Với người dùng chưa đăng nhập, theme vẫn hoạt động.
- Không lưu theme vào database trừ khi thực sự cần đồng bộ đa thiết bị; đây **không phải yêu cầu đề bài**.
- Cân nhắc trường hợp JavaScript bị vô hiệu hóa: trang vẫn đọc được và mặc định sáng.

## 5. Implementation stack

Tuân thủ công nghệ đã chốt trong concept:

- **Next.js với JavaScript (`.js`, `.jsx`)**, không chuyển sang TypeScript nếu chưa được giảng viên cho phép.
- **Tailwind CSS** cho utility styles và semantic theme tokens.
- **shadcn/ui** làm component foundation, sử dụng cấu hình `components.json` với `"tsx": false`.
- **next-themes** (đề xuất) để quản lý theme, persistence và System mode.
- **Lucide React** cho icon Sun/Moon/Monitor.
- **Motion** cho chuyển động nhẹ; hỗ trợ `prefers-reduced-motion`.
- **Recharts** cho dashboard, phải hỗ trợ màu trục, tooltip, grid, series theo theme.
- **Express.js, PostgreSQL, Prisma, Redis, Socket.IO và Docker Compose** không cần thay đổi vì Dark Mode chỉ là presentation concern.

### 5.1. Cài đặt

Trong frontend Next.js:

```bash
npm install next-themes lucide-react
```

Nếu chưa có shadcn/ui:

```bash
npx shadcn@latest init
```

Trong `components.json`, bảo đảm có `"tsx": false` (giữ nguyên các khóa khác do CLI tạo).

### 5.2. Theme provider (JavaScript)

`components/providers/theme-provider.jsx`:

```jsx
"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";

export function ThemeProvider({ children }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      {children}
    </NextThemesProvider>
  );
}
```

`app/layout.jsx` (ví dụ rút gọn; giữ lại fonts, metadata và layout hiện có):

```jsx
import { ThemeProvider } from "@/components/providers/theme-provider";

export default function RootLayout({ children }) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
```

`app/globals.css` — ví dụ CSS variables độc lập với phiên bản Tailwind:

```css
:root {
  color-scheme: light;
  --aevo-bg: #F5F5F3;
  --aevo-surface: #FFFFFF;
  --aevo-surface-muted: #F0F0EE;
  --aevo-text: #171717;
  --aevo-text-muted: #737373;
  --aevo-border: #E5E5E3;
  --aevo-primary: #171717;
  --aevo-primary-foreground: #FFFFFF;
  --aevo-accent: #52665C;
  --aevo-focus: #52665C;
  --aevo-danger: #B42318;
  --aevo-success: #237A4B;
  --aevo-warning: #946200;
}

.dark {
  color-scheme: dark;
  --aevo-bg: #111214;
  --aevo-surface: #1C1D20;
  --aevo-surface-muted: #25262A;
  --aevo-text: #F5F5F3;
  --aevo-text-muted: #A3A7AD;
  --aevo-border: #333438;
  --aevo-primary: #F5F5F3;
  --aevo-primary-foreground: #171717;
  --aevo-accent: #9DB7A5;
  --aevo-focus: #A9C4B3;
  --aevo-danger: #FF8A80;
  --aevo-success: #70D8A0;
  --aevo-warning: #F0C674;
}

body {
  background: var(--aevo-bg);
  color: var(--aevo-text);
}
```

**Tích hợp Tailwind/shadcn:** Map các semantic tokens trên vào theme tokens của Tailwind và các biến shadcn tương ứng (`background`, `foreground`, `card`, `popover`, `primary`, `border`, `ring`, v.v.) theo **phiên bản đang cài**. Không duy trì hai hệ token mâu thuẫn. Ví dụ dùng trực tiếp CSS variable:

```jsx
<div className="bg-[var(--aevo-surface)] text-[var(--aevo-text)] border border-[var(--aevo-border)]">
  AEVO product card
</div>
```

### 5.3. Theme switcher

`components/theme-switcher.jsx`:

```jsx
"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";

const OPTIONS = [
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
  { value: "system", label: "System" },
];

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div aria-hidden="true" className="h-10 w-48" />;

  return (
    <fieldset aria-label="Appearance" className="flex gap-1">
      {OPTIONS.map(({ value, label }) => (
        <button
          key={value}
          type="button"
          aria-pressed={theme === value}
          onClick={() => setTheme(value)}
          className="rounded-lg border border-[var(--aevo-border)] px-3 py-2 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--aevo-focus)]"
        >
          {label}
        </button>
      ))}
    </fieldset>
  );
}
```

Ví dụ trên thể hiện logic cơ bản; trong ứng dụng thực tế nên tái sử dụng `Button`, `DropdownMenu` hoặc `ToggleGroup` của shadcn/ui và hiển thị trạng thái đang chọn rõ ràng. Tránh đọc theme từ `localStorage` trực tiếp trong server component.

## 6. Thiết kế chi tiết theo từng trang

### 6.1. Homepage

- Giữ nguyên section: Header, Hero, New Arrivals, Best Sellers, Laptops, Components, Monitors, Footer.
- Dark canvas `#111214`, hero có ảnh sản phẩm nền tối đồng nhất; **không tự áp filter invert lên ảnh sản phẩm**.
- CTA sáng nổi bật trên nền tối.
- Product card dùng `--aevo-surface`, label phụ và divider đủ tương phản.
- Không thay đổi pagination hoặc các yêu cầu homepage trong concept.

### 6.2. Catalog

- Sidebar, checkbox, price filter, brand filter, sorting và pagination đổi màu theo token.
- Selected filters phải dễ phân biệt bằng check/icon/border, không chỉ bằng màu.
- Mobile filter drawer có overlay tối, close button và focus trap đúng chuẩn.
- Không thay đổi logic tìm kiếm, bộ lọc, URL query parameters hoặc phân trang.

### 6.3. Product Detail

- Gallery có nền trung tính phù hợp từng ảnh; không invert ảnh, logo hãng hoặc nhãn sản phẩm.
- Variant được chọn có border/focus rõ, trạng thái hết hàng dễ nhận biết.
- Giá và nút Add to cart nổi bật; review stars đủ tương phản.
- Không thay đổi điều kiện guest comments, authenticated ratings, Socket.IO và tồn kho độc lập.

### 6.4. Cart

- Cart item có divider tinh tế, quantity stepper rõ ràng.
- Order summary nổi bật bằng surface khác canvas.
- Subtotal, discount, tax, shipping, total vẫn dễ đọc và được backend tính đúng.
- Không đổi hành vi cart, kiểm tra tồn kho hay guest cart.

### 6.5. Checkout

- Input background/surface rõ ràng, placeholder đủ tương phản nhưng không lấn át label.
- Các bước Information → Shipping → Payment → Review có current/completed/error state bằng cả icon và text.
- Discount code, validation errors, loyalty và tổng thanh toán phải dễ đọc.
- **Không được để Dark Mode ảnh hưởng logic guest checkout, thanh toán, email, tạo tài khoản hoặc trạng thái thành công.**

### 6.6. Authentication & Account

- Login, register, forgot password, profile, addresses, order history và order tracking dùng token chung.
- Password visibility, validation và error states rõ ràng.
- Timeline order status có text và biểu tượng, không chỉ dựa vào màu.

### 6.7. AEVO Control (Admin)

- Áp dụng cho Dashboard, Products, Users, Orders, Discounts — **không thêm module mới**.
- Sidebar và header dùng surface tối, trạng thái active rõ.
- KPI cards có phân cấp bằng font size và spacing.
- Data Table: row hover, selected row, sorting, pagination, filter và action menu đều đủ tương phản.
- Recharts: theme-aware axis ticks, legend, grid lines, tooltip, line/bar colors; không hardcode text đen trong tooltip.
- Date range picker, modal, dialog và confirmation phải hiển thị đúng trên nền tối.
- Không thay đổi logic báo cáo theo năm/quý/tháng/tuần và date range.

## 7. Images, assets và branding consistency

- **Ảnh sản phẩm:** dùng ảnh thật, đúng variant, có quyền sử dụng; không áp `filter: invert(1)` hoặc `brightness` đại trà.
- **Hero:** có thể sử dụng ảnh studio tối riêng nếu có asset phù hợp. Nếu chưa có, giữ ảnh Light trên một khung sáng có chủ đích thay vì biến đổi ảnh sai màu.
- **Logo:** ưu tiên wordmark vector hoặc CSS text có màu theo token; các logo đối tác/hãng giữ đúng nhận diện.
- **Icons:** Lucide React, dùng `currentColor` hoặc semantic tokens.
- **Charts:** màu dữ liệu cần dễ phân biệt trên cả hai nền và không dựa duy nhất vào màu để biểu thị ý nghĩa.
- **Animation:** chuyển theme không được gây nhấp nháy khó chịu; tôn trọng `prefers-reduced-motion`.

## 8. Accessibility, performance và SEO

- Kiểm tra tương phản văn bản, nút, input, focus ring, badge và biểu đồ.
- Theme switcher phải dùng được bằng bàn phím và screen reader.
- Không làm layout shift khi hydrate hoặc đổi theme.
- Không nhân đôi nội dung trang chỉ để phục vụ hai theme.
- Tải ảnh tối riêng có chọn lọc; tránh tăng dung lượng tải trang không cần thiết.
- Không làm mất metadata, nội dung SEO hoặc các tính năng server-rendering hiện có của Next.js.
- Thử theme trong trạng thái loading, error, empty, success, disabled và modal mở.

## 9. Testing matrix

| Khu vực | Light | Dark | System | Mobile | Keyboard |
|---|---|---|---|---|---|
| Homepage | ☐ | ☐ | ☐ | ☐ | ☐ |
| Catalog/filter | ☐ | ☐ | ☐ | ☐ | ☐ |
| Product detail/variants | ☐ | ☐ | ☐ | ☐ | ☐ |
| Reviews/realtime | ☐ | ☐ | ☐ | ☐ | ☐ |
| Cart | ☐ | ☐ | ☐ | ☐ | ☐ |
| Checkout/discount | ☐ | ☐ | ☐ | ☐ | ☐ |
| Account/order tracking | ☐ | ☐ | ☐ | ☐ | ☐ |
| Admin dashboard/charts | ☐ | ☐ | ☐ | ☐ | ☐ |
| Admin tables/forms | ☐ | ☐ | ☐ | ☐ | ☐ |

### Acceptance criteria

- [ ] Light là mặc định khi chưa có lựa chọn trước đó.
- [ ] Chuyển Light/Dark/System hoạt động và giữ sau refresh.
- [ ] System mode cập nhật theo OS.
- [ ] Không có hydration warning hoặc flash theme đáng kể.
- [ ] Các semantic tokens được sử dụng nhất quán, không hardcode text/background sai theme.
- [ ] Tất cả thành phần shadcn/ui có hover, focus, disabled, loading và error states đúng.
- [ ] Ảnh sản phẩm và logo không bị đảo màu sai.
- [ ] Chart, tooltip, table và modal trong admin dễ đọc.
- [ ] Checkout, cart, review và admin logic hoạt động y hệt Light Mode.
- [ ] Responsive và keyboard accessibility được kiểm tra.
- [ ] Dark Mode không thêm chức năng ngoài phạm vi đề bài.

## 10. Lộ trình triển khai

**Phase A — Foundation (nên làm ngay):** Thiết kế semantic tokens ngay từ đầu, hạn chế hardcode màu; thiết lập theme provider nhưng giữ Light làm mặc định.

**Phase B — Rubric first:** Hoàn thành chức năng chính của AEVO theo tài liệu đồ án: storefront, catalog, product, cart, checkout, account, admin, realtime và Docker Compose.

**Phase C — Dark storefront:** Áp dụng Dark Mode cho homepage, catalog, product detail, cart, checkout và account.

**Phase D — Dark admin:** Tối ưu AEVO Control, charts, tables, filters, dialogs.

**Phase E — QA:** Kiểm tra toàn bộ testing matrix, accessibility, responsive và performance. Chỉ coi Dark Mode hoàn thành khi tất cả các luồng nghiệp vụ vẫn hoạt động đúng.

## 11. Prompt cho Claude Code / Cursor / Codex

```text
Read AEVO_Premium_Minimal_Concept.md and darkmode.md completely.
Treat the original NodeJS Final Project specification as the highest-priority
source of requirements.

Implement AEVO Adaptive Theme with Light as the default and Dark/System as
optional user-selectable modes.

Stack:
- Next.js JavaScript (JS/JSX), not TypeScript
- Tailwind CSS + shadcn/ui (tsx: false)
- next-themes for theme selection and persistence
- Lucide React and Motion

Requirements:
1. Preserve the AEVO Premium Minimal brand identity and existing layouts.
2. Introduce semantic design tokens for backgrounds, surfaces, text, borders,
   buttons, focus and status colors. Do not hardcode light-only colors.
3. Support Light, Dark and System, with Light as the default for new visitors.
4. Persist the selected theme and avoid hydration mismatch/theme flashes.
5. Apply the theme consistently to the storefront, cart, checkout, account,
   order tracking and permitted admin pages.
6. Theme charts, tables, tooltips, dialogs, form controls and all UI states.
7. Do not invert product photos or third-party brand logos.
8. Ensure keyboard access, focus-visible, reduced motion and adequate contrast.
9. Do not modify business logic or add admin features beyond the rubric.
10. Keep Docker Compose and the existing Node.js architecture unchanged.
11. Test both themes across desktop, tablet and mobile.

First audit the existing component/theme setup. Then propose a minimal change
plan, implement shared tokens/provider/switcher, migrate components, and run
functional and visual regression checks.
```

---

## 12. Kết luận

**AEVO Adaptive Theme = Light mặc định + Dark tùy chọn + System tùy chọn.** Đây là lớp mở rộng giao diện dựa trên `AEVO_Premium_Minimal_Concept.md`, không thay thế concept gốc và không tạo thêm nghiệp vụ. Ưu tiên hoàn thành rubric trước; sử dụng semantic tokens ngay từ đầu để triển khai Dark Mode sau mà không phải viết lại UI.
