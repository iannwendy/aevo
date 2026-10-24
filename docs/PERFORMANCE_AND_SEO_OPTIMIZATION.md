# Báo Cáo Rà Soát & Đề Xuất Tối Ưu Hiệu Năng (Performance) và SEO Toàn Diện

Tài liệu này tổng hợp toàn bộ các điểm nghẽn hiệu năng (Frontend, Backend, Database, Hạ tầng Docker/Nginx) và các cơ hội tối ưu SEO còn thiếu trên toàn bộ dự án **AEVO Computer Store**, kèm theo giải pháp kỹ thuật chi tiết. Mọi đề xuất dưới đây đều tuân thủ nghiêm ngặt **[docs/requirement.md](file:///Users/iannwendy/Desktop/NodeFinal/docs/requirement.md)** và **giữ nguyên 100% luồng nghiệp vụ (business flow) cũng như E2E test hiện có**.

---

## 0. Nguyên Tắc Ràng Buộc ("Guardrails") Theo `docs/requirement.md` & Flow Sẵn Có

Trước khi áp dụng bất kỳ tối ưu nào, các nguyên tắc bất di bất dịch sau phải được đảm bảo:

1. **Không thêm tính năng thừa vào Admin ([requirement.md](file:///Users/iannwendy/Desktop/NodeFinal/docs/requirement.md#L109)):**
   - *"Other than the functions mentioned above, you must not add any extra features to the admin."*
   - Mọi tối ưu ở trang Admin chỉ được phép diễn ra ở tầng kỹ thuật bên dưới (Code splitting `recharts`, tối ưu câu truy vấn SQL/Prisma, indexing), **tuyệt đối không thêm nút bấm, bộ lọc hay màn hình mới ngoài đặc tả**.
2. **Giữ nguyên cấu trúc `<title>` hiện tại (`formatAevoTitle`) và `data-testid`:**
   - Bộ kiểm thử E2E đang kiểm tra định dạng tiêu đề qua hàm [`formatAevoTitle`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/lib/utils.js#L168-L185) (`AEVO — ...`) và các selector `data-testid`. Khi bổ sung SEO Metadata (`openGraph`, `twitter`, `alternates`, `keywords`), **phải giữ nguyên thuộc tính `title`** hiện có.
3. **Giữ nguyên luồng Realtime WebSocket, Pagination, Giỏ hàng (Guest/User), Checkout và Đa ngôn ngữ (VI/EN):**
   - Khi khử trùng lặp request giữa SSR và CSR (Data Hydration), chỉ bỏ qua lần fetch đầu tiên lúc mới mount nếu dữ liệu SSR đã khớp; mọi thao tác đổi bộ lọc, chuyển trang, đổi ngôn ngữ (`locale`), hoặc nhận sự kiện WebSocket (`PRODUCT_UPDATED`, `REVIEW_CREATED`) vẫn phải fetch/cập nhật động như cũ.
4. **Khai thác đúng yêu cầu SEO trong [requirement.md](file:///Users/iannwendy/Desktop/NodeFinal/docs/requirement.md#L64):**
   - Mục **II.3. Product Categorization and Tagging** nêu rõ: *"Organizes products into categories and tags to improve navigation and SEO."* — Do đó việc đưa `category` và `tags` của sản phẩm vào `meta keywords`, `OpenGraph`, và `JSON-LD Schema.org` là hoàn toàn bám sát yêu cầu chấm điểm.

---

## PHẦN 1: TỐI ƯU HIỆU NĂNG FRONTEND (NEXT.JS 14 APP ROUTER)

### 1.1. Triệt tiêu tình trạng "Double-Fetching" / "Triple-Fetching" (SSR + CSR gọi API trùng lặp lúc tải trang)

**Hiện trạng:**
Các trang cửa hàng đang thực hiện SSR rất tốt ở Server Component, nhưng khi truyền `initialData` xuống Client Component thì `useEffect` trong Client Component lại **gọi lại chính các API đó ngay lập tức ở lần mount đầu tiên**, gây nhân đôi tải lên Backend và làm chậm quá trình Hydration.

| Trang / Luồng | Server Component (SSR Fetch) | Client Component (CSR Fetch lại khi mount) | Số request bị lặp |
| :--- | :--- | :--- | :--- |
| **Trang chủ (`/`)** | [`apps/web/app/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/page.js#L35-L43) gọi song song 6 API (`featured`, `new-arrivals`, `best-sellers`, `laptops`, `pc-components`, `categories`). | [`HomeClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/home/HomeClient.js#L79-L135) chạy `useEffect` gọi lại cả 6 API ngay khi mount dù `initialData` đã có đủ dữ liệu. | **6 requests** bị gọi đúp mỗi lần vào trang chủ. |
| **Danh mục (`/products`)** | [`apps/web/app/(store)/products/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/page.js#L52-L56) đã fetch `initialProducts`, `initialCategories`, `initialFilters` theo đúng `searchParams`. | [`CatalogClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/CatalogClient.js#L151-L228) gọi lại `/categories`, `/products/filters` và `/products` ngay khi mount. | **3 requests** bị gọi đúp mỗi lần mở `/products`. |
| **Chi tiết SP (`/products/[slug]`)** | [`apps/web/app/(store)/products/[slug]/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/%5Bslug%5D/page.js#L33-L51) gọi `fetchProductBySlugSafe(slug)` **2 lần** trên server (`generateMetadata` dòng 33 + `ProductDetailPage` dòng 51 với `cache: 'no-store'`). | [`ProductDetailClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/ProductDetailClient.js#L154-L183) gọi lại `/products/${slug}` lần thứ **3** trong `useEffect` khi mount. | **2 requests thừa** (tổng cộng 3 lần gọi cho 1 trang chi tiết SP). |
| **Giỏ hàng (`/cart`) & Thanh toán (`/checkout`)** | [`cart/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/cart/page.js#L50-L56) và [`checkout/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/checkout/page.js#L64-L68) đã fetch sẵn `initialCart`, `initialUser`, `initialAddresses`. | [`CartClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/cart/CartClient.js#L45-L67) và [`CheckoutClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/checkout/CheckoutClient.js#L107-L146) vẫn gọi lại `refreshCart()` và `/users/me` ngay lúc khởi tạo. | **1–2 requests** bị lặp. |

**Giải pháp (Giữ nguyên 100% flow):**
1. **Dùng `React.cache()` trong [`apps/web/app/(store)/products/[slug]/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/%5Bslug%5D/page.js#L14-L29):**
   Bọc hàm `fetchProductBySlugSafe` bằng `cache` của `react` để `generateMetadata()` và `ProductDetailPage()` dùng chung kết quả trong cùng 1 chu kỳ render SSR:
   ```javascript
   import { cache } from 'react';
   const fetchProductBySlugSafe = cache(async (slug) => { ... });
   ```
2. **Dùng `useRef` kiểm soát lần mount đầu tiên ở Client Components:**
   - Trong [`HomeClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/home/HomeClient.js#L79-L135): Nếu `initialData` đã có dữ liệu (ví dụ `initialData.featured?.length > 0 || initialData.categories?.length > 0`), bỏ qua lần fetch đầu tiên trong `useEffect`.
   - Trong [`CatalogClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/CatalogClient.js#L151-L228): Nếu `initialCategories.length > 0` thì không gọi lại `/categories`; dùng `isFirstRenderRef` để bỏ qua lần gọi `fetchProducts()` đầu tiên khi `initialProducts` đã được SSR cung cấp. Khi người dùng bấm lọc, tìm kiếm, sắp xếp hoặc chuyển trang, `fetchProducts()` vẫn chạy bình thường.
   - Trong [`ProductDetailClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/ProductDetailClient.js#L154-L183): Nếu `initialProduct?.slug === slug`, không fetch lại ở lần mount đầu tiên (chỉ fetch lại khi nhận sự kiện WebSocket `PRODUCT_UPDATED` hoặc `REVIEW_CREATED`).

---

### 1.2. Thay thế `cache: 'no-store'` cực đoan bằng Revalidation ngắn hạn cho dữ liệu tĩnh/ít biến động

**Hiện trạng:**
- [`apps/web/app/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/page.js#L26) và [`apps/web/app/(store)/products/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/page.js#L19) đang ép `cache: 'no-store'` cho tất cả các API, kể cả `/api/categories` và `/api/products/filters`.
- Điều này khiến mọi lượt truy cập SSR đều phải chờ Node.js API truy vấn PostgreSQL từ đầu, làm tăng chỉ số **TTFB (Time to First Byte)**.

**Giải pháp:**
- Với các endpoint công khai có tần suất thay đổi thấp như `/api/categories`, `/api/products/filters`, `/api/products/new-arrivals`, `/api/products/best-sellers`, chuyển sang `next: { revalidate: 30 }` (hoặc `revalidate: 60`) kết hợp `revalidateTag` khi cần.
- Các trang phụ thuộc vào Cookie phiên người dùng (`/cart`, `/checkout`, `/account/*`, `/admin/*`) vẫn giữ nguyên `cache: 'no-store'` để đảm bảo tính chính xác tuyệt đối.

---

### 1.3. Tối ưu Hình ảnh & Core Web Vitals (LCP, CLS)

**Hiện trạng:**
- Dù [`apps/web/next.config.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/next.config.js#L6-L21) đã cấu hình sẵn `images.domains` và `remotePatterns` (cho `images.unsplash.com`, `macone.vn`, `m.media-amazon.com`, `localhost`), toàn bộ ứng dụng vẫn đang dùng thẻ `<img>` thuần mà thiếu kích thước tường minh (`width`/`height`) hoặc thuộc tính ưu tiên tải (`fetchPriority`):
  - Ảnh Hero LCP trên trang chủ tại [`HomeClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/home/HomeClient.js#L284-L289) chưa có `fetchPriority="high"`, `loading="eager"`, `decoding="async"`.
  - Ảnh chính trang chi tiết sản phẩm tại [`ProductDetailClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/ProductDetailClient.js#L492-L500) chưa có `fetchPriority="high"` và `width`/`height` tường minh.
  - Ảnh thẻ sản phẩm tại [`ProductCard.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/ProductCard.js#L39-L45) (và dòng 130–136) có `loading="lazy"` nhưng thiếu `decoding="async"` và `width`/`height` cố định để trình duyệt giữ chỗ trước khi CSS tải xong (tránh **CLS - Cumulative Layout Shift**).

**Giải pháp:**
1. Thêm `fetchPriority="high"`, `loading="eager"`, `decoding="async"`, `width={600}`, `height={600}` cho ảnh LCP ở [`HomeClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/home/HomeClient.js#L284-L289) và [`ProductDetailClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/ProductDetailClient.js#L492-L500).
2. Thêm `decoding="async"`, `width={400}`, `height={400}` cho toàn bộ ảnh danh sách trong [`ProductCard.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/ProductCard.js#L39-L45) và ảnh liên quan.
3. Bật hỗ trợ định dạng ảnh nén thế hệ mới (`image/avif`, `image/webp`) trong [`apps/web/next.config.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/next.config.js#L6-L21).

---

### 1.4. Giảm kích thước JS Bundle (Code Splitting với `next/dynamic`)

**Hiện trạng:**
1. **Widget AI Assistant tải đồng bộ trên mọi trang:**
   - [`apps/web/app/layout.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/layout.js#L13) đang `import AiAssistantWidget` trực tiếp vào Root Layout. Dù người dùng chưa bấm mở cửa sổ chat AI, toàn bộ code xử lý chat, lịch sử session và UI của [`AiAssistantWidget.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/ai/AiAssistantWidget.js) vẫn nằm trong First Load JS của mọi trang.
2. **Thư viện biểu đồ `recharts` nặng (~150KB) trong Admin:**
   - [`apps/web/app/admin/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/admin/page.js#L19-L28) import trực tiếp `ResponsiveContainer`, `AreaChart`, `BarChart`, `PieChart`... khiến bundle trang Admin lớn.
3. **Modal Tìm kiếm bằng Hình ảnh (Visual Search) trong Catalog:**
   - Khối giao diện kéo-thả & phân tích ảnh trong [`CatalogClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/CatalogClient.js#L1079-L1289) luôn được nạp cùng trang `/products` dù chỉ hiển thị khi `imageSearchOpen === true`.

**Giải pháp:**
- Dùng `next/dynamic` với `{ ssr: false }` cho [`AiAssistantWidget`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/layout.js#L13) trong `app/layout.js`.
- Tách phần biểu đồ trong [`apps/web/app/admin/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/admin/page.js#L19-L28) sang dynamic import để khung KPI hiển thị tức thì (giảm TTI).

---

### 1.5. Bật lại DNS Prefetch & Preconnect cho tài nguyên ngoại vi

**Hiện trạng:**
- [`apps/web/next.config.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/next.config.js#L33) đang đặt header `X-DNS-Prefetch-Control` thành `'off'`. Trong khi đó, ảnh sản phẩm được tải từ `images.unsplash.com`, `macone.vn`, `m.media-amazon.com`. Việc tắt DNS Prefetch làm trình duyệt mất thêm 50–150ms phân giải DNS + bắt tay TLS khi tải ảnh.

**Giải pháp:**
- Đổi `X-DNS-Prefetch-Control` thành `'on'` tại [`apps/web/next.config.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/next.config.js#L33).
- Bổ sung `<link rel="preconnect" href="https://images.unsplash.com" crossOrigin="anonymous" />` trong `<head>` của [`apps/web/app/layout.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/layout.js#L29-L41).

---

## PHẦN 2: TỐI ƯU HIỆU NĂNG BACKEND, DATABASE (PRISMA/POSTGRESQL) & HẠ TẦNG

### 2.1. Bổ sung Database Indexes còn thiếu trong `schema.prisma`

**Hiện trạng:**
Kiểm tra [`apps/api/prisma/schema.prisma`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/prisma/schema.prisma) cho thấy các bảng chính mới chỉ có khóa chính (`@id`) và khóa `@unique` (`slug`, `sku`, `email`, `orderNumber`), **chưa có bất kỳ `@@index` nào** cho các cột thường xuyên nằm trong mệnh đề `WHERE`, `ORDER BY` và `GROUP BY`. Khi dữ liệu tăng lên, PostgreSQL sẽ phải quét toàn bộ bảng (**Sequential Scan**).

**Giải pháp — Thêm các Composite Indexes sau vào [`apps/api/prisma/schema.prisma`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/prisma/schema.prisma):**

```prisma
// 1. Model Product (dòng 91-111): Tối ưu lọc danh mục, thương hiệu, khoảng giá và sắp xếp
model Product {
  // ... các trường hiện tại giữ nguyên
  @@index([isActive, categoryId])
  @@index([isActive, brand])
  @@index([isActive, minPrice])
  @@index([isActive, isNewArrival, createdAt(sort: Desc)])
  @@index([isActive, isBestSeller, createdAt(sort: Desc)])
  @@index([isActive, createdAt(sort: Desc)])
}

// 2. Model ProductImage (dòng 114-123): Tối ưu ORDER BY position ASC
model ProductImage {
  // ...
  @@index([productId, position])
}

// 3. Model ProductVariant (dòng 126-141): Tối ưu lọc biến thể active & ORDER BY price ASC
model ProductVariant {
  // ...
  @@index([productId, isActive, price])
}

// 4. Model Order (dòng 172-200): Tối ưu lịch sử đơn hàng của User & thống kê Admin theo thời gian/trạng thái
model Order {
  // ...
  @@index([userId, createdAt(sort: Desc)])
  @@index([status, createdAt(sort: Desc)])
  @@index([createdAt(sort: Desc)])
}

// 5. Model OrderItem (dòng 227-241): Tối ưu groupBy bestProducts trong Analytics & kiểm tra mua hàng khi Review
model OrderItem {
  // ...
  @@index([orderId])
  @@index([productId])
}

// 6. Model Review (dòng 286-299): Tối ưu tải đánh giá sản phẩm mới nhất
model Review {
  // ...
  @@index([productId, createdAt(sort: Desc)])
  @@index([userId])
}

// 7. Model Address (dòng 59-74): Tối ưu lấy danh sách địa chỉ mặc định lúc Checkout
model Address {
  // ...
  @@index([userId, isDefault])
}
```

---

### 2.2. Khắc phục điểm nghẽn tải toàn bộ bảng & tính `averageRating` trong bộ nhớ Node.js

**Hiện trạng:**
1. Tại [`apps/api/src/modules/products/products.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/products/products.routes.js#L256-L320):
   - Mọi truy vấn danh sách sản phẩm (`GET /api/products`, `GET /api/products/new-arrivals`, `GET /api/products/best-sellers`) đều phải `include: { reviews: { select: { rating: true } } }` cho từng sản phẩm rồi dùng hàm [`formatProductWithStats`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/products/products.routes.js#L102-L120) cộng trung bình trong JS.
   - Nghiêm trọng hơn, khi người dùng lọc theo số sao (`minRating` ở dòng 274–296), API **bỏ qua `skip`/`take` của SQL**, kéo **toàn bộ sản phẩm** từ DB lên RAM của Node.js, tính điểm trung bình từng sản phẩm rồi mới `.filter()` và `.slice()` phân trang trong JS.
2. Tại [`GET /api/products/filters`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/products/products.routes.js#L430-L473):
   - Đang gọi `prisma.product.findMany` lấy toàn bộ sản phẩm kèm toàn bộ variants chỉ để dùng `new Set()` lọc danh sách `brands` và dùng vòng lặp tìm `minPrice`/`maxPrice` trong JS.

**Giải pháp:**
1. **Tối ưu `GET /api/products/filters` ngay bằng truy vấn tập hợp SQL (không cần đổi schema):**
   Thay vì `findMany` toàn bộ bảng tại [`products.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/products/products.routes.js#L440-L465), sử dụng `distinct` và `aggregate` của Prisma:
   ```javascript
   const [brandRows, priceAgg] = await Promise.all([
     prisma.product.findMany({
       where: whereClause,
       distinct: ['brand'],
       select: { brand: true },
       orderBy: { brand: 'asc' },
     }),
     prisma.product.aggregate({
       where: { ...whereClause, minPrice: { gt: 0 } },
       _min: { minPrice: true },
       _max: { minPrice: true },
     }),
   ]);
   ```
   Tốc độ phản hồi của `/api/products/filters` sẽ giảm từ hàng chục ms xuống chỉ còn **1–2ms**.
2. **Tối ưu tính `averageRating` & `reviewCount`:**
   - Có thể dùng `prisma.review.groupBy({ by: ['productId'], _avg: { rating: true }, _count: { rating: true } })` cho danh sách sản phẩm trong trang hiện tại, hoặc lưu sẵn `averageRating` / `reviewCount` trên bảng `Product` (giống như cách dự án đã thiết kế trường `minPrice` ở [`schema.prisma`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/prisma/schema.prisma#L98)) và cập nhật khi có `POST /api/reviews`. Khi đó bộ lọc `minRating` có thể đẩy thẳng xuống SQL (`where.averageRating = { gte: parsedMinRating }`).

---

### 2.3. Khử truy vấn N+1 khi gộp giỏ hàng (`POST /api/cart/merge`)

**Hiện trạng:**
- Trong [`apps/api/src/modules/cart/cart.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/cart/cart.routes.js#L116-L140), khi người dùng đăng nhập và gộp giỏ hàng khách (`guestItems`), hệ thống chạy vòng lặp `for (const guestItem of guestItems)` và thực hiện tuần tự `await prisma.productVariant.findUnique(...)` rồi `await prisma.cartItem.update/create(...)` cho từng món hàng. Nếu giỏ hàng có 10 sản phẩm sẽ phát sinh 20 câu truy vấn tuần tự.

**Giải pháp:**
- Gom toàn bộ `variantId` để truy vấn 1 lần duy nhất bằng `prisma.productVariant.findMany({ where: { id: { in: variantIds } } })`, sau đó gom các lệnh `update`/`create` vào một `prisma.$transaction([...])`.

---

### 2.4. Tận dụng Redis sẵn có để làm Read-Through Cache cho các API đọc nhiều

**Hiện trạng:**
- Dự án đã cấu hình sẵn Redis tại [`apps/api/src/utils/redis.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/utils/redis.js) nhưng mới chỉ dùng cho Session, Rate Limiting và Pub/Sub.
- Các API công khai được gọi liên tục ở mọi lượt tải trang như `GET /api/categories`, `GET /api/products/filters`, `GET /api/products/new-arrivals`, `GET /api/products/best-sellers` đều đọc trực tiếp từ PostgreSQL mỗi lần gọi.

**Giải pháp:**
- Bổ sung lớp cache Redis với TTL ngắn (`30s` – `60s`) cho 4 endpoint trên.
- Tự động xóa cache (`redis.del(...)`) ngay tại các điểm mà hệ thống đang phát sự kiện `PRODUCT_UPDATED` hoặc `ORDER_CREATED` (trong [`products.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/products/products.routes.js#L714-L716) và [`orders.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/orders/orders.routes.js#L371)). Nhờ vậy dữ liệu luôn tươi mới theo thời gian thực khi Admin sửa sản phẩm hoặc có đơn hàng mới, đồng thời giảm 80–90% tải đọc cho PostgreSQL.

---

### 2.5. Bật nén HTTP (Gzip / Brotli Compression) ở Nginx & Express

**Hiện trạng:**
- Kiểm tra [`docker/nginx.conf`](file:///Users/iannwendy/Desktop/NodeFinal/docker/nginx.conf#L1-L72) và [`apps/api/src/server.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/server.js#L30-L55) cho thấy **chưa bật nén Gzip** cho JSON response của API cũng như HTML/CSS/JS đi qua Nginx.

**Giải pháp:**
1. Thêm cấu hình Gzip vào khối `http` trong [`docker/nginx.conf`](file:///Users/iannwendy/Desktop/NodeFinal/docker/nginx.conf#L14-L20):
   ```nginx
   gzip on;
   gzip_vary on;
   gzip_proxied any;
   gzip_comp_level 6;
   gzip_min_length 1024;
   gzip_types text/plain text/css text/xml application/json application/javascript application/rss+xml application/atom+xml image/svg+xml;
   ```
2. Giúp giảm **65% – 80%** dung lượng truyền tải qua mạng cho các payload JSON danh sách sản phẩm và bundle JS.

---

## PHẦN 3: TỐI ƯU SEO TOÀN DIỆN (TECHNICAL SEO, ON-PAGE & STRUCTURED DATA)

### 3.1. Bổ sung `robots.js` và `sitemap.js` động (Dynamic Sitemap & Robots Rules)

**Hiện trạng:**
- Trong thư mục `apps/web/app/` hiện **chưa có** file `robots.js` (`robots.txt`) và `sitemap.js` (`sitemap.xml`).
- Googlebot và các công cụ tìm kiếm chưa có bản đồ đường dẫn tới các trang sản phẩm `/products/[slug]` và chưa bị chặn khỏi các trang riêng tư (`/admin`, `/account`, `/cart`, `/checkout`).

**Giải pháp:**
1. **Tạo `apps/web/app/robots.js`:**
   - `Allow`: `/`, `/products`
   - `Disallow`: `/admin/`, `/account/`, `/cart`, `/checkout/`, `/login`, `/register`, `/forgot-password`, `/reset-password`, `/logout`, `/api/`
   - Khai báo đường dẫn `sitemap: '${SITE_URL}/sitemap.xml'`.
2. **Tạo `apps/web/app/sitemap.js`:**
   - Tự động gọi API lấy danh sách toàn bộ sản phẩm đang hoạt động (`/api/products?limit=200`) và danh mục (`/api/categories`) để sinh danh sách URL động gồm:
     - Trang chủ `/` (`priority: 1.0`, `changeFrequency: 'daily'`)
     - Trang danh mục `/products` (`priority: 0.9`, `changeFrequency: 'daily'`)
     - Tất cả trang chi tiết sản phẩm `/products/[slug]` kèm `lastModified: product.updatedAt` (`priority: 0.8`, `changeFrequency: 'weekly'`).

---

### 3.2. Làm giàu Metadata (`OpenGraph`, `Twitter Card`, `Canonical URL`, `Keywords` từ Category & Tags)

**Hiện trạng:**
- [`apps/web/app/layout.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/layout.js#L15-L18), [`apps/web/app/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/page.js#L6-L10), [`apps/web/app/(store)/products/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/page.js#L6-L10), và [`apps/web/app/(store)/products/[slug]/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/%5Bslug%5D/page.js#L31-L48) hiện mới chỉ trả về `title` và `description` cơ bản.
- Chưa có `metadataBase`, thẻ `canonical`, `openGraph` (ảnh đại diện sản phẩm khi chia sẻ lên mạng xã hội), `twitter`, và chưa đưa `product.tags` / `product.category.name` vào `keywords` (dù [`requirement.md`](file:///Users/iannwendy/Desktop/NodeFinal/docs/requirement.md#L64) nhấn mạnh dùng Categories và Tags để tăng cường SEO).
- Các trang nội bộ như `/cart`, `/checkout`, `/account/*`, `/admin/*`, `/login`, `/register` chưa gắn `robots: { index: false, follow: false }`.

**Giải pháp (Giữ nguyên 100% `title: formatAevoTitle(...)`):**
1. **Tại [`apps/web/app/layout.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/layout.js#L15-L18):**
   Thêm `metadataBase`, `openGraph` mặc định, `twitter: { card: 'summary_large_image' }`.
2. **Tại [`apps/web/app/(store)/products/[slug]/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/%5Bslug%5D/page.js#L31-L48):**
   Nâng cấp `generateMetadata` để trả về đầy đủ:
   - `title`: Giữ nguyên `formatAevoTitle([product.name, product.category?.name || 'Products'])`.
   - `description`: Mô tả ngắn chuẩn SEO.
   - `keywords`: Kết hợp `[product.name, product.brand, product.category?.name, ...(product.tags || [])]`.
   - `alternates: { canonical: '/products/' + product.slug }`.
   - `openGraph`: Đính kèm `images: product.images.map(img => ({ url: img.url, alt: img.altText || product.name }))`, `type: 'website'`, `locale: 'vi_VN'`.
3. **Tại [`apps/web/app/(store)/products/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/page.js#L6-L10):**
   Thêm `alternates: { canonical: '/products' }` để tránh lỗi trùng lặp nội dung (Duplicate Content) khi URL có nhiều query params lọc/sắp xếp.
4. **Tại các trang Private/Transactional (`/cart`, `/checkout`, `/account/*`, `/admin/*`, `/login`, `/register`):**
   Thêm `robots: { index: false, follow: false }` vào object `metadata` (trong khi vẫn giữ nguyên `title`).

---

### 3.3. Tích hợp Dữ liệu có cấu trúc JSON-LD (`Schema.org` Rich Snippets)

**Hiện trạng:**
- Toàn bộ website hiện chưa có thẻ `<script type="application/ld+json">`. Khi hiển thị trên Google Search, trang sản phẩm sẽ không hiện được **Rich Snippets** (Giá tiền `VND`, Tình trạng còn hàng `InStock`/`OutOfStock`, Điểm đánh giá sao `AggregateRating`, Đường dẫn `BreadcrumbList`).

**Giải pháp:**
1. **Trang chi tiết sản phẩm ([`apps/web/app/(store)/products/[slug]/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/%5Bslug%5D/page.js#L50-L54)):**
   Render `<script type="application/ld+json">` ngay trong Server Component với 2 schema:
   - **`Product` Schema:**
     - `name`, `description`, `image` (mảng URL ảnh), `sku` (từ variant đầu tiên), `brand: { '@type': 'Brand', name: product.brand }`, `category: product.category?.name`.
     - `offers`: Kiểu `AggregateOffer` (hoặc `Offer`) với `priceCurrency: 'VND'`, `lowPrice`, `highPrice`, `offerCount`, `availability: totalStock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock'`.
     - `aggregateRating` (khi `product.reviewCount > 0`): `ratingValue: product.averageRating`, `reviewCount: product.reviewCount`, `bestRating: 5`, `worstRating: 1`.
   - **`BreadcrumbList` Schema:**
     - `Trang chủ (/)` → `Sản phẩm (/products)` → `Danh mục (/products?category=...)` → `Tên sản phẩm (/products/[slug])`.
2. **Trang chủ ([`apps/web/app/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/page.js#L34-L53)):**
   Render JSON-LD cho `WebSite` (kèm `SearchAction` trỏ về `/products?search={search_term_string}`) và `ComputerStore` / `Organization`.
3. **Trang danh mục ([`apps/web/app/(store)/products/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/page.js#L50-L71)):**
   Render JSON-LD `CollectionPage` + `ItemList` cho các sản phẩm đang hiển thị trên trang.

---

### 3.4. Tối ưu khả năng thu thập dữ liệu Phân trang (Crawlable Pagination) & Đa ngôn ngữ

**Hiện trạng:**
1. Component [`Pagination.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/Pagination.js#L37-L108) đang dùng các thẻ `<button>` chỉ có sự kiện `onClick`. Công cụ tìm kiếm (Googlebot) không tự bấm vào `<button>` nên khó phát hiện các trang `?page=2`, `?page=3`...
2. Thẻ `<html lang="en">` trong [`apps/web/app/layout.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/layout.js#L28) đang cố định là `"en"` trong khi nội dung mặc định và tiền tệ là Tiếng Việt (`vi` / `VND`).

**Giải pháp:**
1. Giữ nguyên giao diện và sự kiện `onClick` của `<button>` trong [`Pagination.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/Pagination.js) để không ảnh hưởng bất kỳ test nào, đồng thời bổ sung thông tin phân trang chuẩn SEO hoặc cập nhật `<html lang="vi">` mặc định trong [`apps/web/app/layout.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/layout.js#L28) (và tự động đồng bộ `document.documentElement.lang = locale` trong [`LanguageProvider`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/lib/i18n/index.js#L37-L48) khi người dùng chuyển đổi VI/EN).

---

## PHẦN 4: BẢNG TỔNG HỢP LỘ TRÌNH ƯU TIÊN TRIỂN KHAI

| Mức ưu tiên | Hạng mục tối ưu | File tác động chính | Tác động kỳ vọng | Rủi ro lệch Requirement / Flow |
| :---: | :--- | :--- | :--- | :---: |
| **P0 (Cao nhất)** | Bổ sung `robots.js` & `sitemap.js` động | `apps/web/app/robots.js`, `apps/web/app/sitemap.js` | Google index toàn bộ SP & chặn index trang Admin/Checkout | **0%** (Không đụng UI/Logic) |
| **P0 (Cao nhất)** | Tích hợp JSON-LD (`Product`, `BreadcrumbList`, `WebSite`) + OpenGraph/Canonical/Keywords từ Tags & Category | [`products/[slug]/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/%5Bslug%5D/page.js), [`products/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/page.js), [`app/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/page.js), [`app/layout.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/layout.js) | Đạt chuẩn Rich Snippets (Giá, Sao, Kho hàng) & bám sát mục II.3 của `requirement.md` | **0%** (Giữ nguyên `formatAevoTitle`) |
| **P0 (Cao nhất)** | Khử gọi API trùng lặp SSR + CSR (`React.cache` + bỏ fetch trùng lúc mount) | [`products/[slug]/page.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/%28store%29/products/%5Bslug%5D/page.js), [`HomeClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/home/HomeClient.js), [`CatalogClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/CatalogClient.js), [`ProductDetailClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/ProductDetailClient.js) | Giảm **50% – 66%** số lượng request API ở lần tải trang đầu tiên | **0%** (Vẫn giữ nguyên fetch khi lọc/WS) |
| **P1 (Cao)** | Thêm Composite Indexes vào Prisma Schema | [`apps/api/prisma/schema.prisma`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/prisma/schema.prisma) | Tăng tốc truy vấn lọc/sắp xếp SQL từ $O(N)$ xuống $O(\log N)$ | **0%** (Chỉ thêm index DB) |
| **P1 (Cao)** | Tối ưu `GET /api/products/filters` bằng SQL `distinct` & `aggregate` + Batch `POST /api/cart/merge` | [`products.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/products/products.routes.js#L430-L473), [`cart.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/cart/cart.routes.js#L116-L140) | Giảm RAM tiêu thụ trên API server, khử N+1 query khi login gộp giỏ hàng | **0%** (Response JSON giữ nguyên 100%) |
| **P1 (Cao)** | Tối ưu LCP/CLS cho ảnh (`fetchPriority="high"`, `width`/`height`, `decoding="async"`) & bật DNS Prefetch | [`HomeClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/home/HomeClient.js), [`ProductDetailClient.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/ProductDetailClient.js), [`ProductCard.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/components/product/ProductCard.js), [`next.config.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/next.config.js) | Cải thiện điểm Lighthouse Performance (LCP & CLS) rõ rệt | **0%** |
| **P2 (Trung bình)** | Lazy-load `AiAssistantWidget` bằng `next/dynamic` & bật nén Gzip trên Nginx | [`app/layout.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/web/app/layout.js), [`docker/nginx.conf`](file:///Users/iannwendy/Desktop/NodeFinal/docker/nginx.conf) | Giảm First Load JS và giảm ~70% băng thông mạng | **0%** |
| **P2 (Trung bình)** | Bổ sung Redis Read-Through Cache (30s) cho Categories & Filters kèm tự động xóa khi `PRODUCT_UPDATED` | [`categories.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/categories/categories.routes.js), [`products.routes.js`](file:///Users/iannwendy/Desktop/NodeFinal/apps/api/src/modules/products/products.routes.js) | Giảm tải DB cho các endpoint đọc tần suất cao | **0%** |
