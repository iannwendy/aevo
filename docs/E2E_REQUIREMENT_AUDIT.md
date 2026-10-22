# Báo cáo Kiểm thử E2E & Đối chiếu Đặc tả (`docs/requirement.md`)

> **Ghi chú:** Báo cáo này được tổng hợp từ quá trình chạy **Full E2E Test trực tiếp bằng Playwright MCP** trên toàn bộ luồng Khách hàng (Guest & Logged-in) và Quản trị viên (Admin), đối chiếu từng mục với `docs/requirement.md` và `docs/reqVN.md`.
> **Trạng thái mã nguồn:** Chưa chỉnh sửa bất kỳ dòng code nào theo đúng yêu cầu.

---

## 1. Tổng quan Kết quả Kiểm thử E2E theo Rubric

| Hạng mục trong `requirement.md` | Trạng thái E2E | Ghi chú đối chiếu đặc tả |
| :--- | :---: | :--- |
| **I. Overview — Chỉ bán máy tính & linh kiện** | ⚠️ Cảnh báo | Có 6 mẫu **Pin sạc dự phòng (Power Bank)** và củ sạc Anker trong danh mục `Accessories` (hiển thị ngay vị trí đầu tiên mục *New Products* ở trang chủ). |
| **II.1. Landing Page (Home page)** | ✅ Đạt | Có đầy đủ *New Products*, *Best Sellers*, và >= 3 danh mục riêng biệt (*Laptops*, *Components*, *Monitors*) kèm phân trang hoạt động tốt. |
| **II.1 & II.4. Guest Checkout & Tự động tạo tài khoản** | ❌ Lỗi Flow | Tự động tạo `User` khi đặt hàng không đăng nhập nhưng `password: null`, không gửi mật khẩu/link đặt mật khẩu qua email; khi khách quay lại `/login` bị báo lỗi sai: *"This account uses Google sign-in"*. |
| **II.2. Đăng ký tài khoản (`/register`)** | ❌ Sai Đặc tả | Đặc tả yêu cầu: *"Khi tạo tài khoản, người dùng chỉ nhập email, họ tên đầy đủ và địa chỉ giao hàng"*. Trang `/register` hiện tại **không có ô nhập địa chỉ giao hàng** và bắt nhập mật khẩu. |
| **II.2. Social Media Authentication (Google/Facebook)** | ❌ Lỗi E2E | Bấm *"Continue with Google"* trả về trang JSON lỗi `503 {"error":"Google login is not configured on this server"}`. Không có nút đăng nhập Facebook trên UI. |
| **II.2. Quản lý Hồ sơ, Đổi mật khẩu & Sổ địa chỉ** | ⚠️ Lỗi nhỏ | Đổi tên, đổi mật khẩu, thêm/sửa/xóa nhiều địa chỉ hoạt động tốt. Tuy nhiên lưu số điện thoại ở `/account/profile` bị mất nếu user chưa có địa chỉ mặc định; quên mật khẩu không thể lấy link trên UI nếu chưa cấu hình SMTP. |
| **II.3. Product Catalog, Search, Filter, Sort, Pagination** | ✅ Đạt | Có trang `/products` riêng, Grid/List view, phân trang hiển thị cả khi chỉ có 1 trang (`Showing 1–1 of 1 products`), 6 tiêu chí sắp xếp, lọc theo Brand + Price (min/max) + Category + Rating + Tag. |
| **II.3. Product Details & Variants** | ✅ Đạt | Toàn bộ 129 sản phẩm đều có >= 2 biến thể tồn kho độc lập, >= 3 hình ảnh, mô tả >= 5 dòng. |
| **II.3. Product Reviews, Ratings & WebSocket** | ⚠️ Lỗi nhỏ | Guest bình luận không cần login và Member chấm sao realtime qua Socket.IO hoạt động tốt. Tuy nhiên API bắt buộc phải nhập `comment` khi chấm sao (không cho phép chỉ chấm sao). |
| **II.4. Giỏ hàng & Thanh toán 5 bước (`/cart`, `/checkout`)** | ✅ Đạt | Cập nhật số lượng/xóa món realtime không reload trang, hiển thị Subtotal/Shipping/Tax/Total, tự động điền địa chỉ mặc định khi đã đăng nhập. |
| **II.5. Màn hình Đặt hàng Thành công (`/checkout/success`)** | ❌ Lỗi UI (`NaN ₫`) | Hiển thị **`NaN ₫`** ở cột thành tiền của từng sản phẩm vừa đặt và **không hiển thị huy hiệu điểm thưởng vừa tích lũy** do thiếu trường dữ liệu từ API. |
| **II.5. Theo dõi đơn hàng & Lịch sử trạng thái** | ✅ Đạt | Có bảng lịch sử trạng thái (*Status History*) xếp thứ tự thời gian giảm dần (trạng thái mới nhất ở trên cùng). |
| **II.5. Chương trình Khách hàng Thân thiết (Loyalty 10%)** | ❌ Sai Công thức | Đặc tả yêu cầu tích 10% dựa trên **tổng giá trị đơn hàng (order total)**, nhưng hệ thống đang tính trên giá trị hàng hóa trước thuế (`afterDiscount - loyaltyDiscount`), dẫn đến số điểm bị thiếu so với `Total`. |
| **II.6. Admin — Simple & Advanced Dashboard** | ⚠️ Lỗi nhỏ | Đầy đủ KPI và biểu đồ. Tuy nhiên trục Y biểu đồ hiển thị số thô (`45000000`, `180000000`) chưa format tiền tệ, và biểu đồ mặc định đang nhóm theo `MONTH` thay vì `YEAR`. |
| **II.6. Admin — Product, User, Order, Discount Management** | ⚠️ Lỗi Logic/UI | Quản lý User cho phép nâng quyền thêm nhiều `ADMIN` (vi phạm quy định *"một quản trị viên duy nhất"*); hủy đơn hàng làm lệch số liệu `USED / MAX` so với `APPLIED ORDERS` ở trang Discount; phân trang ở `/admin/users` và `/admin/orders` ghi nhầm là *"products"*; thiếu dịch tiếng Việt (`VIE`) ở toàn bộ bảng Admin. |

