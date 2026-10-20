# AEVO — Premium Computing, Refined.

> **Brand Identity · Design System · E-commerce UX/UI · Node.js Architecture**  
> **Concept:** AEVO Light — Premium Minimal  
> **Tagline:** Technology, refined.  
> **Brand promise:** Exceptional hardware. Effortless experience.

## Mục tiêu dự án

Xây dựng **AEVO** thành một website thương mại điện tử chuyên **máy tính và linh kiện PC**, có trải nghiệm mua sắm cao cấp, tối giản và nhất quán.

Ba mục tiêu:

1. **Premium Minimal:** Giao diện sáng, typography tinh tế, ảnh sản phẩm là trọng tâm.
2. **Functional E-commerce:** Hoàn chỉnh các luồng mua hàng, tài khoản, sản phẩm, đơn hàng và quản trị.
3. **Academic Compliance:** Tuân thủ tài liệu **NodeJS Final Project**, đặc biệt các chức năng bắt buộc và giới hạn chức năng admin.

> **Nguyên tắc ưu tiên:** Tài liệu đồ án gốc là nguồn yêu cầu bắt buộc. Concept AEVO là định hướng branding, UX/UI và kiến trúc. Nếu xung đột, ưu tiên tài liệu của giảng viên.
>
> Những nội dung về màu sắc, typography, UI component, tên route, cấu trúc thư mục và lựa chọn công nghệ bên dưới là **đề xuất thiết kế/kỹ thuật**, không phải trích nguyên văn đề bài.

---

# 1. Brand Identity

## 1.1. Brand foundation

| Thành phần | Giá trị |
|---|---|
| Brand name | AEVO |
| Product name | AEVO Store |
| Admin interface name | AEVO Control |
| Primary logo | `aevo.` (lowercase wordmark) |
| Tagline | Technology, refined. |
| Brand promise | Exceptional hardware. Effortless experience. |
| Brand personality | Precise, Quiet, Modern, Confident, Premium |
| Positioning | Premium hardware studio / curated computing essentials |
| Visual direction | Light Minimal, editorial commerce, monochrome |
| Alternative headlines | Computing, redefined. / Less noise. More power. |
| Supporting copy | Discover the essentials that move you forward. |

AEVO không nên mang cảm giác một cửa hàng gaming truyền thống với quá nhiều hiệu ứng RGB, banner giảm giá và màu sắc cạnh tranh nhau. Thương hiệu tập trung vào chất lượng, hiệu năng, tính rõ ràng và trải nghiệm mua sắm.

## 1.2. Logo

- Primary wordmark: **`aevo.`**.
- Phiên bản sáng: chữ `#171717` trên nền `#F5F5F3` hoặc `#FFFFFF`.
- Phiên bản tối: chữ `#FFFFFF` trên nền `#171717`.
- Logo ưu tiên kiểu chữ đơn giản, cân đối, khoảng trắng rộng.
- Không thêm gradient, hiệu ứng phát sáng hoặc icon phức tạp vào logo chính.
- Dòng phụ có thể sử dụng `PREMIUM COMPUTING` hoặc `COMPUTING, REDEFINED.`.

## 1.3. Brand voice và microcopy

| Ngữ cảnh | Nội dung |
|---|---|
| Homepage hero | Technology, refined. |
| Hero description | Discover exceptional hardware for everything you create. |
| New products | Discover what's next. |
| Best sellers | Chosen for performance. |
| Product catalog | Find your next essential. |
| Product detail | Built for your workflow. |
| Cart | Your selection. |
| Checkout | Complete your order. |
| Order success | Your order is confirmed. |
| Alternative campaign | Less noise. More power. |
| Secondary campaign | Designed for what's next. |

Tone of voice: ngắn gọn, điềm tĩnh, rõ ràng, có tính chuyên nghiệp. Tránh các thông điệp như “SIÊU SALE”, “GIÁ SỐC”, viết hoa toàn bộ và nhiều dấu chấm than.

Ngôn ngữ UI có thể là tiếng Anh để phù hợp branding; nội dung sản phẩm và thông báo nghiệp vụ cần dễ hiểu với người dùng tại Việt Nam.

---

# 2. Design System — AEVO UI

## 2.1. Color palette

| Token | Hex | Sử dụng |
|---|---|---|
| Canvas | `#F5F5F3` | Nền trang |
| Surface | `#FFFFFF` | Card, panel, modal |
| Ink | `#171717` | Chữ chính, primary CTA |
| Secondary | `#737373` | Chữ phụ |
| Border | `#E5E5E3` | Divider, border |
| Sage | `#52665C` | Accent tinh tế |
| Titanium | `#A3A7AD` | Chi tiết phụ |
| Obsidian | `#171717` | Nền tối |
| Porcelain | `#F5F5F3` | Nền sáng |

**Quy tắc phân bổ:** 80% trắng/trắng ngà, 15% đen/xám/border, 5% accent hoặc màu trạng thái.

- Primary CTA: nền `#171717`, chữ `#FFFFFF`.
- Secondary CTA: nền trắng hoặc transparent, viền trung tính.
- Accent Sage chỉ dùng có chủ đích; không thay primary CTA.
- Trạng thái: xanh lá cho thành công, đỏ cho lỗi, hổ phách cho cảnh báo.
- Đảm bảo độ tương phản chữ và các trạng thái focus rõ ràng.

## 2.2. Typography

- **Headings / Display:** Geist.
- **Body:** Inter.
- **Technical labels / Metadata:** Geist Mono (tùy chọn).
- Headline ngắn, nhiều khoảng trắng, không dùng quá nhiều font weights.

| Token | Desktop | Mobile |
|---|---|---|
| Display | 64–80px | 38–44px |
| H1 | 48px | 32px |
| H2 | 36px | 28px |
| H3 | 24px | 22px |
| Body | 16px | 16px |
| Small | 14px | 14px |
| Caption | 12px | 12px |

