# AEVO E-commerce E2E Test Plan

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
| Tech Stack | Next.js, Express.js, PostgreSQL, Prisma, Socket.IO, Docker |
| Base Requirements | `requirement.md` - NodeJS Final Project |
| Team | 2-3 members |

---

# PHASE 1: Foundation Setup (Tuần 1)

## Mục tiêu Phase 1
- Thiết lập môi trường development
- Database schema hoàn chỉnh
- Xác thực cơ bản (auth) hoạt động

---

## Task 1.1: Database Setup & Migration

### Checklist
- [x] Cài đặt PostgreSQL (local hoặc Docker)
- [x] Cấu hình `.env` với `DATABASE_URL`
- [x] Chạy `prisma generate`
- [x] Chạy `prisma db push` tạo tables
- [x] Tạo seed data mẫu (categories, products, admin user)
- [x] Xác thực database connection

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|-----------------|
| DB-01 | Kết nối database thành công | 1. Chạy `npx prisma studio` | Hiển thị schema với 20 tables |
| DB-02 | Seed data được tạo | 1. Chạy seed script<br>2. Query categories | Có ít nhất 3 categories (laptops, components, monitors) |
| DB-03 | Admin user được tạo | 1. Query user với email admin | User có role = ADMIN |

### Test Command
```bash
cd apps/api
npm run db:generate
npm run db:push
npm run db:seed
```

---

## Task 1.2: API Server Basic Setup

### Checklist
- [x] Express server khởi động không lỗi
- [x] CORS được cấu hình đúng
- [x] Health check endpoint `/health` hoạt động
- [x] Socket.IO connection hoạt động
- [x] Error handler middleware hoạt động

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| API-01 | Server khởi động | 1. Chạy `npm run dev`<br>2. Check port 3001 | Server chạy, không lỗi |
| API-02 | Health check | 1. GET `/health` | Return `{ status: "ok" }` |
| API-03 | CORS hoạt động | 1. Request từ frontend origin | Không bị blocked |

### Test Command
```bash
curl http://localhost:3001/health
```

---

## Task 1.3: Authentication - Register & Login

### Checklist
- [x] API register tạo user mới
- [x] API login trả về JWT token
- [x] Token được lưu trong cookie httpOnly
- [x] Validation: email hợp lệ, password >= 6 ký tự
- [x] Error handling: email đã tồn tại, sai password

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| AUTH-01 | Register thành công | POST `/api/auth/register` với email mới | Return 201, user data + token |
| AUTH-02 | Register email trùng | POST `/api/auth/register` với email đã có | Return 400, error message |
| AUTH-03 | Login thành công | POST `/api/auth/login` với đúng credentials | Return 200, user data + token |
| AUTH-04 | Login sai password | POST `/api/auth/login` với password sai | Return 401, "Invalid email or password" |
| AUTH-05 | Token được lưu cookie | 1. Login<br>2. Check response headers | Có Set-Cookie với token |
| AUTH-06 | Logout xóa cookie | POST `/api/auth/logout` | Cookie bị xóa |

### Test Command
```bash
# Register
curl -X POST http://localhost:3001/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456","fullName":"Test User"}'

# Login
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"123456"}'
```

---

## Task 1.4: Authentication - Profile & Password

### Checklist
- [x] GET `/api/auth/profile` - lấy thông tin user
- [x] PUT `/api/auth/profile` - cập nhật fullName
- [x] PUT `/api/auth/password` - đổi password (cần current password)
- [x] POST `/api/auth/forgot-password` - gửi link reset
- [x] POST `/api/auth/reset-password` - reset với token

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| AUTH-07 | Get profile (đã login) | GET `/api/auth/profile` với token | Return user data |
| AUTH-08 | Get profile (chưa login) | GET `/api/auth/profile` không token | Return 401 |
| AUTH-09 | Update profile | PUT `/api/auth/profile` với fullName mới | Return updated user |
| AUTH-10 | Change password đúng | PUT `/api/auth/password` với current đúng | Return success |
| AUTH-11 | Change password sai | PUT `/api/auth/password` với current sai | Return 400 |

---

## Task 1.5: Social Login Setup (Google)