---

## 2. Chi tiết các Lỗi & Điểm Sai lệch so với Đặc tả

### 🔴 Nhóm 1: Rủi ro Nghiêm trọng & Sai lệch trực tiếp Đặc tả (Critical / High Priority)

#### 1.1. Hiển thị `NaN ₫` trên màn hình Đặt hàng Thành công (`/checkout/success`)
- **Yêu cầu đặc tả (Mục II.5 - Order Creation):**
  > *"Once the purchase transaction is completed, the user must be shown a success screen displaying all relevant information about the order they just placed."*
- **Hiện trạng khi chạy E2E:**
  Sau khi hoàn tất đặt hàng (cả Guest lẫn Logged-in) và chuyển hướng sang `/checkout/success?orderNumber=...`, tại danh sách sản phẩm đã đặt (*Ordered Hardware*), giá tổng của từng dòng sản phẩm hiển thị là **`NaN ₫`**.
- **Nguyên nhân trong code:**
  Tại `apps/web/app/(store)/checkout/success/page.js` (dòng 210–212), giao diện gọi `formatPrice(item.total)`, nhưng model `OrderItem` trả về từ API `apps/api/src/modules/orders/orders.routes.js` (dòng 175–182) chỉ có `item.price` và `item.quantity` (không có trường `total`), khiến `formatPrice(undefined)` trả về `"NaN ₫"`.
- **Lỗi đi kèm trên cùng trang:**
  Tại `apps/web/app/(store)/checkout/success/page.js` (dòng 162–174), trang kiểm tra `(order?.earnedPoints > 0 || order?.earnedLoyaltyPoints > 0)` để hiển thị số điểm thưởng tích lũy được từ đơn hàng. Tuy nhiên API `GET /api/orders/number/:orderNumber` tại `apps/api/src/modules/orders/orders.routes.js` (dòng 472–503) không trả về trường `earnedPoints`, nên thông báo điểm thưởng trên màn hình thành công không bao giờ hiển thị.