Ví dụ:

- Display: **Less, but better.**
- Heading: **Discover exceptional hardware.**
- Body: *Thoughtfully selected computing essentials, designed to elevate every workflow.*
- Label: `SERIES 01 — PERFORMANCE COMPUTING`

## 2.3. Spacing và layout tokens

| Token | Giá trị |
|---|---|
| Spacing scale | 4 / 8 / 12 / 16 / 24 / 32 / 48 / 64 / 96px |
| Content max-width | 1440px |
| Desktop side padding | 48–64px |
| Tablet side padding | 32px |
| Mobile side padding | 16–20px |
| Button height | 44–48px |
| Input height | 48px |
| Card radius | 12–16px |
| Modal radius | 20px |
| Header height | 72px |
| Border | `1px solid #E5E5E3` |

## 2.4. Component library

Các component dùng xuyên suốt storefront và admin:

- `Button`: primary, secondary, text; loading, disabled, hover, focus-visible.
- `Input`, `Textarea`, `Select`, `Checkbox`, `Radio`, `Switch` (nếu cần).
- `SearchInput`, `FilterDrawer`, `SortDropdown`, `Pagination`.
- `ProductCard`, `ProductGallery`, `VariantSelector`, `QuantityStepper`.
- `CartDrawer`, `CartItem`, `OrderSummary`.
- `Modal`, `Dialog`, `Toast`, `Badge`, `Tooltip`.
- `Table`, `DataTable`, `DateRangePicker`, `KpiCard`, `ChartCard`.
- `Skeleton`, `EmptyState`, `ErrorState`, `ConfirmationDialog`.

Các nút và form cần có trạng thái hover, focus-visible, loading, disabled và error. Vùng tương tác phải đủ lớn trên mobile.

## 2.5. Motion system

| Tương tác | Thời gian | Hiệu ứng |
|---|---|---|
| Button hover | 150ms | Color transition |
| Card hover | 200ms | Shadow / subtle lift |
| Dropdown | 180ms | Fade + translate |
| Cart drawer | 280ms | Slide |
| Modal | 220ms | Fade + scale |
| Page content | 300ms | Subtle reveal |

- Không sử dụng animation nặng gây chậm thao tác mua hàng.
- Hỗ trợ `prefers-reduced-motion`.
- Motion phải hỗ trợ UX, không làm lu mờ thông tin sản phẩm.

---

# 3. Homepage — Trang chủ

## 3.1. Visual direction

- Header sáng, tối giản, logo `aevo.`.
- Hero toàn chiều ngang với ảnh studio chất lượng cao của PC/laptop/monitor.
- Headline lớn: **Technology, refined.**
- Subtitle: *Discover exceptional hardware for everything you create.*
- Primary CTA: **Explore collection →**.
- Nền trắng ngà, ít đường viền, nhiều khoảng trắng.
- Product cards với ảnh đồng nhất, tên ngắn, giá rõ ràng.
- Không dùng slider chuyển quá nhanh hoặc banner quảng cáo dày đặc.

## 3.2. Cấu trúc section

| Section | Nội dung | Hành vi |
|---|---|---|
| Header | Logo, navigation, search, account, cart | Sticky |
| Hero | Product image, headline, CTA | Link đến catalog/sản phẩm |
| New Arrivals | Sản phẩm mới | Grid + pagination |
| Best Sellers | Sản phẩm bán chạy | Grid + pagination |
| Laptops | Danh mục laptop | Xem danh sách |
| Components | Danh mục linh kiện | Xem danh sách |
| Monitors | Danh mục màn hình | Xem danh sách |
| Footer | Navigation, thông tin thương hiệu | Internal links |

**Đối chiếu đề bài:** Trang chủ phải có **New Products, Best Sellers và ít nhất 3 danh mục khác**. Các danh sách sản phẩm phải có pagination, kể cả khi chỉ có một trang.

Chỉ bán máy tính và linh kiện trong phạm vi đề bài; không thêm điện thoại hoặc sản phẩm ngoài phạm vi.

## 3.3. Product card

Một `ProductCard` gồm:

1. Ảnh sản phẩm trên nền trung tính.
2. Category label (ví dụ `LAPTOPS`).
3. Tên sản phẩm.
4. Giá hiện tại.
5. Mô tả ngắn nếu phù hợp.
6. CTA **View product →** hoặc hành động mua theo yêu cầu UX.
7. Badge `NEW ARRIVAL` khi áp dụng.

Dữ liệu mẫu minh họa:

- Product: `Premium Laptop`.
- Price: `29.990.000₫`.
- Category: `LAPTOPS`.

Tên và giá trên là mock data, không phải danh mục sản phẩm thực tế.

---

# 4. Product Catalog — Danh mục sản phẩm

## 4.1. Desktop layout

- Breadcrumb: `HOME / SHOP`.
- Heading: **Explore hardware.**
- Subtitle: *Find the right tools for your workflow.*
- Sidebar bên trái: filter.
- Grid sản phẩm bên phải: 3–4 cột desktop.
- Thanh trên grid: số lượng sản phẩm và sort dropdown.
- Pagination dưới grid.

## 4.2. Filtering và sorting

| Chức năng | UX đề xuất | Yêu cầu |
|---|---|---|
| Search | Search input | Tìm theo từ khóa |
| Category | Sidebar | Lọc theo danh mục |
| Brand | Multi-select | Lọc theo thương hiệu |
| Price | Min / Max | Lọc khoảng giá |
| Third filter | Rating hoặc thuộc tính | Tối thiểu 3 tiêu chí lọc |
| Sort | Dropdown | A–Z, Z–A, giá tăng, giá giảm |
| Pagination | Page numbers | Hiện cả khi chỉ có một trang |
| View mode | Grid mặc định | Grid hoặc list |

Ví dụ URL:

```text
/products?brand=asus&minPrice=10000000&maxPrice=30000000&sort=price_asc&page=2
```