### Checklist
- [x] Cấu hình Google OAuth credentials
- [x] GET `/api/auth/google` - redirect to Google
- [x] GET `/api/auth/google/callback` - callback handler
- [x] Tạo user mới nếu chưa có
- [x] Link OAuth account với existing user

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| AUTH-12 | Google OAuth redirect | GET `/api/auth/google` | Redirect to Google login page |
| AUTH-13 | Google OAuth callback | 1. Complete Google login<br>2. Redirect về | User created/linked, redirect to frontend |
| AUTH-14 | Facebook login (không dùng) | GET `/api/auth/facebook` | 503 - không cấu hình provider |

---

## Task 1.6: Frontend - Project Setup

### Checklist
- [x] Next.js dev server chạy không lỗi
- [x] Tailwind CSS được cấu hình
- [x] AEVO design tokens trong `tailwind.config.js`
- [x] Layout cơ bản: Header, Footer
- [x] Homepage render không lỗi

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| FE-01 | Frontend khởi động | 1. Chạy `npm run dev:web`<br>2. Visit http://localhost:3000 | Page load không lỗi |
| FE-02 | Design tokens hoạt động | 1. Inspect element<br>2. Check background color | Background = #F5F5F3 |
| FE-03 | Header hiển thị | 1. View homepage<br>2. Check header elements | Có logo "aevo.", nav links |

---

## Phase 1 Completion Criteria

| Criteria                                                   | Status |
| ---------------------------------------------------------- | ------ |
| Database hoạt động với seed data                           | ✅      |
| API server chạy ổn định                                    | ✅      |
| Authentication (register/login/profile/password) hoạt động | ✅      |
| Frontend basic setup hoàn chỉnh                            | ✅      |
| Tất cả test cases pass                                     | ✅      |

---

# PHASE 2: Product Experience (Tuần 2)

## Mục tiêu Phase 2
- Hiển thị sản phẩm (catalog, detail)
- Tìm kiếm, lọc, sắp xếp
- Reviews và ratings với realtime

---

## Task 2.1: Product API - List & Filter

### Checklist
- [x] GET `/api/products` - lấy danh sách sản phẩm
- [x] Filter theo category
- [x] Filter theo brand (multi-select)
- [x] Filter theo price (min/max)
- [x] Search theo tên/description
- [x] Sort: newest, price_asc, price_desc, name_asc, name_desc, best-selling
- [x] Pagination (page, limit)
- [x] Include: category, variants, primary image

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| PROD-01 | List products | GET `/api/products` | Return products với pagination |
| PROD-02 | Filter category | GET `/api/products?category=laptops` | Chỉ return laptops |
| PROD-03 | Filter brand | GET `/api/products?brand=asus,lenovo` | Chỉ return asus/lenovo |
| PROD-04 | Filter price | GET `/api/products?minPrice=10000000&maxPrice=30000000` | Price trong khoảng |
| PROD-05 | Search | GET `/api/products?search=laptop` | Name/description chứa "laptop" |
| PROD-06 | Sort price asc | GET `/api/products?sort=price_asc` | Giá tăng dần |
| PROD-07 | Sort name desc | GET `/api/products?sort=name_desc` | Name giảm dần |
| PROD-08 | Pagination | GET `/api/products?page=2&limit=12` | Đúng page 2, 12 items |
| PROD-09 | Pagination (single page) | GET `/api/products?page=1` | Vẫn hiển thị pagination info |

### Test Command
```bash
# Test filter + sort + pagination
curl "http://localhost:3001/api/products?category=laptops&brand=asus&minPrice=10000000&maxPrice=50000000&sort=price_asc&page=1&limit=12"
```

---

## Task 2.2: Product API - Detail & Variants

### Checklist
- [x] GET `/api/products/:id` - chi tiết sản phẩm
- [x] GET `/api/products/slug/:slug` - chi tiết theo slug
- [x] Include all variants
- [x] Include all images (sắp xếp theo position)
- [x] Include reviews
- [x] Tính average rating

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| PROD-10 | Get by ID | GET `/api/products/{id}` | Return full product details |
| PROD-11 | Get by slug | GET `/api/products/slug/macbook-pro-m3` | Return product |
| PROD-12 | Variants hiển thị | 1. Get product detail<br>2. Check variants array | Có ít nhất 1 variant |
| PROD-13 | Images hiển thị | 1. Get product detail<br>2. Check images | Có ít nhất 3 images (theo requirement) |
| PROD-14 | Reviews included | 1. Get product detail<br>2. Check reviews | Reviews được include |

---

## Task 2.3: Category API