---

#### 1.2. Form Đăng ký tài khoản (`/register`) không khớp với mô tả đặc tả
- **Yêu cầu đặc tả (Mục II.2 - User Registration and Login):**
  > *"When creating an account, users only enter their email, full name and shipping address."*
  > *(Khi tạo tài khoản, người dùng chỉ nhập email, họ tên đầy đủ và địa chỉ giao hàng.)*
- **Hiện trạng khi chạy E2E:**
  1. Trang `apps/web/app/(auth)/register/page.js` hiện chỉ có 3 trường: `Full name`, `Email`, và `Password` — **hoàn toàn không có trường nhập địa chỉ giao hàng (`shipping address`)**.
  2. Dù API backend `POST /api/auth/register` tại `apps/api/src/modules/auth/auth.routes.js` (dòng 75–108) có đoạn xử lý `const { email, password, fullName, address, phone } = req.body`, nhưng do UI `/register` không có ô nhập địa chỉ nên tài khoản mới tạo luôn có `addresses: []` (0 địa chỉ).
  3. Hệ quả dây chuyền: Khi người dùng vừa đăng ký xong và đi mua hàng ngay, yêu cầu ở **Mục II.1** (*"If the customer purchases after logging in, the default address (if any) will be pre-filled in the checkout section"*) sẽ không có địa chỉ mặc định nào để điền sẵn.

---

#### 1.3. Luồng Guest Checkout tự động tạo tài khoản nhưng khách hàng không thể đăng nhập lại để xem đơn cũ
- **Yêu cầu đặc tả (Mục II.1 - Landing Page & Guest Purchase):**
  > *"The website must allow users to make purchases without logging in. If they make a purchase without logging in, an account will be automatically created for the user (if they do not have one already), the order information will be saved, and in the future if the customer logs in, they will be able to review their previous orders."*
- **Hiện trạng khi chạy E2E:**
  1. Khi khách vãng lai (Guest) đặt hàng tại `/checkout`, backend `apps/api/src/modules/orders/orders.routes.js` (dòng 292–300) tự động tạo một bản ghi `User` mới với `password: null`.
  2. Email xác nhận đơn hàng (`sendOrderConfirmationEmail` trong `apps/api/src/services/mailer.js`) và màn hình `/checkout/success` **không cung cấp mật khẩu tạm thời cũng không gửi đường dẫn thiết lập mật khẩu** cho tài khoản vừa được tạo tự động.
  3. Khi khách bấm *"View Order History"* -> *"Sign in with the email you used at checkout"* và nhập email đó vào trang `/login`, API `POST /api/auth/login` tại `apps/api/src/modules/auth/auth.routes.js` (dòng 171–173) kiểm tra `if (!user.password)` và trả về lỗi:
     - API: `401 {"error": "Please use social login"}`
     - Giao diện `/login`: **`"This account uses Google sign-in. Continue with Google below."`** (dù khách hàng chưa từng dùng Google sign-in).
  4. Nếu khách sang `/register` để tạo tài khoản với email đó thì bị chặn bởi lỗi **`"Email already registered"`**. Khách hàng hoàn toàn bị kẹt không thể đăng nhập để xem lại đơn hàng cũ.

---

#### 1.4. Đăng nhập Mạng xã hội (Social Media Authentication) bị lỗi `503` khi chạy Docker Compose
- **Yêu cầu đặc tả (Mục II.2 & Rubric ID 1 - 0.25 điểm):**
  > *"Social Media Authentication: Users can log in using any social media account, e.g. Google or Facebook, etc for convenience."*
- **Hiện trạng khi chạy E2E:**
  1. Khi click vào nút **"Continue with Google"** trên `/login` hoặc `/register`, trình duyệt điều hướng thẳng tới `http://localhost:3001/api/auth/google` và hiển thị màn hình JSON thô:
     `{"error":"Google login is not configured on this server"}` (HTTP 503) do trong `docker-compose.yml` không có biến môi trường `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` và không có cơ chế fallback/mock OAuth cho môi trường chấm bài local.
  2. Backend `apps/api/src/modules/auth/auth.routes.js` có route `/api/auth/facebook`, nhưng trên giao diện `/login` và `/register` chỉ có nút Google, không có nút Facebook.