Trạng thái filter, search, sort, page nên đồng bộ với URL để reload hoặc chia sẻ liên kết vẫn giữ trạng thái.

## 4.3. Mobile UX

- Sidebar filter chuyển thành drawer.
- Có **Apply Filters** và **Reset Filters**.
- Grid 2 cột.
- Sort và filter dễ truy cập, không chiếm quá nhiều không gian.
- Có loading, empty result, error và pagination states.

---

# 5. Product Detail — Chi tiết sản phẩm

## 5.1. Bố cục

**Desktop:** gallery lớn bên trái, product information bên phải.  
**Mobile:** gallery phía trên, thông tin sản phẩm phía dưới.

Các thành phần:

- Breadcrumb.
- Product category / brand.
- Product title.
- Rating summary.
- Price.
- Short description.
- Variant selector.
- Stock availability theo variant.
- Quantity stepper.
- Primary CTA **Add to cart**.
- Product specifications.
- Reviews / comments.

## 5.2. Nội dung bắt buộc

- Tên, giá, thương hiệu.
- Mô tả ngắn tối thiểu **5 dòng**.
- Ít nhất **3 ảnh minh họa**.
- Danh sách variants; hướng đến **ít nhất 2 variants/sản phẩm** để đạt điểm tối đa.
- Tồn kho **độc lập** cho từng variant.
- Bình luận và đánh giá sao.

Khi đổi variant, UI phải cập nhật đúng giá, thuộc tính và tồn kho; backend phải xác nhận lại khi thêm vào giỏ và checkout.

## 5.3. Comments, ratings và realtime

| Hành động | Chưa đăng nhập | Đã đăng nhập |
|---|---|---|
| Xem bình luận | Có | Có |
| Viết bình luận | Có | Có |
| Đánh giá sao | Không | Có |
| Đánh giá không cần mua | Không | Có |
| Nhận cập nhật realtime | Có | Có |

Đề xuất dùng **Socket.IO** để cập nhật bình luận và rating realtime, không cần reload trang.

---

# 6. Shopping Cart — Giỏ hàng

## 6.1. Visual direction

- Heading: **Your selection.**
- Danh sách cart items bên trái.
- Order summary bên phải (desktop).
- Một cột trên mobile.
- Mỗi item có ảnh, tên, variant, giá, quantity stepper và remove.
- Summary hiển thị subtotal, shipping, tax, discount và total.
- CTA: **Checkout →**.

Cart drawer có thể hỗ trợ xem nhanh, nhưng trang `/cart` vẫn phải đầy đủ chức năng.

## 6.2. Hành vi bắt buộc

- Thêm đúng sản phẩm và variant.
- Tăng/giảm số lượng không reload.
- Xóa item không reload.
- Cập nhật subtotal, tax, shipping và total.
- Không cho vượt tồn kho.
- Hỗ trợ cart của khách chưa đăng nhập.
- Backend xác thực lại giá và tồn kho khi checkout.

Ví dụ mockup (chỉ minh họa):

| Sản phẩm | Giá |
|---|---:|
| Performance Laptop | 29.990.000₫ |
| Graphics Card | 18.990.000₫ |
| Subtotal | 48.980.000₫ |

Logic thuế, vận chuyển, giảm giá và tổng thanh toán phải được tính chính xác trong ứng dụng thực tế.

---

# 7. Checkout — Thanh toán

## 7.1. UI flow

Các bước:

1. **Information** — Thông tin liên hệ, người nhận.
2. **Shipping** — Địa chỉ giao hàng, vận chuyển.
3. **Payment** — Phương thức thanh toán, mã giảm giá.
4. **Review** — Kiểm tra đơn trước khi xác nhận.
5. **Order Success** — Thông báo thanh toán/đặt hàng thành công.

Heading: **Checkout.**  
CTA từng bước: **Continue to shipping →**, **Continue to payment →**, **Place order →**.

## 7.2. Guest checkout

Luồng đề xuất:

```text
Customer checkout
        |
        v
    Logged in?
      /     \
    Yes      No
     |        |
     v        v
Pre-fill   Enter guest
address    information
      \      /
       v    v
Shipping -> Discount -> Payment
                  |
                  v
         Successful payment
                  |
                  v
Create/link account -> Save order -> Send email
                  |
                  v
          Order success screen
```

- Khách chưa đăng nhập **vẫn được checkout**.
- Với khách chưa có tài khoản, hệ thống tự tạo tài khoản sau khi mua thành công theo đề bài.
- Không gửi mật khẩu dạng plaintext qua email.
- Không hiển thị thành công trước khi backend xác nhận giao dịch và tạo đơn hàng hợp lệ.

## 7.3. Discount codes

| Thuộc tính | Quy tắc |
|---|---|
| Format | 5 ký tự chữ và số |
| Người tạo | Administrator |
| Expiration | Không có ngày hết hạn |
| Usage limit | Admin thiết lập, tối đa 10 lượt |
| Validation | Kiểm tra trước thanh toán |
| Discount effect | Hiển thị mức giảm trước thanh toán |

Backend cần bảo đảm không vượt giới hạn lượt dùng khi có nhiều checkout đồng thời.

## 7.4. Loyalty points

Theo ví dụ trong đề:

- Đơn hàng **1.000.000₫** được cộng **100 điểm**.
- **100 điểm** tương đương **100.000₫**.
- Điểm có thể sử dụng ở đơn kế tiếp, không có hạn chế bổ sung.

**Lưu ý:** Cách diễn đạt quy đổi điểm trong tài liệu có thể chưa hoàn toàn nhất quán với cách hiểu tỷ lệ 10%; khi triển khai cần bám sát ví dụ và xác nhận giảng viên nếu cần, không tự sửa yêu cầu.

## 7.5. Order success

Trang `/checkout/success`:

