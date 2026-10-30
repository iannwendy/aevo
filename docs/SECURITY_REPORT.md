# Báo Cáo Rà Soát Bảo Mật Mã Nguồn & Khắc Phục Lỗ Hổng (Static Source Code Audit & Remediation Report)

- **Dự án:** AEVO — E-Commerce Platform (`Node.js / Express + Next.js 14 App Router + PostgreSQL / Prisma + Redis + Elasticsearch`)
- **Tiêu chuẩn đối chiếu:** OWASP Top 10 (2021), CWE/SANS Top 25, và đặc tả bắt buộc tại [`docs/requirement.md`](file:///Users/iannwendy/Desktop/NodeFinal/docs/requirement.md)
- **Bộ kiểm thử bảo mật tự động:** [`apps/api/test/security.e2e.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/test/security.e2e.js) (`SEC-01` → `SEC-30`: **30/30 PASS**)

---

## 1. Tổng Quan Phân Tích Theo OWASP Top 10 (2021)

| Hạng mục OWASP Top 10 | Số điểm yếu phát hiện & xử lý | Mức độ nghiêm trọng cao nhất | Trạng thái |
| :--- | :---: | :---: | :---: |
| **A01:2021 — Broken Access Control** | 9 | **Critical** | Đã khắc phục & Kiểm thử (`SEC-01`, `SEC-04..07`, `SEC-12..14`, `SEC-21`, `SEC-27`) |
| **A02:2021 — Cryptographic Failures** | 3 | **High** | Đã khắc phục & Kiểm thử (`SEC-02`, `SEC-03`, `SEC-22`) |
| **A03:2021 — Injection (SQLi, XSS, Header/Prototype)** | 6 | **Critical** | Đã khắc phục & Kiểm thử (`SEC-15..18`, `SEC-30`) |
| **A04:2021 — Insecure Design & Business Logic** | 6 | **High** | Đã khắc phục & Kiểm thử (`SEC-08..11`, `SEC-24..25`, `SEC-29`) |
| **A05:2021 — Security Misconfiguration** | 2 | **Medium** | Đã khắc phục & Kiểm thử (`SEC-19`) |
| **A07:2021 — Identification & Authentication Failures** | 4 | **High** | Đã khắc phục & Kiểm thử (`SEC-20`, `SEC-26`, `SEC-28`) |
| **A08:2021 — Software & Data Integrity Failures** | 1 | **High** | Đã khắc phục & Kiểm thử (Internal HMAC Sync Token cho Elasticsearch) |
| **A10:2021 — Server-Side Request Forgery (SSRF)** | 1 | **High** | Đã khắc phục & Kiểm thử (`SEC-23`) |

---

## 2. Chi Tiết Các Lỗ Hổng Phát Hiện, Mức Độ Ảnh Hưởng & Cách Đã Khắc Phục

### Nhóm 1: A01:2021 — Broken Access Control (Kiểm Soát Truy Cập & Phân Quyền)

#### 1.1. BOLA / IDOR trên Đơn hàng, Giỏ hàng, Sổ địa chỉ & Biến thể Sản phẩm
- **Vị trí mã nguồn:**
  - [`apps/api/src/modules/orders/orders.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/orders/orders.routes.js#L510-L603)
  - [`apps/api/src/modules/cart/cart.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/cart/cart.routes.js#L269-L364)
  - [`apps/api/src/modules/users/users.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/users/users.routes.js#L85-L185)
  - [`apps/api/src/modules/products/products.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/products/products.routes.js#L970-L1030)
- **Mức độ ảnh hưởng:** **Critical** — Người dùng A có thể đọc đơn hàng của người dùng B (hoặc đơn hàng Guest đã gán `userId`), sửa/xóa mục giỏ hàng của người khác qua `itemId`, sửa/xóa địa chỉ giao hàng của người khác, hoặc cập nhật biến thể (`variantId`) thuộc sản phẩm khác.
- **Cách đã khắc phục:**
  - Kiểm tra chặt chẽ quyền sở hữu (`order.userId === req.user.id || req.user.role === 'ADMIN'`) trên cả `GET /api/orders/:id` và `GET /api/orders/number/:orderNumber`. Với đơn hàng có `userId !== null`, từ chối truy cập ẩn danh (`401`) và từ chối người dùng khác (`403`).
  - Xác minh `item.cartId === cart.id` trước mọi thao tác `PUT /api/cart/items/:itemId` và `DELETE /api/cart/items/:itemId`.
  - Truy vấn sổ địa chỉ theo cặp `{ id: addressId, userId: req.user.id }`.
  - Trong `PUT /api/products/:id`, lọc danh sách `ownedVariantIds` thuộc đúng `productId` trước khi cập nhật biến thể.

#### 1.2. Open Redirect qua Poisoning Header `X-Forwarded-Host` / `X-Forwarded-Proto` tại Next.js Middleware
- **Vị trí mã nguồn:** [`apps/web/middleware.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/middleware.js#L52-L108)
- **Mức độ ảnh hưởng:** **High** — Khi truy cập `/admin` chưa đăng nhập, nếu kẻ tấn công giả mạo header `X-Forwarded-Host: evil.com` hoặc `X-Forwarded-Proto: javascript`, middleware có thể trả về `307 Redirect` tới tên miền độc hại (Phishing / Open Redirect).
- **Cách đã khắc phục:**
  - Xây dựng hàm [`resolveSafeRedirectOrigin`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/middleware.js#L52-L94) chỉ chấp nhận giao thức `http`/`https`, kiểm tra định dạng host bằng biểu thức chính quy nghiêm ngặt và đối chiếu tên miền với danh sách tin cậy (`localhost`, `127.0.0.1`, `aevo.io.vn`, `NEXT_PUBLIC_SITE_URL`, `CLIENT_URL`). Nếu header không thuộc danh sách tin cậy, hệ thống tự động fallback về `request.nextUrl.origin`.
  - Kiểm tra `safeNextTarget` bắt đầu bằng `/` và không bắt đầu bằng `//` hoặc `/\`.

#### 1.3. Bảo vệ Khu vực Quản trị (`/admin`) & Ràng buộc "Một Admin Duy Nhất"
- **Vị trí mã nguồn:**
  - [`apps/web/middleware.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/middleware.js#L110-L154)
  - [`apps/api/src/middleware/auth.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/middleware/auth.js#L62-L120)
  - [`apps/api/src/modules/users/users.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/users/users.routes.js#L341-L355)
- **Mức độ ảnh hưởng:** **Critical** — Leo thang đặc quyền (`role: "ADMIN"`, `loyaltyPoints`) qua Mass Assignment hoặc tự khóa tài khoản Admin duy nhất của hệ thống.
- **Cách đã khắc phục:**
  - Xác thực chữ ký HMAC-SHA256 (`HS256`) của JWT ngay tại Edge Middleware của Next.js và tại `authMiddleware` của API; loại bỏ hoàn toàn token `alg: "none"`, token hết hạn, hoặc token đặt lại mật khẩu (`purpose: "password_reset"`).
  - Bỏ qua các trường `role` và `loyaltyPoints` trong `POST /api/auth/register` và `PUT /api/auth/profile`.
  - Tuân thủ nghiêm ngặt mục II.1 của [`docs/requirement.md`](file:///Users/iannwendy/Desktop/NodeFinal/docs/requirement.md): chặn nâng quyền bất kỳ tài khoản nào khác lên `ADMIN` và chặn Admin tự khóa/hạ quyền chính mình.
  - Thu hồi phiên tức thì (`401 Account has been banned`) ngay khi tài khoản bị Admin khóa (`isActive: false`) và chặn đặt hàng Guest bằng email đã bị khóa (`403`).

---

### Nhóm 2: A02:2021 & A07:2021 — Cryptographic, Session & Authentication Security

#### 2.1. Chống Session Fixation & Redis Key Injection trên Giỏ hàng Guest
- **Vị trí mã nguồn:** [`apps/api/src/modules/cart/cart.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/cart/cart.routes.js#L17-L44)
- **Mức độ ảnh hưởng:** **High** — Kẻ tấn công truyền cookie `sessionId` tùy ý (chứa ký tự `:`, `..`, hoặc ID cố định) để chiếm quyền giỏ hàng hoặc ghi đè khóa Redis.
- **Cách đã khắc phục:**
  - Hàm [`sanitizeSessionId`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/cart/cart.routes.js#L19-L26) chỉ chấp nhận định dạng `^guest_[0-9]{10,16}_[a-f0-9]{16,64}$`. Nếu `sessionId` không tồn tại trong DB, hệ thống luôn sinh mới bằng CSPRNG (`crypto.randomBytes(16).toString('hex')`).

#### 2.2. Chống Brute-Force, Timing Enumeration & Bcrypt CPU DoS trên Xác thực
- **Vị trí mã nguồn:** [`apps/api/src/modules/auth/auth.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/auth/auth.routes.js#L171-L250) và [`apps/api/src/modules/auth/auth.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/auth/auth.routes.js#L390-L430)
- **Mức độ ảnh hưởng:** **High** — Dò mật khẩu hàng loạt trên `/api/auth/login` hoặc `/api/auth/password`; gửi mật khẩu dài hàng chục KB gây nghẽn CPU khi băm `bcrypt`; dò email tồn tại qua chênh lệch thời gian phản hồi.
- **Cách đã khắc phục:**
  - Áp dụng Rate Limit kép (theo IP và theo tài khoản/userId với `skipSuccessfulRequests: true`) cho cả `POST /api/auth/login` và `PUT /api/auth/password`.
  - Giới hạn độ dài mật khẩu đầu vào (`max: 128` khi đăng nhập/xác minh mật khẩu hiện tại, `max: 72` khi tạo mật khẩu mới) trước khi gọi `bcrypt.compare` / `bcrypt.hash`.
  - Sử dụng `DUMMY_BCRYPT_HASH` khi email không tồn tại để cân bằng thời gian phản hồi, chống User Enumeration.
  - Băm SHA-256 cho token đặt lại mật khẩu trước khi lưu DB và tự động thu hồi các token cũ ngay khi người dùng yêu cầu link mới hoặc đổi mật khẩu thành công (`SEC-26`).

---

### Nhóm 3: A03:2021 — Injection (XSS, SQLi, Prototype Pollution, CRLF Email Injection)

#### 3.1. Phòng chống Stored / Reflected XSS trong JSON-LD (`<script type="application/ld+json">`)
- **Vị trí mã nguồn:**
  - [`apps/web/app/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/page.js#L102-L110)
  - [`apps/web/app/(store)/products/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/page.js#L134-L142)
  - [`apps/web/app/(store)/products/[slug]/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/%5Bslug%5D/page.js#L201-L210)
- **Mức độ ảnh hưởng:** **High** — `JSON.stringify(jsonLd)` mặc định không escape ký tự `<`, cho phép chuỗi chứa `</script><script>...` thoát khỏi thẻ `<script type="application/ld+json">` khi SSR.
- **Cách đã khắc phục:**
  - Escape toàn bộ `<`, `>`, `&` thành chuỗi Unicode JSON hợp lệ (`\u003c`, `\u003e`, `\u0026`), đảm bảo trình duyệt không bao giờ hiểu nhầm thẻ đóng `</script>` trong khi trình phân tích cú pháp JSON-LD của công cụ tìm kiếm vẫn đọc dữ liệu nguyên vẹn (`SEC-30`).

#### 3.2. Chống Prototype Pollution, Null-Byte, Dangerous URLs & Email HTML/CRLF Injection
- **Vị trí mã nguồn:**
  - [`apps/api/src/utils/security.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/utils/security.js#L1-L78)
  - [`apps/api/src/services/mailer.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/services/mailer.js#L1-L40)
- **Mức độ ảnh hưởng:** **High** — Tiêm thuộc tính `__proto__` / `constructor` / `prototype`, chèn URL `javascript:` / `data:text/html` vào ảnh sản phẩm/danh mục, hoặc chèn HTML/CRLF header vào email giao dịch.
- **Cách đã khắc phục:**
  - Middleware [`sanitizeRequest`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/utils/security.js#L35-L44) đệ quy loại bỏ các khóa `__proto__`, `constructor`, `prototype` và ký tự null `\0` trên `req.body`, `req.query`, `req.params`.
  - Hàm [`isSafeImageUrl`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/utils/security.js#L49-L70) chỉ cho phép `http:`, `https:`, đường dẫn tương đối `/...` hoặc `data:image/(png|jpeg|jpg|webp|gif);base64,...`.
  - Hàm [`escapeHtml`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/services/mailer.js#L11-L19) và [`stripHeaderBreaks`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/services/mailer.js#L21-L23) làm sạch mọi dữ liệu người dùng trước khi tạo nội dung và tiêu đề email.

---

### Nhóm 4: A04:2021, A08:2021 & A10:2021 — Toàn Vẹn Logic Nghiệp Vụ, DoS & SSRF

#### 4.1. Toàn vẹn Giao dịch Đặt hàng, Tồn kho, Mã giảm giá & Điểm thưởng (Race Condition & Rollback)
- **Vị trí mã nguồn:** [`apps/api/src/modules/orders/orders.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/orders/orders.routes.js#L95-L345) và [`apps/api/src/modules/orders/orders.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/orders/orders.routes.js#L605-L715)
- **Mức độ ảnh hưởng:** **Critical** — Đặt số lượng âm/thập phân, vượt tồn kho qua các dòng sản phẩm trùng `variantId`, dùng mã giảm giá quá số lượt tối đa (`maxUses <= 10`), hoặc hủy đơn hàng nhưng không hoàn lại tồn kho/điểm thưởng.
- **Cách đã khắc phục:**
  - Gộp số lượng theo từng `variantId`, kiểm tra số nguyên dương (`1..999`, tối đa `50` dòng sản phẩm/đơn và `50` dòng/giỏ hàng).
  - Sử dụng cập nhật có điều kiện nguyên tử (`updateMany` với `inventory: { gte: item.quantity }` và `usedCount: { lt: discount.maxUses }`) bên trong `prisma.$transaction` để chống Race Condition.
  - Khi đơn hàng chuyển sang `CANCELLED`, hoàn trả chính xác tồn kho biến thể, giảm `usedCount` của mã giảm giá, hoàn điểm đã dùng và thu hồi điểm thưởng đã cộng, đồng thời khóa không cho mở lại đơn đã hủy (`SEC-09`, `SEC-10`).

#### 4.2. Kiểm soát Độ dài Dữ liệu Đầu vào & Chặn Memory Exhaustion DoS
- **Vị trí mã nguồn:**
  - [`apps/api/src/modules/users/users.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/users/users.routes.js#L357-L378)
  - [`apps/api/src/modules/products/products.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/products/products.routes.js#L750-L790)
  - [`apps/api/src/modules/categories/categories.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/categories/categories.routes.js#L107-L165)
  - [`apps/api/src/modules/discounts/discounts.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/discounts/discounts.routes.js#L189-L235)
  - [`apps/api/src/utils/redis.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/utils/redis.js#L10-L35)
  - [`apps/api/src/middleware/rateLimit.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/middleware/rateLimit.js#L9-L55)
- **Mức độ ảnh hưởng:** **Medium / High** — Gửi chuỗi quá dài vào các API quản trị/người dùng hoặc làm đầy bộ nhớ RAM của tiến trình Node.js qua bộ đệm dự phòng `memoryStore` / `buckets`.
- **Cách đã khắc phục:**
  - Áp đặt giới hạn độ dài rõ ràng cho email (`<= 254` ký tự, đúng định dạng), địa chỉ (`<= 300`), tên sản phẩm (`<= 200`), mô tả sản phẩm (`<= 10000`), số biến thể (`<= 50`), số ảnh (`<= 20`), tên danh mục (`<= 120`, bắt buộc sinh `slug` hợp lệ) và mô tả mã giảm giá (`<= 500`) (`SEC-24`, `SEC-25`, `SEC-29`).
  - Giới hạn kích thước tối đa và tự động dọn dẹp định kỳ cho `memoryStore` (`MAX_MEMORY_STORE_ENTRIES = 2000`) trong [`redis.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/utils/redis.js#L10-L35) và `buckets` (`MAX_BUCKETS = 5000`) trong [`rateLimit.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/middleware/rateLimit.js#L9-L55).

#### 4.3. Bảo vệ Microservices Gateway khỏi SSRF / Path Traversal & Bảo vệ Elasticsearch Index
- **Vị trí mã nguồn:**
  - [`apps/api/src/modules/microservices/microservices.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/microservices/microservices.routes.js#L130-L195)
  - [`apps/api/src/utils/elasticsearch.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/utils/elasticsearch.js#L12-L26)
  - [`apps/api/src/microservices/service-runner.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/microservices/service-runner.js#L101-L125)
- **Mức độ ảnh hưởng:** **High** — Kẻ tấn công lợi dụng Gateway Proxy để thực hiện Path Traversal/SSRF hoặc gọi trực tiếp vào cổng `9200` của node Elasticsearch độc lập để xóa/ghi đè chỉ mục tìm kiếm (`/_bulk_sync`, `/_doc/:id`).
- **Cách đã khắc phục:**
  - Trên Gateway Proxy, chỉ cho phép chuyển tiếp tới danh sách dịch vụ nội bộ cố định (`product-service`, `order-service`, `user-service`), chặn tuyệt đối `..`, `//`, `\`, `@` và chỉ chuyển tiếp các header an toàn (`SEC-23`).
  - Yêu cầu mã xác thực nội bộ `X-Internal-Sync-Token` (HMAC-SHA256 so sánh bằng `crypto.timingSafeEqual`) đối với mọi thao tác ghi/xóa (`POST /:index/_bulk_sync`, `PUT /:index/_doc/:id`, `DELETE /:index/_doc/:id`) trên node Elasticsearch.