---

#### 1.5. Rủi ro về Danh mục Sản phẩm (Quy định cấm bán sản phẩm ngoài máy tính & linh kiện)
- **Yêu cầu đặc tả (Mục I - Overview):**
  > *"To prevent fraud, you are required to develop a website that exclusively sells computers and computer components. The sale of phones or any other products is strictly prohibited, and any violation of this rule will result in a score of 0 for the entire project."*
- **Hiện trạng khi chạy E2E:**
  Trong 129 sản phẩm đang có trong cơ sở dữ liệu, danh mục `Accessories` chứa 6 sản phẩm **Pin sạc dự phòng (Power Bank) & Củ sạc**:
  - `Anker 737 Power Bank 24,000mAh` (**đang xuất hiện ở vị trí đầu tiên trên Trang chủ** trong mục *New Products*)
  - `Anker Prime Fusion 9,600mAh 65W 2-in-1 Power Bank (A1339)`
  - `Anker Prime 200W 6-Port GaNPrime Desktop Charger (A2683)`
  - `Anker Zolo 25,000mAh 165W Built-In USB-C Power Bank (A1695)`
  - `Anker Prime 20,000mAh 220W Power Bank (A110B)`
  - `Anker Prime 26,000mAh 300W Power Bank (A110A)`
  Dù phần mô tả có nhắc đến sạc cho MacBook/Laptop, nhưng "Power Bank" (pin sạc dự phòng) thường được xếp vào nhóm phụ kiện điện thoại/di động hơn là *"máy tính và linh kiện máy tính"*. Việc để `Anker 737 Power Bank` ngay ô đầu tiên của trang chủ tiềm ẩn rủi ro rất lớn khi giảng viên chấm bài.

---

### 🟠 Nhóm 2: Sai lệch Công thức Nghiệp vụ & Quy tắc Hệ thống (Medium Priority)

#### 2.1. Công thức tính Điểm thưởng (Loyalty Points) lệch so với mô tả đặc tả
- **Yêu cầu đặc tả (Mục II.5 - Loyalty Programs):**
  > *"A loyalty system should be implemented, where customers earn 10% of the total order amount as points for each purchase. For example, with an order total of 1,000,000 VND, the customer will accumulate 100 points, which is equivalent to 100,000 VND."*
- **Hiện trạng khi chạy E2E:**
  - Tại `apps/api/src/modules/orders/orders.routes.js` (dòng 242–250) và `apps/web/components/checkout/CheckoutClient.js` (dòng 188–195):
    - `totalAmount = afterDiscount + shippingFee + taxAmount - loyaltyDiscount`
    - Nhưng điểm thưởng lại được tính theo: `pointsToEarn = Math.floor(Math.max(0, afterDiscount - loyaltyDiscount) / 10000)` (tức là **không tính trên `totalAmount`** mà tính trên tiền hàng trước thuế VAT 10% và phí vận chuyển).
  - **Ví dụ thực tế khi chạy E2E:** Đơn hàng có `Subtotal = 39.990.000 ₫`, mã giảm giá `-3.999.000 ₫`, thuế VAT `+3.599.100 ₫`, **`Total = 39.590.100 ₫`**. Theo đặc tả (10% của tổng đơn hàng `39.590.100 ₫`), khách phải nhận **`3.959 điểm`**, nhưng hệ thống chỉ cộng **`3.599 điểm`**.

---

#### 2.2. Cho phép tạo nhiều tài khoản `ADMIN` (Vi phạm giới hạn 1 quản trị viên duy nhất)
- **Yêu cầu đặc tả (Mục II.1 - Landing Page):**
  > *"To keep things simple, the system only needs to support two types of users: customers and a single administrator."*