- Order number.
- Ngày/giờ mua.
- Sản phẩm, variant, số lượng.
- Subtotal, discount, shipping, tax, total.
- Địa chỉ giao hàng.
- Trạng thái đơn.
- Thông báo email xác nhận.

---

# 8. Customer Account — Tài khoản khách hàng

## 8.1. Visual direction

Heading: **My account.**  
Subtitle: *Manage your personal information and orders.*

Desktop: sidebar; mobile: tabs hoặc menu.

## 8.2. Chức năng

| Module | Chức năng |
|---|---|
| Authentication | Đăng ký, đăng nhập, social login |
| Profile | Xem/chỉnh sửa thông tin |
| Password | Đổi và khôi phục mật khẩu |
| Addresses | Nhiều địa chỉ giao hàng |
| Order history | Xem đơn hàng |
| Order details | Xem sản phẩm, số lượng, giá |
| Order tracking | Trạng thái và lịch sử trạng thái |
| Loyalty | Xem và sử dụng điểm |

Khi đăng ký, đề bài chỉ yêu cầu **email, họ tên, địa chỉ giao hàng**; không tự ý bắt người dùng nhập thêm trường không cần thiết ở bước ban đầu.

## 8.3. Order tracking

Ví dụ UI:

```text
Order #AEVO-00124                       Shipping

● Shipping       20/10/2026 09:30
│
● Confirmed      19/10/2026 15:20
│
● Pending        19/10/2026 14:10
```

- Trạng thái mới nhất ở trên.
- Thời gian lấy từ dữ liệu thực tế, không tự tạo.
- Order detail có danh sách sản phẩm, giá, địa chỉ và lịch sử trạng thái.

---

# 9. Admin Dashboard — AEVO Control

> **AEVO Control** chỉ là tên giao diện quản trị, **không phải một module hoặc tính năng mới**.

## 9.1. Admin visual direction

- Cùng màu sắc và typography AEVO.
- Sidebar gọn.
- KPI cards rõ ràng.
- Data tables dễ quét.
- Biểu đồ tối giản, ít màu.
- Date filters và trạng thái được trình bày trực quan.
- Không thêm module ngoài phạm vi đề bài.

## 9.2. Admin navigation

| Navigation | Chức năng |
|---|---|
| Dashboard | Simple + Advanced Dashboard |
| Products | Sản phẩm, variant, tồn kho, danh mục |
| Users | Xem, cập nhật, khóa tài khoản |
| Orders | Danh sách, chi tiết, cập nhật trạng thái |
| Discounts | Danh sách, tạo mã giảm giá |

**Không bổ sung** CMS, blog, nhân sự, phân quyền nhiều cấp, ticket support, marketing automation hoặc module quản trị ngoài yêu cầu.

## 9.3. Simple Dashboard

KPI và báo cáo:

- Tổng số người dùng.
- Người dùng mới.
- Tổng số đơn hàng.
- Doanh thu.
- Sản phẩm bán chạy.

KPI card dùng cho số liệu tổng quan; biểu đồ dùng cho xu hướng và sản phẩm bán chạy.

## 9.4. Advanced Dashboard

- Mặc định theo **năm**.
- Có chế độ **quý, tháng, tuần**.
- Chọn **start date** và **end date**.
- Theo dõi số đơn hàng, doanh thu, lợi nhuận.
- So sánh doanh thu, lợi nhuận, số lượng và loại sản phẩm đã bán theo các khoảng thời gian.

Ví dụ layout:

```text
AEVO CONTROL / Advanced Analytics

[ Year ] [ Quarter ] [ Month ] [ Week ]

[Revenue] [Orders] [Customers] [Profit]

+--------------------------------------+
| Revenue / Profit chart               |
|                                      |
+--------------------------------------+

[Top-selling products] [Product mix]
```

Số liệu dashboard phải tính từ database. Để báo cáo lợi nhuận lịch sử chính xác, có thể lưu giá vốn tại thời điểm đặt hàng; đây là dữ liệu hỗ trợ yêu cầu báo cáo, không phải module admin mới.

## 9.5. Product Management

Danh sách sản phẩm:

| Column | Nội dung |
|---|---|
| Product | Thumbnail + tên |
| Category | Danh mục |
| Brand | Thương hiệu |
| Variants | Số variant |
| Inventory | Tồn kho |
| Price | Giá |
| Actions | Edit / Delete |

Form tạo/chỉnh sửa có product info, images, category, brand và danh sách variants. Mỗi variant có SKU, thuộc tính, giá và tồn kho riêng.

## 9.6. Order Management

- Đơn mới nhất trước.
- Pagination khoảng **20 đơn/trang**.
- Filters: **Today, Yesterday, This Week, This Month, Custom Date Range**.
- Hiển thị trạng thái đơn rõ ràng.
- Xem người mua, thời gian, sản phẩm, số lượng, tổng tiền, mã giảm giá.
- Cập nhật trạng thái và lưu lịch sử thay đổi.

## 9.7. Discount Management

- Danh sách mã.
- Ngày tạo.
- Giá trị giảm.
- Lượt đã dùng / lượt tối đa.
- Các đơn hàng đã sử dụng mã.
- Tạo mã mới.

Admin không được đặt giới hạn lớn hơn 10 lượt/mã; không cần trường ngày hết hạn.

---

# 10. Responsive Design

| Thành phần | Desktop | Mobile |
|---|---|---|
| Header | Full navigation | Logo, search, cart, menu |
| Product grid | 3–4 cột | 2 cột |
| Filters | Sidebar | Drawer |
| Product detail | Gallery + info | Gallery trên, info dưới |
| Cart | Items + summary | Một cột |
| Checkout | Form + summary | Một cột |
| Admin | Sidebar cố định | Collapsible navigation |
| Dashboard | 4 KPI cards | 1–2 KPI cards |

Breakpoints đề xuất:

- **Desktop:** `>= 1024px`.
- **Tablet:** `768–1023px`.
- **Mobile:** `<= 767px`.