### Checklist
- [x] GET `/api/categories` - danh sách categories
- [x] GET `/api/categories/:id` - category với products
- [x] Admin: POST, PUT, DELETE categories

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| CAT-01 | List categories | GET `/api/categories` | Return all active categories |
| CAT-02 | Category detail | GET `/api/categories/{id}` | Return category với products |

---

## Task 2.4: Homepage - Product Display

### Checklist
- [x] Homepage render với static elements
- [x] Gọi API New Arrivals
- [x] Gọi API Best Sellers
- [x] Gọi API Categories
- [x] Product cards hiển thị đúng (image, name, price)
- [x] Category cards hiển thị

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| FE-04 | Homepage load | 1. Visit `/`<br>2. Check console | Không có lỗi API |
| FE-05 | New Arrivals section | 1. Check New Arrivals area<br>2. Verify products displayed | Có sản phẩm, đúng format |
| FE-06 | Best Sellers section | 1. Check Best Sellers area<br>2. Verify products displayed | Có sản phẩm |
| FE-07 | Category cards | 1. Check category section<br>2. Click category | Navigate đến filter |

---

## Task 2.5: Product Catalog Page

### Checklist
- [x] Page `/products` hiển thị grid
- [x] Sidebar filters (category, brand, price)
- [x] Sort dropdown
- [x] Product grid 3-4 cột (desktop)
- [x] Pagination component
- [x] URL sync với filter/sort/page
- [x] Mobile: filter drawer thay sidebar

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| FE-08 | Catalog page load | Visit `/products` | Hiển thị products |
| FE-09 | Filter hoạt động | 1. Click "Laptops" filter<br>2. Check products | Chỉ hiển thị laptops |
| FE-10 | Sort hoạt động | 1. Select "Price: Low to High"<br>2. Check products | Sorted đúng |
| FE-11 | Pagination click | 1. Click page 2<br>2. Check URL | URL = ?page=2 |
| FE-12 | URL share | 1. Copy URL với filters<br>2. Open new tab | Giữ nguyên filters |

---

## Task 2.6: Product Detail Page

### Checklist
- [x] Page `/products/[slug]` render
- [x] Image gallery (3+ images)
- [x] Product info: name, brand, price
- [x] Variant selector
- [x] Stock availability theo variant
- [x] Quantity stepper
- [x] Add to cart button
- [x] Product specifications
- [x] Description >= 5 dòng

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| FE-13 | Detail page load | Visit `/products/macbook-pro-m3` | Hiển thị product detail |
| FE-14 | Image gallery | 1. Check images<br>2. Click thumbnail | Image thay đổi |
| FE-15 | Variant selection | 1. Select different variant<br>2. Check price | Price update theo variant |
| FE-16 | Stock check | 1. Select variant<br>2. Check stock display | Hiển thị đúng stock |
| FE-17 | Add to cart | 1. Select variant<br>2. Click "Add to cart"<br>3. Check cart | Item added thành công |
| FE-18 | Description length | 1. Check description<br>2. Count lines | >= 5 lines |

---

## Task 2.7: Reviews - Comments & Ratings

### Checklist
- [x] GET `/api/reviews/product/:productId` - lấy reviews
- [x] POST `/api/reviews` - tạo review
- [x] Guest: chỉ comment (không rating)
- [x] Auth user: comment + rating (1-5 stars)
- [x] Socket.IO: realtime new review
- [x] Display rating distribution

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| REV-01 | Get reviews | GET `/api/reviews/product/{id}` | Return reviews + rating stats |
| REV-02 | Guest comment | POST `/api/reviews` không token, có guestName | Comment được tạo |
| REV-03 | Auth rating | POST `/api/reviews` với token và rating | Rating được lưu |
| REV-04 | Guest rating fail | POST `/api/reviews` không token, có rating | Return 401 |
| REV-05 | Rating validation | POST với rating=6 | Return 400 (1-5 only) |
| REV-06 | Realtime update | 1. Open 2 browser tabs cùng product<br>2. Add review tab 1 | Tab 2 tự update |

---

## Phase 2 Completion Criteria

| Criteria | Status |
|----------|--------|
| Product API (list, filter, sort, pagination) hoạt động | ✅ |
| Product Detail với variants, images hoàn chỉnh | ✅ |
| Homepage hiển thị đúng | ✅ |
| Catalog page với filters/sort/pagination | ✅ |
| Reviews với realtime | ✅ |
| Tất cả test cases pass | ✅ |
| **PUSH TO REMOTE** | ✅ |