- **Hiện trạng khi chạy E2E:**
  Tại trang `/admin/users`, khi bấm **Edit** một khách hàng bất kỳ, khung *User Account Inspector* hiển thị dropdown `Role` cho phép chọn `ADMIN`, và API `PUT /api/users/:id` tại `apps/api/src/modules/users/users.routes.js` (dòng 309) cho phép cập nhật `role: 'ADMIN'` cho bất kỳ user nào, dẫn đến hệ thống có thể có nhiều quản trị viên cùng lúc.

---

#### 2.3. Lệch số liệu `USAGE (USED / MAX)` và `APPLIED ORDERS` tại trang Quản lý Mã giảm giá (`/admin/discounts`)
- **Yêu cầu đặc tả (Mục II.6 - Discount Management):**
  > *"The administrator should have the ability to view a list of discount codes along with relevant details, including the creation time, discount value, the number of times the code has been used out of the maximum allowed usage, and a list of orders where the coupon has been applied."*
- **Hiện trạng khi chạy E2E:**
  Tại bảng `/admin/discounts`:
  - Mã `CYYWG` hiển thị `USAGE (USED / MAX)`: **`0 / 1`**, nhưng cột `APPLIED ORDERS` bên cạnh lại hiển thị **`1 order(s)`**.
  - Mã `CBO5R` (giới hạn tối đa 1 lần dùng) hiển thị `USAGE (USED / MAX)`: **`1 / 1`**, nhưng cột `APPLIED ORDERS` lại hiển thị **`2 order(s)`** (vượt quá giới hạn tối đa của mã).
- **Nguyên nhân:**
  Khi một đơn hàng có áp mã giảm giá bị chuyển sang trạng thái `CANCELLED` tại `apps/api/src/modules/orders/orders.routes.js` (dòng 696–704), hệ thống giảm `usedCount` đi 1 và xóa bản ghi trong `DiscountUsage`, nhưng **không gỡ `discountCodeId` khỏi đơn hàng đã hủy** (hoặc UI `/admin/discounts` đang lấy `discount.orders` thay vì `discount.usageHistory`).

---

#### 2.4. Khôi phục mật khẩu (`/forgot-password`) và Email xác nhận đơn hàng không thể kiểm tra trên UI nếu thiếu SMTP
- **Yêu cầu đặc tả (Mục II.2, II.5 & Rubric ID 4, ID 21):**
  - Khôi phục mật khẩu (*Password recovery*)
  - Gửi email xác nhận sau khi đặt hàng (*Email notification after placing an order*)
- **Hiện trạng khi chạy E2E:**
  Trong `docker-compose.yml` không tích hợp container mail test (như Mailpit/MailHog) và không cấu hình biến `SMTP_*`. Do đó `apps/api/src/services/mailer.js` chỉ in nội dung email và link reset password ra `stdout` của container `api`. Khi giảng viên test tính năng **Quên mật khẩu** trên trình duyệt sẽ chỉ thấy thông báo *"If an account exists for..., a reset link is on its way"* mà không có cách nào lấy được link reset để hoàn tất luồng đổi mật khẩu mới (trừ khi mở terminal gõ `docker logs`).

---

#### 2.5. Lưu Số điện thoại trên trang Hồ sơ (`/account/profile`) không hoạt động nếu chưa có Địa chỉ mặc định
- **Hiện trạng khi chạy E2E:**
  Tại `apps/api/src/modules/auth/auth.routes.js` (dòng 277–282), model `User` không có cột `phone`; khi người dùng nhập số điện thoại ở `/account/profile` và bấm *Save*, backend chạy lệnh `prisma.address.updateMany({ where: { userId: req.user.id, isDefault: true }, data: { phone } })`.
  Do tài khoản mới đăng ký chưa có địa chỉ nào, lệnh `updateMany` cập nhật 0 bản ghi nhưng vẫn trả về `200 OK` (*"Your details were saved"*). Khi tải lại trang `/account/profile`, ô số điện thoại lại trống rỗng.

---