Tránh animation nặng, bảng quá rộng và nút quá nhỏ. Admin tables có thể cuộn ngang nếu cần, nhưng dữ liệu quan trọng phải dễ truy cập.

---

# 11. Technology Stack và Architecture

## 11.1. Đối chiếu công nghệ

| Công nghệ AEVO | Vai trò | Đánh giá so với đề bài |
|---|---|---|
| Node.js | Backend runtime | Phù hợp |
| Express.js | REST API | Phù hợp |
| Next.js | Frontend framework | Phù hợp theo định hướng đã đối chiếu |
| JavaScript | Ngôn ngữ | Nên dùng để bám sát đề |
| Tailwind CSS | Styling | Phù hợp |
| shadcn/ui | UI components | Phù hợp |
| PostgreSQL | Database | Phù hợp |
| Prisma | ORM | Phù hợp |
| Redis | Cache / shared realtime adapter | Phù hợp |
| Socket.IO | Realtime | Phù hợp |
| Docker Compose | Deployment | Phù hợp |
| TypeScript | Ngôn ngữ thay thế | **Không dùng nếu chưa được giảng viên xác nhận** |

Đề bài có câu: *“The Final Project must be implemented using a Nodejs project using the Javascript programming language.”*

Vì vậy, đề xuất chốt:

- Next.js với **`.js` / `.jsx`**.
- Express.js với **JavaScript**.
- PostgreSQL + Prisma.
- Socket.IO.
- Redis khi cần cho realtime/scaling.
- Docker Compose.

## 11.2. Architecture

Kiến trúc khởi đầu: **modular monolith** với khả năng horizontal scaling.

```text
                 ┌─────────────────────┐
                 │ Next.js Frontend    │
                 │ Store / Account /   │
                 │ Admin UI            │
                 └──────────┬──────────┘
                            │
                            ▼
                 ┌─────────────────────┐
                 │ Reverse Proxy /     │
                 │ Load Balancer       │
                 └──────────┬──────────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
             ┌────────────┐  ┌────────────┐
             │ Express #1 │  │ Express #2 │
             │ Stateless  │  │ Stateless  │
             └──────┬─────┘  └──────┬─────┘
                    └───────┬───────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
             ┌────────────┐  ┌────────────┐
             │ PostgreSQL │  │ Redis      │
             │ Persistent │  │ Cache /    │
             │ data       │  │ Socket.IO  │
             └────────────┘  └────────────┘
```

**Horizontal scaling:** Chỉ có Redis và Docker Compose chưa đủ. Cần chứng minh nhiều instance backend, load balancing và xử lý stateless thực tế.

**Microservices:** Không bắt buộc cho phần chính; là hướng bonus riêng. Không nên chuyển sang microservices khi chức năng chính chưa hoàn chỉnh.

## 11.3. Project structure

```text
aevo/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── (store)/
│   │   │   ├── (auth)/
│   │   │   ├── (account)/
│   │   │   └── admin/
│   │   ├── components/
│   │   │   ├── ui/
│   │   │   ├── layout/
│   │   │   ├── product/
│   │   │   ├── cart/
│   │   │   ├── checkout/
│   │   │   └── admin/
│   │   ├── lib/
│   │   └── styles/
│   └── api/
│       ├── src/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── users/
│       │   │   ├── products/
│       │   │   ├── categories/
│       │   │   ├── cart/
│       │   │   ├── orders/
│       │   │   ├── discounts/
│       │   │   ├── reviews/
│       │   │   ├── loyalty/
│       │   │   └── analytics/
│       │   ├── middleware/
│       │   ├── config/
│       │   └── server.js
│       └── prisma/
├── packages/
│   └── shared/
├── docker/
├── docker-compose.yml
└── README.md
```

Các module chỉ là cách tổ chức code theo nghiệp vụ, không đồng nghĩa thêm chức năng ngoài đề.

## 11.4. Core data model

| Entity | Vai trò |
|---|---|
| User | Khách hàng và administrator |
| OAuthAccount | Liên kết social login |
| Address | Nhiều địa chỉ giao hàng |
| Category | Danh mục |
| Product | Thông tin sản phẩm |
| ProductVariant | Thuộc tính, giá, tồn kho |
| ProductImage | Hình ảnh |
| ProductTag | Phân loại |
| Cart / CartItem | Giỏ hàng |
| Order / OrderItem | Đơn hàng |
| OrderStatusHistory | Lịch sử trạng thái |
| Payment | Giao dịch |
| Discount | Mã giảm giá |
| DiscountUsage | Lịch sử dùng mã |
| Review | Bình luận và đánh giá |
| LoyaltyTransaction | Giao dịch điểm |

Yêu cầu kỹ thuật cần chú ý: trừ tồn kho an toàn khi có nhiều giao dịch, chống checkout trùng, lưu giá tại thời điểm mua, xác thực quyền, bảo mật thông tin và bảo đảm tính nhất quán của đơn hàng.

## 11.5. Docker Compose

Yêu cầu triển khai:

```bash
docker compose up -d
```

- Frontend, backend, database và các thành phần liên quan chạy trong container phù hợp.
- Không yêu cầu giảng viên chạy `npm install` thủ công.
- Cấu hình migrations, startup order, health checks và demo data phù hợp để ứng dụng khởi chạy được.
- Horizontal scaling cần được triển khai và chứng minh riêng nếu muốn đạt tiêu chí đó.

---

# 12. Sitemap và URL Structure

| Trang | URL |
|---|---|
| Homepage | `/` |
| Catalog | `/products` |
| Category | `/products?category=laptops` |
| Product Detail | `/products/[slug]` |
| Cart | `/cart` |
| Checkout | `/checkout` |
| Order Success | `/checkout/success` |
| Login | `/login` |
| Register | `/register` |
| Password Recovery | `/forgot-password` |
| Profile | `/account/profile` |
| Addresses | `/account/addresses` |
| Order History | `/account/orders` |
| Order Detail | `/account/orders/[id]` |
| Admin Dashboard | `/admin` |
| Admin Products | `/admin/products` |
| Admin Users | `/admin/users` |
| Admin Orders | `/admin/orders` |
| Admin Order Detail | `/admin/orders/[id]` |
| Admin Discounts | `/admin/discounts` |