---

# PHASE 3: Customer & Commerce (Tuần 3)

## Mục tiêu Phase 3
- Shopping cart hoàn chỉnh
- Checkout process
- Discount codes
- Order management
- Loyalty points

---

## Task 3.1: Shopping Cart - API

### Checklist
- [x] GET `/api/cart` - lấy cart
- [x] POST `/api/cart/items` - thêm item
- [x] PUT `/api/cart/items/:itemId` - cập nhật quantity
- [x] DELETE `/api/cart/items/:itemId` - xóa item
- [x] Guest cart (session-based)
- [x] User cart (logged in)
- [x] Kiểm tra inventory trước add
- [x] Real-time subtotal calculation

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| CART-01 | Get cart (guest) | GET `/api/cart` | Return empty cart, sessionId created |
| CART-02 | Get cart (logged in) | GET `/api/cart` với token | Return user cart |
| CART-03 | Add item | POST `/api/cart/items` với variantId | Item added, inventory decreased |
| CART-04 | Add item out of stock | POST với quantity > inventory | Return 400 error |
| CART-05 | Update quantity | PUT `/api/cart/items/{id}` với quantity=3 | Quantity updated |
| CART-06 | Remove item | DELETE `/api/cart/items/{id}` | Item removed |
| CART-07 | Cart subtotal | 1. Add 2 items<br>2. Get cart | Subtotal = sum(price * qty) |

---

## Task 3.2: Shopping Cart - Frontend

### Checklist
- [x] Cart icon hiển thị số lượng
- [x] Cart drawer/page hiển thị items
- [x] Update quantity không reload (AJAX)
- [x] Remove item không reload
- [x] Subtotal/total update real-time
- [x] Empty cart state
- [x] Guest cart persist (session)

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| FE-19 | Add to cart | 1. Click "Add to cart"<br>2. Check cart icon | Icon hiển thị số lượng mới |
| FE-20 | Cart page | Visit `/cart` | Hiển thị items đúng |
| FE-21 | Update quantity | 1. Click +/-<br>2. Check total | Total update, không reload |
| FE-22 | Remove item | 1. Click remove<br>2. Check item gone | Item removed, total update |
| FE-23 | Empty cart | Remove all items | Hiển thị empty state |

---

## Task 3.3: Checkout - Process

### Checklist
- [x] Multi-step checkout UI
- [x] Step 1: Information (email, name, phone)
- [x] Step 2: Shipping address
- [x] Step 3: Shipping method
- [x] Step 4: Payment method
- [x] Step 5: Review
- [x] Guest checkout available
- [x] Pre-fill address nếu logged in
- [x] Apply discount code
- [x] Apply loyalty points
- [x] Order success screen

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| CHECK-01 | Checkout page load | Visit `/checkout` | Hiển thị step 1 |
| CHECK-02 | Guest checkout | 1. Fill guest info<br>2. Continue | Tiến tới step 2 |
| CHECK-03 | Logged in pre-fill | 1. Login<br>2. Go checkout | Address pre-filled |
| CHECK-04 | Discount apply | 1. Enter valid code<br>2. Apply | Discount applied, total reduced |
| CHECK-05 | Discount invalid | 1. Enter invalid code<br>2. Apply | Error message |
| CHECK-06 | Loyalty points | 1. Enter points<br>2. Apply | Points deducted from total |
| CHECK-07 | Place order | 1. Complete all steps<br>2. Click "Place order" | Order created, redirect success |
| CHECK-08 | Order success | 1. After checkout<br>2. Check page | Hiển thị order number, details |

### Test Command
```bash
# Validate discount
curl http://localhost:3001/api/discounts/validate/SAVE10
```

---

## Task 3.4: Discount Codes

### Checklist
- [x] Admin: POST `/api/discounts` - tạo code
- [x] Code format: 5 ký tự alphanumeric
- [x] Max uses: <= 10 (theo requirement)
- [x] No expiration date
- [x] GET `/api/discounts/validate/:code` - kiểm tra
- [x] Apply during checkout
- [x] Track usage count

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| DISC-01 | Create discount | POST `/api/discounts` với code="TEST1" | Code created |
| DISC-02 | Invalid format | POST với code="AB" | Return 400 (cần 5 chars) |
| DISC-03 | Max uses > 10 | POST với maxUses=20 | Return 400 (max 10) |
| DISC-04 | Validate valid code | GET `/api/discounts/validate/TEST1` | Return discount info |
| DISC-05 | Validate invalid code | GET `/api/discounts/validate/INVALID` | Return 404 |
| DISC-06 | Validate exhausted | 1. Use code 10 lần<br>2. Validate | Return 400 (exhausted) |
| DISC-07 | Checkout apply | 1. Enter valid code<br>2. Complete checkout | Discount applied to order |