#### 2.6. Ràng buộc tạo/sửa sản phẩm trong Admin và Đánh giá sao
1. **Ràng buộc số biến thể và số ảnh tối thiểu trong Admin (`/admin/products/new`):**
   - Đặc tả yêu cầu: *"every product must have at least two variants"* và *"a minimum of three illustrative images"*.
   - Dữ liệu seed hiện tại đạt 100% (cả 129 sản phẩm đều có >= 2 biến thể và >= 3 ảnh). Tuy nhiên form tạo/sửa sản phẩm tại `apps/web/components/admin/ProductFormClient.js` (dòng 128–193) và API backend lại cho phép xóa bớt chỉ còn **1 biến thể** và **1 hình ảnh**, cũng như thiếu ô gắn `tags` cho sản phẩm.
2. **Không cho phép chỉ chấm sao (Star Rating) mà không nhập bình luận:**
   - Đặc tả tách riêng *Product review (comment)* (không cần login) và *Product rating with stars* (cần login). Tuy nhiên tại `apps/api/src/modules/reviews/reviews.routes.js` (dòng 82–86), API bắt buộc `if (!cleanComment) return res.status(400).json({ error: 'Comment is required' })`, nên người dùng đã đăng nhập không thể chỉ chấm sao mà không gõ chữ.

---

### 🟡 Nhóm 3: Lỗi Hiển thị, Định dạng, Đa ngôn ngữ & UX/UI (Low Priority / Polish)

1. **Trục Y của biểu đồ trên Advanced Dashboard (`/admin`) hiển thị số thô chưa định dạng:**
   - Đặc tả (trang 11) nhấn mạnh: *“Poor approach: Display data directly from the database as ‘75299000’, which is hard to read. Better approach: Format as ‘75,299,000đ’”*.
   - Trên trang `/admin` (mục *Comparative Revenue & Profit*), các nhãn trục tung (Y-axis) của biểu đồ đang hiển thị số thô `0`, `45000000`, `90000000`, `135000000`, `180000000`.
2. **Biểu đồ so sánh trên Advanced Dashboard mặc định hiển thị theo `MONTH` thay vì `YEAR`:**
   - Đặc tả (Mục II.6): *"By default, the data is shown annually"*. Dù bộ lọc khoảng thời gian mặc định chọn `Annual (Year)`, nhưng tab biểu đồ `BREAKDOWN` bên dưới lại mặc định chọn `By Month` (`Comparative Revenue & Profit (MONTH)`).
3. **Phân trang ở `/admin/users` và `/admin/orders` hiển thị sai chữ `"products"`:**
   - Tại cuối trang Quản lý Người dùng (`/admin/users`), thanh phân trang hiển thị: **`Showing 1–20 of 51 products`** (lẽ ra phải là `users`).
   - Tại cuối trang Quản lý Đơn hàng (`/admin/orders`), thanh phân trang cũng hiển thị: **`Showing 1–20 of 48 products`** (lẽ ra phải là `orders`).
4. **Chế độ Tiếng Việt (`VIE`) bị sót rất nhiều chuỗi tiếng Anh ở trang Admin:**
   - Khi chuyển ngôn ngữ sang `VIE`, các trang `/admin`, `/admin/products`, `/admin/products/new`, `/admin/users`, `/admin/orders`, `/admin/discounts` chỉ dịch phần tiêu đề chính, trong khi toàn bộ tiêu đề cột bảng (`PRODUCT`, `CATEGORY`, `BRAND`, `VARIANTS`, `INVENTORY`, `PRICE`, `ACTIONS`, `USER`, `ROLE`, `STATUS`...), các nút thao tác (`Edit`, `Ban`, `Unban`, `Details`, `Deactivate`, `Generate`...) và các nhãn form vẫn hiển thị bằng tiếng Anh.
5. **Thiếu liên kết `<label htmlFor>` ở một số form:**
   - Tại form thêm/sửa địa chỉ ở `/account/addresses` và form `User Account Inspector` ở `/admin/users`, các thẻ `<label>` không gắn `htmlFor` với `id` của `<input>`, gây giảm khả năng truy cập (accessibility).