Các route là đề xuất tổ chức điều hướng, không phải URL bắt buộc từ đề bài.

---

# 13. Requirement Compliance Matrix

| Nhóm | Giải pháp AEVO | Ưu tiên |
|---|---|---|
| Landing Page | New, Best Sellers, 3+ categories | Bắt buộc |
| Authentication | Register, login, social login | Bắt buộc |
| User Profile | Profile, password, addresses | Bắt buộc |
| Catalog | Search, filter, sort, pagination | Bắt buộc |
| Product Detail | 3+ ảnh, 5+ dòng mô tả, variants | Bắt buộc |
| Reviews | Guest comments, authenticated ratings | Bắt buộc |
| Cart | Cập nhật số lượng/giá không reload | Bắt buộc |
| Checkout | Multi-step, guest checkout | Bắt buộc |
| Discounts | 5 ký tự, tối đa 10 lượt | Bắt buộc |
| Orders | Email, history, tracking | Bắt buộc |
| Loyalty | Quy tắc tích điểm theo đề | Bắt buộc |
| Admin | Chỉ tính năng được cho phép | Bắt buộc |
| Analytics | Simple + Advanced Dashboard | Bắt buộc |
| Responsive | Desktop, tablet, mobile | Tiêu chí chấm điểm |
| Horizontal Scaling | Stateless + load balancing | Tiêu chí chấm điểm |
| Deployment | Hosting hoặc Docker Compose | Bắt buộc |
| CI/CD | GitHub Actions | Bonus |
| Microservices | 3+ services và async messaging | Bonus |
| AI | Chatbot, image search, sentiment | Bonus |
| Elasticsearch | Product search | Bonus |

## 13.1. Những điều tuyệt đối không bỏ qua

1. **Không bán điện thoại hoặc sản phẩm ngoài phạm vi máy tính/linh kiện.** Theo lưu ý đã đối chiếu từ đề, vi phạm có thể khiến đồ án bị 0 điểm.
2. **Không thêm tính năng admin** ngoài phạm vi giảng viên cho phép.
3. **Không bỏ pagination**, kể cả danh sách chỉ có một trang.
4. **Không bỏ variants và tồn kho độc lập**.
5. **Không bỏ guest checkout**.
6. **Không xem Redis/Docker là bằng chứng đủ cho horizontal scaling**.
7. **Không yêu cầu giảng viên chạy lệnh thủ công** ngoài quy trình khởi động đã quy định.
8. **Không tự thay JavaScript bằng TypeScript** nếu chưa được xác nhận.

---

# 14. Implementation Roadmap cho Coding Agent

## Phase 1 — Foundation

- Thiết lập monorepo.
- Next.js (JavaScript), Express.js, PostgreSQL, Prisma.
- Docker Compose.
- Design tokens.
- UI primitives và layout components.
- Authentication foundation và validation.

## Phase 2 — Product Experience

- Homepage.
- Catalog.
- Search, filters, sorting, pagination.
- Product detail.
- Product variants và tồn kho.
- Comments, ratings, realtime.

## Phase 3 — Customer & Commerce

- Authentication và social login.
- Profile, password, addresses.
- Cart.
- Checkout và guest checkout.
- Discount codes.
- Payment.
- Order history, tracking, confirmation email.
- Loyalty points.

## Phase 4 — AEVO Control

- Simple Dashboard.
- Advanced Dashboard.
- Product Management.
- User Management.
- Order Management.
- Discount Management.

## Phase 5 — Quality & Deployment

- Responsive QA.
- Accessibility.
- Validation và security.
- Horizontal scaling.
- Docker Compose.
- Demo data.
- README và hướng dẫn chạy.

## Phase 6 — Optional Bonus

Chỉ thực hiện bonus trong đề bài khi các chức năng chính đã ổn định: CI/CD, microservices, AI, Elasticsearch (nếu phù hợp phạm vi và thời gian).

---

# 15. UI/UX Acceptance Checklist

- [ ] Giao diện đúng hệ màu AEVO Light.
- [ ] Typography, spacing, border radius nhất quán.
- [ ] Responsive desktop, tablet và mobile.
- [ ] Có loading, empty, error và success states phù hợp.
- [ ] Buttons và forms hoạt động thực tế.
- [ ] Dữ liệu sản phẩm, giá, tồn kho lấy từ backend.
- [ ] Kiểm tra quyền truy cập và validation.
- [ ] Không có tính năng ngoài phạm vi đề bài.
- [ ] Các tính năng đáp ứng đúng rubric.
- [ ] Pagination hoạt động kể cả một trang.
- [ ] Variant có tồn kho độc lập.
- [ ] Guest checkout hoàn chỉnh.
- [ ] Order tracking có lịch sử trạng thái.
- [ ] Discount và loyalty đúng quy tắc.
- [ ] Admin giới hạn đúng module được phép.
- [ ] Docker Compose khởi động được bằng lệnh yêu cầu.
- [ ] Horizontal scaling được kiểm chứng nếu triển khai tiêu chí này.

---

# 16. Brand Direction Cuối Cùng

**AEVO — Premium Computing, Refined.**