---

## Task 3.5: Order Management

### Checklist
- [x] POST `/api/orders` - tạo order
- [x] Inventory trừ sau order
- [x] GET `/api/orders` - order history (logged in)
- [x] GET `/api/orders/:id` - chi tiết order
- [x] Order status: PENDING → CONFIRMED → SHIPPING → DELIVERED
- [x] Status history với timestamps
- [x] Order confirmation email

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| ORDER-01 | Create order | POST `/api/orders` | Order created, inventory decreased |
| ORDER-02 | Inventory check | 1. Create order<br>2. Check variant inventory | Inventory giảm đúng số lượng |
| ORDER-03 | Order history | GET `/api/orders` với token | Return user's orders |
| ORDER-04 | Order detail | GET `/api/orders/{id}` | Return full order details |
| ORDER-05 | Status history | 1. Get order detail<br>2. Check statusHistory | Có history với timestamps |
| ORDER-06 | Guest order | 1. Checkout as guest<br>2. Save order number | Có thể lookup bằng order number |

---

## Task 3.6: User Profile - Addresses

### Checklist
- [x] GET `/api/users/addresses` - danh sách addresses
- [x] POST `/api/users/addresses` - thêm address
- [x] PUT `/api/users/addresses/:id` - cập nhật
- [x] DELETE `/api/users/addresses/:id` - xóa
- [x] Set default address
- [x] Nhiều địa chỉ (requirement: >1)

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| ADDR-01 | List addresses | GET `/api/users/addresses` | Return user's addresses |
| ADDR-02 | Add address | POST với address data | Address created |
| ADDR-03 | Update address | PUT `/api/users/addresses/{id}` | Address updated |
| ADDR-04 | Delete address | DELETE `/api/users/addresses/{id}` | Address deleted |
| ADDR-05 | Multiple addresses | 1. Add 2 addresses<br>2. List | Có 2 addresses |

---

## Task 3.7: Loyalty Points System

### Checklist
- [x] Tích điểm: 10% mỗi order (1M = 100 điểm)
- [x] Đổi điểm: 100 điểm = 100,000 VND
- [x] GET `/api/loyalty/points` - xem điểm
- [x] GET `/api/loyalty/history` - lịch sử
- [x] Áp dụng points trong checkout
- [x] Points không có hạn chế thêm

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| LOYAL-01 | Earn points | 1. Place order 1M VND<br>2. Check points | +100 points |
| LOYAL-02 | View points | GET `/api/loyalty/points` | Return current points |
| LOYAL-03 | Redeem points | 1. Có 100 points<br>2. Checkout với 100 points | -100, giảm 100k |
| LOYAL-04 | History | GET `/api/loyalty/history` | Có transaction history |

### Test Command
```bash
# Theo requirement:
# 1,000,000 VND → 100 points
# 100 points = 100,000 VND
```

---

## Phase 3 Completion Criteria

| Criteria | Status |
|----------|--------|
| Cart API + Frontend hoạt động | ✅ |
| Checkout process hoàn chỉnh | ✅ |
| Discount codes (5 chars, max 10) | ✅ |
| Order creation + tracking | ✅ |
| Multiple addresses | ✅ |
| Loyalty points system | ✅ |
| Tất cả test cases pass | ✅ |
| **PUSH TO REMOTE** | ✅ |

---

# PHASE 4: Admin Dashboard (Tuần 4)

## Mục tiêu Phase 4
- Simple Dashboard với KPIs
- Advanced Dashboard với analytics
- Product, User, Order, Discount management

---

## Task 4.1: Simple Dashboard

### Checklist
- [x] GET `/api/analytics/simple` - KPIs
- [x] Total users
- [x] New users (30 days)
- [x] Total orders
- [x] Revenue (non-cancelled orders)
- [x] Best selling products
- [x] Recent orders

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| DASH-01 | Get simple dashboard | GET `/api/analytics/simple` | Return KPIs |
| DASH-02 | Total users count | Check response | Đúng số user trong DB |
| DASH-03 | Revenue calculation | 1. Tạo orders<br>2. Check dashboard | Revenue = sum(totalAmount) |