- **Brand:** `aevo.`
- **Style:** Light Premium Minimal / Editorial Commerce.
- **Core palette:** Porcelain `#F5F5F3`, Obsidian `#171717`, White `#FFFFFF`, Sage `#52665C`.
- **Typography:** Geist + Inter.
- **Campaign headline:** **Less noise. More power.**
- **Supporting line:** *Discover the essentials that move you forward.*
- **Storefront:** Tối giản, chú trọng ảnh sản phẩm và trải nghiệm mua sắm.
- **Admin:** AEVO Control, dashboard rõ ràng và quản trị đúng phạm vi.
- **Engineering:** JavaScript, Next.js, Node.js/Express, PostgreSQL/Prisma, Socket.IO, Docker Compose.
- **Priority:** Đáp ứng đầy đủ yêu cầu đề bài trước, tối ưu UI/UX và bonus sau.

## Chỉ dẫn dành cho AI Coding Agent

1. **Đọc toàn bộ tài liệu NodeJS Final Project gốc trước khi code.**
2. Xem tài liệu này là **design & implementation concept**, không thay thế đề bài.
3. Không tự thêm, bỏ, sửa yêu cầu nghiệp vụ.
4. Ưu tiên chức năng đúng rubric, sau đó mới polish giao diện.
5. Sử dụng JavaScript `.js` / `.jsx` trừ khi giảng viên cho phép khác.
6. Giữ nhất quán design tokens, component API và trạng thái UX.
7. Chỉ tạo module admin được đề bài cho phép.
8. Không dùng dữ liệu mock trong các luồng nghiệp vụ hoàn chỉnh; mock chỉ dành cho phát triển/giao diện minh họa.
9. Đảm bảo tính chính xác của giá, tồn kho, discount, loyalty và order status ở backend.
10. Bảo đảm có thể chạy bằng Docker Compose theo quy định.

**Quy tắc cuối cùng:** Nếu concept này mâu thuẫn với yêu cầu của giảng viên, hãy tuân theo **tài liệu đồ án gốc** và chỉ điều chỉnh cách thể hiện UI/UX cho phù hợp.


---

# 17. Frontend UI Libraries, Components, Blocks & Assets

## 17.1. Nguyên tắc: không code mọi thứ từ đầu

AEVO không cần tự viết từ đầu toàn bộ nút bấm, input, dialog, dropdown, checkbox, bảng dữ liệu, icon hoặc các layout phổ biến.

Có ba nhóm cần phân biệt:

1. **UI Components:** Button, Input, Dialog, Dropdown, Checkbox, Table, Tabs, Pagination, Sidebar…
2. **Website Blocks:** Navbar, Hero, Product Card, Product Gallery, Checkout Layout, Footer, Dashboard Layout…
3. **Assets:** Icon, font, hình sản phẩm, illustration, animation…

**Chiến lược:** Sử dụng component library chất lượng cao làm nền tảng, kết hợp các layout block có sẵn và tùy biến theo design system AEVO. Không sao chép nguyên một template e-commerce rồi cố gắng sửa toàn bộ. Các nghiệp vụ theo rubric vẫn phải được triển khai thực sự.

## 17.2. Recommended frontend libraries

| Nhu cầu | Thư viện / nguồn | Vai trò | Website |
|---|---|---|---|
| UI components | **shadcn/ui** | Button, Input, Dialog, Sheet, Select, Sidebar, Pagination, Data Table, Chart | https://ui.shadcn.com/ |
| Accessible primitives | **Radix UI** | Keyboard navigation, focus management, interaction primitives | https://www.radix-ui.com/ |
| Styling | **Tailwind CSS** | Utility-first CSS, tùy biến token AEVO | https://tailwindcss.com/ |
| Icons | **Lucide React** | Icon nét mảnh, nhất quán | https://lucide.dev/ |
| Animation | **Motion** | Hover, transition, reveal, drawer animation | https://motion.dev/ |
| E-commerce blocks | **Tailwind Plus** | Product listing, detail, cart, checkout, order history layouts | https://tailwindcss.com/plus/ui-blocks/ecommerce |
| Dashboard blocks | **shadcn/ui Blocks** | Sidebar, KPI, chart, table, dashboard layout | https://ui.shadcn.com/blocks |
| Charts | **Recharts** | Biểu đồ dashboard | https://recharts.org/ |

**Lưu ý:** Tailwind Plus là thư viện thương mại trả phí. shadcn/ui cho phép đưa mã nguồn component vào dự án và tùy chỉnh theo branding. Không cần cài tất cả thư viện nếu chúng trùng chức năng.

## 17.3. Phân công thư viện theo trang

| Trang | Có thể tái sử dụng | Phần phải tự triển khai / kết nối backend |
|---|---|---|
| Homepage | Header, Hero, Product Card, Footer | New Arrivals, Best Sellers, category data |
| Catalog | Sidebar, Checkbox, Slider, Pagination, Dropdown | Search, filter, sort, URL state, API |
| Product Detail | Gallery, Tabs, Select, Button | Variant, giá, tồn kho, review realtime |
| Cart | Drawer, Quantity Stepper, Order Summary | Cart state, tính tổng, kiểm tra tồn |
| Checkout | Input, Form, Stepper | Guest checkout, payment, discount, loyalty |
| Account | Tabs, Card, Table, Form | Authentication, order tracking, addresses |
| Admin | Sidebar, Data Table, Chart | Analytics, product/user/order/discount management |

**Không đánh đồng giao diện có sẵn với chức năng hoàn chỉnh:** Button “Add to cart” chỉ được xem là hoàn thành khi thực sự thêm đúng sản phẩm/variant vào giỏ; biểu đồ chỉ hoàn thành khi sử dụng dữ liệu nghiệp vụ thật.

## 17.4. Cách tùy biến component cho AEVO

- Primary Button: nền `#171717`, chữ trắng, radius 8–12px, height 44–48px.
- Secondary Button: nền trắng hoặc transparent, border `#E5E5E3`.
- Inputs: nền trắng, border nhẹ, focus rõ ràng, height 48px.
- Cards: nền trắng hoặc `#F5F5F3`, radius 12–16px, shadow rất nhẹ.
- Dialog/Sheet: typography Geist/Inter, khoảng trắng rộng, animation ngắn.
- Icons: Lucide React, stroke mảnh, kích thước và màu đồng nhất.
- Charts: ít màu, label rõ ràng, tooltip tối giản.
- Product images: ảnh thật hoặc ảnh có quyền sử dụng, không dùng ảnh minh họa không liên quan đến sản phẩm.
- Luôn hỗ trợ hover, focus-visible, loading, disabled, empty, error, success và reduced-motion.