---

## Task 4.2: Advanced Dashboard

### Checklist
- [x] GET `/api/analytics/advanced`
- [x] Default: yearly view
- [x] Period: quarter, month, week, custom
- [x] Date range: startDate, endDate
- [x] Metrics: order count, revenue, profit
- [x] Revenue comparison (current vs previous period)
- [x] Revenue by month chart data
- [x] Top products

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| DASH-04 | Yearly default | GET `/api/analytics/advanced?period=year` | Data for current year |
| DASH-05 | Quarterly | GET `/api/analytics/advanced?period=quarter` | Current quarter data |
| DASH-06 | Monthly | GET `/api/analytics/advanced?period=month` | Current month data |
| DASH-07 | Custom range | GET `?period=custom&startDate=2024-01-01&endDate=2024-03-31` | Custom range data |
| DASH-08 | Profit calculation | Check response | Profit = revenue * 0.2 (estimate) |

---

## Task 4.3: Admin - Product Management

### Checklist
- [x] Admin: CRUD products
- [x] Create với variants
- [x] Create với images
- [x] Update product info
- [x] Add/remove variants
- [x] Update inventory
- [x] Delete (soft delete - isActive=false)

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| ADMIN-01 | Create product | POST `/api/products` as admin | Product created |
| ADMIN-02 | Create with variants | POST với variants array | Variants created |
| ADMIN-03 | Create with images | POST với images array | Images created |
| ADMIN-04 | Update product | PUT `/api/products/{id}` | Product updated |
| ADMIN-05 | Update inventory | PUT variant inventory | Inventory updated |
| ADMIN-06 | Delete product | DELETE `/api/products/{id}` | isActive = false |

---

## Task 4.4: Admin - User Management

### Checklist
- [ ] GET `/api/users` - list users
- [ ] Search users
- [ ] GET `/api/users/:id` - user detail
- [ ] PUT `/api/users/:id/ban` - ban user
- [ ] PUT `/api/users/:id/unban` - unban user
- [ ] Pagination

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| ADMIN-07 | List users | GET `/api/users` | Return paginated users |
| ADMIN-08 | Search user | GET `/api/users?search=john` | Filter by name/email |
| ADMIN-09 | Ban user | PUT `/api/users/{id}/ban` | isActive = false |
| ADMIN-10 | Unban user | PUT `/api/users/{id}/unban` | isActive = true |

---

## Task 4.5: Admin - Order Management

### Checklist
- [ ] GET `/api/orders/admin/all` - list orders
- [ ] Filter by status
- [ ] Filter by date range
- [ ] Pagination (20 per page)
- [ ] GET `/api/orders/:id` - order detail
- [ ] PUT `/api/orders/:id/status` - update status
- [ ] Status history update

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| ADMIN-11 | List orders | GET `/api/orders/admin/all` | Return paginated orders |
| ADMIN-12 | Filter by status | GET `?status=PENDING` | Chỉ PENDING orders |
| ADMIN-13 | Filter by date | GET `?startDate=2024-01-01&endDate=2024-01-31` | Orders trong range |
| ADMIN-14 | Update status | PUT `/api/orders/{id}/status` với CONFIRMED | Status = CONFIRMED |
| ADMIN-15 | Status history | Check order detail | Có new status in history |

---

## Task 4.6: Admin - Discount Management

### Checklist
- [ ] GET `/api/discounts` - list discounts
- [ ] View usage count
- [ ] View orders used
- [ ] Create discount (admin)
- [ ] Update discount
- [ ] Delete (deactivate)

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| ADMIN-16 | List discounts | GET `/api/discounts` | Return all discounts |
| ADMIN-17 | View usage | Check discount detail | usedCount displayed |
| ADMIN-18 | Create discount | POST `/api/discounts` | Discount created |
| ADMIN-19 | Deactivate | DELETE `/api/discounts/{id}` | isActive = false |

---

## Task 4.7: Admin Frontend Pages

### Checklist
- [ ] `/admin` - Dashboard overview
- [ ] `/admin/products` - Product list
- [ ] `/admin/products/new` - Create product form
- [ ] `/admin/users` - User list
- [ ] `/admin/orders` - Order list
- [ ] `/admin/orders/[id]` - Order detail + update status
- [ ] `/admin/discounts` - Discount list + create

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| FE-24 | Admin dashboard | Visit `/admin` | KPIs displayed |
| FE-25 | Product management | Visit `/admin/products` | Product list displayed |
| FE-26 | Create product | 1. Fill form<br>2. Submit | Product created |
| FE-27 | User management | Visit `/admin/users` | User list displayed |
| FE-28 | Order management | Visit `/admin/orders` | Order list displayed |
| FE-29 | Update order status | 1. Select order<br>2. Change status | Status updated |

---

## Phase 4 Completion Criteria

| Criteria | Status |
|----------|--------|
| Simple Dashboard hoạt động | ⬜ |
| Advanced Dashboard hoạt động | ⬜ |
| Admin Product Management | ⬜ |
| Admin User Management | ⬜ |
| Admin Order Management | ⬜ |
| Admin Discount Management | ⬜ |
| Admin Frontend pages | ⬜ |
| Tất cả test cases pass | ⬜ |
| **PUSH TO REMOTE** | ⬜ |

---

# PHASE 5: Quality & Deployment (Tuần 5)

## Mục tiêu Phase 5
- Responsive testing
- Security validation
- Docker deployment
- Final testing

---

## Task 5.1: Responsive Design Testing

### Checklist
- [ ] Desktop: 1024px+ (full layout)
- [ ] Tablet: 768px-1023px (adjusted layout)
- [ ] Mobile: <768px (stacked layout)
- [ ] Header responsive
- [ ] Product grid responsive
- [ ] Cart responsive
- [ ] Checkout responsive
- [ ] Admin responsive

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| RESP-01 | Desktop product grid | 1. Resize to 1200px<br>2. Check grid | 3-4 columns |
| RESP-02 | Tablet product grid | 1. Resize to 900px<br>2. Check grid | 2-3 columns |
| RESP-03 | Mobile product grid | 1. Resize to 375px<br>2. Check grid | 1-2 columns |
| RESP-04 | Mobile menu | 1. Resize to mobile<br>2. Click menu | Menu opens |
| RESP-05 | Mobile filters | 1. Mobile view<br>2. Click filter | Filter drawer opens |

---

## Task 5.2: Security & Validation

### Checklist
- [ ] JWT token validation
- [ ] Role-based access (admin vs customer)
- [ ] Input validation (register, checkout)
- [ ] SQL injection prevention (Prisma handles)
- [ ] XSS prevention (React handles)
- [ ] Password not returned in responses

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| SEC-01 | Admin route protection | 1. Login as user<br>2. Access /admin | Return 403 |
| SEC-02 | Invalid token | Request với invalid token | Return 401 |
| SEC-03 | Password in response | Login response | Password not in response |

---

## Task 5.3: Docker Compose Setup

### Checklist
- [ ] `docker-compose.yml` đầy đủ
- [ ] Frontend service
- [ ] Backend service
- [ ] PostgreSQL service
- [ ] Redis service
- [ ] Health checks
- [ ] Volume persistence
- [ ] `docker compose up -d` chạy thành công

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| DOCKER-01 | Compose up | 1. Run `docker compose up -d`<br>2. Check containers | All 4 services running |
| DOCKER-02 | Frontend accessible | Visit http://localhost:3000 | Page loads |
| DOCKER-03 | API accessible | Visit http://localhost:3001/health | Returns ok |
| DOCKER-04 | Database connected | Check API logs | Connected to postgres |
| DOCKER-05 | Compose down | Run `docker compose down` | All containers stopped |

---

## Task 5.4: Final E2E Testing

### Checklist
- [ ] User registration → login flow
- [ ] Browse → Add to cart → Checkout → Order
- [ ] Admin: View order → Update status
- [ ] User: View order history
- [ ] Apply discount code
- [ ] Apply loyalty points
- [ ] Review + rating
- [ ] Guest checkout

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| E2E-01 | Full purchase flow | 1. Register<br>2. Browse<br>3. Add to cart<br>4. Checkout<br>5. Complete | Order created |
| E2E-02 | Guest checkout | 1. Add to cart<br>2. Guest checkout<br>3. Complete | Order created |
| E2E-03 | Admin order update | 1. Admin views order<br>2. Update status | Status updated |
| E2E-04 | Discount + Points | 1. Checkout với discount<br>2. Apply points | Both applied |
| E2E-05 | Review as guest | 1. Product detail<br>2. Add comment | Comment visible |
| E2E-06 | Review as user | 1. Login<br>2. Add review + rating | Rating visible |