## 17.5. Component inventory đề xuất

### Shared / Design System

```text
components/
├── ui/
│   ├── button.jsx
│   ├── input.jsx
│   ├── textarea.jsx
│   ├── select.jsx
│   ├── checkbox.jsx
│   ├── dialog.jsx
│   ├── sheet.jsx
│   ├── badge.jsx
│   ├── tabs.jsx
│   ├── table.jsx
│   ├── pagination.jsx
│   ├── skeleton.jsx
│   └── chart.jsx
├── layout/
│   ├── site-header.jsx
│   ├── site-footer.jsx
│   └── page-container.jsx
├── product/
│   ├── product-card.jsx
│   ├── product-grid.jsx
│   ├── product-gallery.jsx
│   ├── product-filters.jsx
│   ├── variant-selector.jsx
│   └── quantity-stepper.jsx
├── cart/
│   ├── cart-drawer.jsx
│   ├── cart-item.jsx
│   └── order-summary.jsx
├── checkout/
│   ├── checkout-steps.jsx
│   ├── shipping-form.jsx
│   └── payment-form.jsx
└── admin/
    ├── admin-sidebar.jsx
    ├── kpi-card.jsx
    ├── analytics-chart.jsx
    └── data-table.jsx
```

Đây là tên file gợi ý, không phải yêu cầu bắt buộc. Chỉ tạo các component cần dùng, tránh trùng lặp với shadcn/ui.

## 17.6. Cài đặt shadcn/ui cho Next.js JavaScript

Trong thư mục frontend:

```bash
npx shadcn@latest init
```

Cấu hình `components.json` cần đặt:

```json
{
  "tsx": false
}
```

Giá trị `tsx: false` cho phép sử dụng component dưới dạng JavaScript thay vì TypeScript. Giữ các cấu hình khác mà CLI đã sinh; không thay cả file `components.json` bằng ví dụ rút gọn ở trên.

Thêm các component thực sự cần thiết:

```bash
npx shadcn@latest add button input card dialog sheet
npx shadcn@latest add select checkbox tabs badge
npx shadcn@latest add table pagination sidebar
npx shadcn@latest add skeleton chart
```

Với thông báo toast, chọn component/toast solution hiện được shadcn/ui hỗ trợ và kiểm tra hướng dẫn phiên bản đang dùng; không phụ thuộc vào một tên component đã bị thay đổi hoặc ngừng hỗ trợ.

## 17.7. Asset sourcing

| Asset | Định hướng |
|---|---|
| Icons | Lucide React |
| Fonts | Geist, Inter, Geist Mono tùy chọn |
| Product photos | Ảnh chính hãng hoặc nguồn được phép sử dụng |
| Hero photography | Studio-style, ánh sáng mềm, nền trắng ngà |
| Illustrations | Chỉ dùng khi thực sự cần; ưu tiên ảnh sản phẩm |
| Animations | Motion + CSS transitions |
| Charts | Recharts kết nối dữ liệu backend |

Không lấy ngẫu nhiên ảnh có bản quyền để dùng như ảnh sản phẩm thật. Trong giai đoạn mockup có thể dùng ảnh minh họa hợp lệ; khi hoàn thiện phải gắn đúng ảnh với từng sản phẩm.

## 17.8. Prompt triển khai cho Claude Code / Cursor / Codex

```text
Build the AEVO Premium Minimal frontend using Next.js with JavaScript
(JS/JSX), Tailwind CSS, shadcn/ui, Lucide React, and Motion.

Requirements:
- Use shadcn/ui as the primary component foundation.
- Reuse established, accessible UI components instead of recreating
  primitives from scratch.
- Follow the AEVO brand design system from
  AEVO_Premium_Minimal_Concept.md.
- Use the light theme with #F5F5F3 backgrounds, #FFFFFF surfaces,
  and #171717 primary text.
- Create reusable components for the header, product cards, product
  gallery, variant selector, cart, checkout forms, and admin dashboard.
- Customize all components to maintain a consistent Premium Minimal
  aesthetic.
- Use subtle animations and support reduced-motion preferences.
- Implement responsive layouts for desktop, tablet, and mobile.
- Use JavaScript, not TypeScript.
- Do not add features outside the original NodeJS Final Project
  specification.
- Treat the original project specification as the authoritative source
  whenever there is a conflict.
- Connect functional components to real backend APIs; do not mistake
  static UI demos for completed features.
```

## 17.9. Frontend implementation priorities

1. Cài Tailwind CSS và shadcn/ui, xác nhận cấu hình JavaScript.
2. Thiết lập AEVO design tokens, typography, spacing và button variants.
3. Tạo shared layout: Header, Footer, Container, Navigation.
4. Tái sử dụng UI primitives cho catalog, product detail, cart và checkout.
5. Dùng dashboard blocks phù hợp để dựng AEVO Control, chỉ gồm module admin được phép.
6. Kết nối API thực tế, validation, loading/error/empty states và quyền truy cập.
7. Kiểm thử responsive, accessibility, realtime và các trường hợp nghiệp vụ.
8. Chỉ polish animation sau khi luồng chức năng đã đúng rubric.

**Kết luận:** Stack frontend ưu tiên của AEVO là **shadcn/ui + Tailwind CSS + Lucide React + Motion**, kết hợp shadcn Blocks cho dashboard và Tailwind Plus E-commerce nếu có ngân sách. Sử dụng component có sẵn để tiết kiệm thời gian, nhưng toàn bộ logic nghiệp vụ vẫn phải tuân thủ tài liệu đồ án gốc.