---

## Task 5.5: Horizontal Scaling Preparation

### Checklist
- [ ] Stateless API design
- [ ] Session in Redis
- [ ] JWT for auth
- [ ] Load balancing ready
- [ ] Documentation for scaling

### Test Cases

| TC ID | Mô tả | Steps | Expected Result |
|-------|-------|-------|----------------|
| SCALE-01 | Stateless check | 1. Check API code<br>2. No local session | All in Redis/JWT |
| SCALE-02 | Multiple instances | 1. Document config<br>2. Ready for deployment | Can scale horizontally |

---

## Phase 5 Completion Criteria

| Criteria | Status |
|----------|--------|
| Responsive design hoàn chỉnh | ⬜ |
| Security validation pass | ⬜ |
| Docker deployment hoạt động | ⬜ |
| Full E2E test pass | ⬜ |
| Horizontal scaling ready | ⬜ |
| **PUSH TO REMOTE** | ⬜ |

---

# PHASE 6: Bonus Features (Tuần 6 - Optional)

## Task 6.1: CI/CD Pipeline

### Checklist
- [ ] GitHub Actions workflow
- [ ] Run tests on PR
- [ ] Build verification
- [ ] Auto deploy on merge

---

## Task 6.2: Microservices Architecture

### Checklist
- [ ] 3+ services (product, order, user)
- [ ] Async communication (RabbitMQ/Redis)
- [ ] Service separation
- [ ] API Gateway

---

## Task 6.3: AI Features (Optional)

### Checklist
- [ ] Product recommendation chatbot
- [ ] Image search
- [ ] Sentiment analysis for reviews

---

## Task 6.4: Elasticsearch Integration

### Checklist
- [ ] Elasticsearch setup
- [ ] Product search with Elasticsearch
- [ ] Performance comparison

---

# Appendix: Test Summary Table

## Authentication Tests (Task 1.3 - 1.5)
| TC ID | Test Name | Expected |
|-------|-----------|----------|
| AUTH-01 | Register success | 201 + user |
| AUTH-02 | Register duplicate | 400 error |
| AUTH-03 | Login success | 200 + token |
| AUTH-04 | Login wrong password | 401 error |
| AUTH-05 | Cookie set | Set-Cookie header |
| AUTH-06 | Logout | Cookie cleared |

## Product Tests (Task 2.1 - 2.2)
| TC ID | Test Name | Expected |
|-------|-----------|----------|
| PROD-01 | List products | Paginated list |
| PROD-02 | Filter category | Filtered list |
| PROD-03 | Filter brand | Filtered list |
| PROD-04 | Filter price | Range filtered |
| PROD-05 | Search | Matched results |
| PROD-06-07 | Sort | Sorted results |
| PROD-08-09 | Pagination | Correct page |
| PROD-10-14 | Product detail | Full data |

## Cart & Checkout Tests (Task 3.1 - 3.5)
| TC ID | Test Name | Expected |
|-------|-----------|----------|
| CART-01-07 | Cart operations | All pass |
| CHECK-01-08 | Checkout flow | Complete |
| DISC-01-07 | Discount codes | Validated |
| ORDER-01-06 | Order management | Complete |
| LOYAL-01-04 | Loyalty system | Complete |

## Admin Tests (Task 4.1 - 4.6)
| TC ID | Test Name | Expected |
|-------|-----------|----------|
| DASH-01-08 | Dashboards | KPIs correct |
| ADMIN-01-19 | All CRUD ops | Pass |

---

# Definition of Done

| Phase | Done Criteria |
|-------|---------------|
| Phase 1 | DB setup + Auth API + Basic FE |
| Phase 2 | Products + Catalog + Detail + Reviews |
| Phase 3 | Cart + Checkout + Orders + Loyalty |
| Phase 4 | Admin Dashboard + Management |
| Phase 5 | Responsive + Security + Docker + E2E |
| Phase 6 | Bonus features (optional) |

---

# Notes

1. **Mỗi task hoàn thành → Commit ngay**
2. **Mỗi task cần test case pass trước khi commit**
3. **Sau mỗi phase → Full test → Pass hết mới push**
4. **Test case fail → Fix → Retest → Pass → Commit**
5. **Documentation đầy đủ trong commit message**

---

**Document Version:** 1.0
**Created:** 2024
**Project:** AEVO E-commerce
