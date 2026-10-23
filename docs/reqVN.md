LẬP TRÌNH WEB VỚI NODE.JS - 502070  
HỌC KỲ 2 – NĂM HỌC 2024 – 2025  
Giảng viên: Mai Van Manh

# ĐỒ ÁN CUỐI KỲ

# Website thương mại điện tử

Đối với nội dung được tô màu tím, sinh viên phải tuân thủ nghiêm ngặt các mô tả được đưa ra. Bất kỳ sự sai lệch, chỉnh sửa hoặc bổ sung chức năng nào đều sẽ khiến bài nộp bị loại khỏi quá trình đánh giá.

## I. TỔNG QUAN

Đồ án cuối kỳ của môn học này yêu cầu phát triển một website thương mại điện tử có đầy đủ chức năng. Đồ án sẽ kiểm tra kiến thức phát triển web của bạn bằng Node.js ở phía backend, cùng với bất kỳ framework frontend nào bạn lựa chọn. Đồ án được thực hiện theo nhóm 2–3 thành viên. Mỗi nhóm được yêu cầu thiết kế, triển khai và đưa vào vận hành một ứng dụng thương mại điện tử bao gồm các chức năng thiết yếu như xác thực người dùng, quản lý sản phẩm và hệ thống đặt hàng. Bạn được tự do lựa chọn các thư viện và công cụ hỗ trợ để nâng cao chức năng của ứng dụng, nhưng backend cốt lõi phải được phát triển bằng framework Node.js như Express.js. Để ngăn chặn gian lận, bạn bắt buộc phải phát triển website chỉ bán máy tính và linh kiện máy tính. Việc bán điện thoại hoặc bất kỳ sản phẩm nào khác đều bị nghiêm cấm, và mọi hành vi vi phạm quy định này sẽ khiến toàn bộ đồ án bị chấm 0 điểm. Bạn cũng cần triển khai ứng dụng lên một dịch vụ hosting công khai (ví dụ: Heroku, Vercel, AWS, v.v.) hoặc thay vào đó đóng gói dự án bằng Docker Compose và cung cấp các cấu hình Docker cần thiết để có thể chạy cục bộ trên bất kỳ máy tính nào.

## II. YÊU CẦU ĐỒ ÁN

### 1. Trang đích (trang chủ)

- Đây là trang đầu tiên người dùng nhìn thấy khi truy cập website. Website phải hiển thị các sản phẩm thuộc nhóm “Sản phẩm mới”, “Bán chạy nhất” và ít nhất ba danh mục riêng biệt khác (ví dụ: laptop, màn hình, ổ cứng). Người dùng không bắt buộc phải đăng nhập để xem và mua sản phẩm.
- Website phải cho phép người dùng mua hàng mà không cần đăng nhập. Nếu họ mua hàng khi chưa đăng nhập, hệ thống sẽ tự động tạo tài khoản cho người dùng (nếu chưa có), lưu thông tin đơn hàng; và trong tương lai, khi khách hàng đăng nhập, họ có thể xem lại các đơn hàng trước đó.
- Nếu khách hàng mua hàng sau khi đăng nhập, địa chỉ mặc định (nếu có) sẽ được điền sẵn ở phần thanh toán. Ngoài ra, người dùng cũng có thể thay đổi sang địa chỉ giao hàng khác nếu muốn.
- Để đơn giản hóa, hệ thống chỉ cần hỗ trợ hai loại người dùng: khách hàng và một quản trị viên duy nhất.

### 2. Quản lý người dùng

- Đăng ký và đăng nhập: Cho phép người dùng tạo tài khoản, đăng nhập và quản lý hồ sơ. Khi tạo tài khoản, người dùng chỉ nhập email, họ tên đầy đủ và địa chỉ giao hàng.
- Xác thực qua mạng xã hội: Người dùng có thể đăng nhập bằng bất kỳ tài khoản mạng xã hội nào, ví dụ Google hoặc Facebook, v.v., để thuận tiện.
- Quản lý hồ sơ: Người dùng có thể cập nhật thông tin cá nhân, thay đổi/khôi phục mật khẩu và quản lý nhiều địa chỉ giao hàng cho mỗi địa chỉ giao hàng.

### 3. Quản lý sản phẩm

- Danh mục sản phẩm: Một trang riêng (không phải trang chủ) hiển thị danh sách sản phẩm với thông tin cơ bản như tên, giá, hình ảnh và mô tả ngắn (dạng danh sách hoặc dạng lưới), có cơ chế phân trang để giới hạn số sản phẩm hiển thị cùng lúc. Sắp xếp sản phẩm thành các danh mục và thẻ để cải thiện điều hướng và SEO. Chức năng phân trang phải hoạt động ở mọi nơi có hiển thị danh sách sản phẩm. Phải hiển thị số trang, kể cả khi chỉ có một trang. Khi trình diễn, nếu website không có đủ dữ liệu để thể hiện chức năng “phân trang”, hệ thống sẽ bị xem là không có chức năng này.

- Trang chi tiết sản phẩm phải hiển thị thông tin đầy đủ về một sản phẩm cụ thể, bao gồm tên, giá, thương hiệu, danh sách các biến thể (nếu có), mô tả ngắn ít nhất năm dòng và tối thiểu ba hình ảnh minh họa. Bên dưới thông tin sản phẩm phải có phần bình luận và đánh giá sao của người dùng. Website phải hỗ trợ sản phẩm có nhiều biến thể, với tồn kho được theo dõi độc lập cho từng biến thể. Để đạt điểm tối đa cho mục này, mỗi sản phẩm phải có ít nhất hai biến thể.
- Sắp xếp sản phẩm: Sắp xếp danh sách kết quả (sản phẩm) theo một số tiêu chí như giá (tăng dần/giảm dần), mức độ liên quan, v.v. Để đạt điểm tối đa cho mục này, website phải cung cấp ít nhất bốn tiêu chí sắp xếp, bao gồm: sắp xếp theo tên (A–Z và Z–A) và theo giá (tăng dần và giảm dần).
- Tìm kiếm và lọc sản phẩm: Người dùng có thể tìm kiếm sản phẩm và lọc kết quả theo các thuộc tính như giá, danh mục hoặc đánh giá. Để đạt điểm tối đa cho mục lọc, website phải có ít nhất ba tiêu chí lọc, trong đó bắt buộc có bộ lọc theo thương hiệu và theo giá (cho phép chọn giá trị tối thiểu và tối đa).
- Nhận xét và đánh giá sản phẩm: Người dùng không bắt buộc đăng nhập để bình luận, nhưng phải đăng nhập (không cần mua hàng) để đánh giá sản phẩm bằng sao. Nếu có thể, hãy sử dụng websocket để triển khai chức năng xem các bình luận và đánh giá được cập nhật mà không cần tải lại trang chi tiết sản phẩm.

### 4. Giỏ hàng và thanh toán

- Thêm vào giỏ hàng: Cho phép người dùng thêm sản phẩm vào giỏ hàng, cập nhật số lượng hoặc xóa sản phẩm. Website phải cho phép người dùng chỉnh sửa giỏ hàng và nhận cập nhật theo thời gian thực (ví dụ: thay đổi số lượng và giá tiền) mà không cần tải lại trang.
- Tóm tắt giỏ hàng: Hiển thị thông tin tóm tắt các sản phẩm trong giỏ, bao gồm tổng giá, thuế và phí vận chuyển.
- Quy trình thanh toán: Hướng dẫn người dùng qua quy trình nhiều bước để nhập thông tin thanh toán, giao hàng và xác nhận đơn hàng.
- Thanh toán với tư cách khách: Cho phép người dùng hoàn tất việc mua hàng mà không cần tạo tài khoản.
- Mã giảm giá: Website phải cho phép người dùng nhập mã giảm giá khi thanh toán. Các mã này phải là chuỗi 5 ký tự gồm chữ cái và chữ số do quản trị viên tạo. Mã giảm giá không có ngày hết hạn nhưng có giới hạn số lần sử dụng do quản trị viên xác định, tối đa 10 lần cho mỗi mã. Người mua phải có thể xem mã giảm giá có hợp lệ hay không và tác dụng của mã (nếu có) trước khi hoàn tất thanh toán.

### 5. Quản lý đơn hàng

Trang 3 / 13

- Tạo đơn hàng: Sau khi thanh toán thành công, phải tạo bản ghi đơn hàng và liên kết với tài khoản người dùng. Sau khi giao dịch mua hàng hoàn tất, người dùng phải thấy màn hình thành công hiển thị tất cả thông tin liên quan đến đơn hàng vừa đặt. Ngoài ra, người dùng phải nhận email xác nhận kèm chi tiết đơn hàng.
- Theo dõi đơn hàng: Cho phép người dùng theo dõi trạng thái đơn hàng (ví dụ: đang chờ, đã xác nhận, đang vận chuyển, đã giao). Bên cạnh trạng thái hiện tại, khách hàng còn phải xem được lịch sử các trạng thái của đơn hàng. Có thể trình bày dưới dạng bảng liệt kê tất cả trạng thái và thời điểm cập nhật tương ứng, sắp xếp theo thời gian giảm dần, trạng thái mới nhất nằm trên cùng.
- Lịch sử đơn hàng: Website phải hiển thị các đơn hàng trước đây của người dùng, bao gồm các thông tin như mã đơn hàng, ngày mua, tổng tiền, trạng thái và danh sách sản phẩm cùng số lượng tương ứng của mỗi đơn.
- Chương trình khách hàng thân thiết: Cần triển khai hệ thống tích điểm, theo đó khách hàng nhận được số điểm tương ứng với 10% tổng giá trị đơn hàng cho mỗi lần mua. Ví dụ, với đơn hàng tổng cộng 1.000.000 VND, khách hàng sẽ tích lũy 100 điểm, tương đương 100.000 VND. Điểm này có thể sử dụng ngay cho đơn hàng tiếp theo, không có hạn chế bổ sung nào.

### 6. Quản lý quản trị viên

- Bảng điều khiển:
  - Bảng điều khiển cơ bản: Tổng quan cấp cao về hiệu quả hoạt động của cửa hàng, các chỉ số quan trọng và thông tin hữu ích có thể hành động. Bao gồm các nội dung như: tổng số người dùng, số người dùng mới, số đơn hàng, doanh thu và các sản phẩm bán chạy nhất được thể hiện bằng biểu đồ.
  - Bảng điều khiển nâng cao: Hiển thị thống kê và các biểu đồ liên quan cho những thông tin quan trọng theo các khoảng thời gian cụ thể. Mặc định dữ liệu được hiển thị theo năm, nhưng người dùng có thể điều chỉnh chế độ xem theo quý, tháng, tuần hoặc theo ngày bắt đầu và ngày kết thúc tự chọn. Ở mỗi khoảng thời gian, cần theo dõi số đơn hàng đã bán, tổng doanh thu và tổng lợi nhuận. Ngoài ra, phải có biểu đồ so sánh doanh thu, lợi nhuận, số lượng sản phẩm và loại sản phẩm đã bán, phân chia theo năm, tháng, quý và tuần.
- Quản lý sản phẩm: Quản trị viên có thể thêm, cập nhật hoặc xóa sản phẩm, quản lý danh mục và xử lý tồn kho từ một bảng điều khiển tập trung.
- Quản lý người dùng: Quản trị viên có thể xem và quản lý tất cả người dùng, bao gồm cấm hoặc cập nhật thông tin người dùng.
- Quản lý đơn hàng: Quản trị viên có thể xem, cập nhật và xử lý đơn hàng (ví dụ: chuyển trạng thái từ đang chờ sang đã xác nhận).

Trang 4 / 13

- Xem danh sách đơn hàng: Quản trị viên có thể xem danh sách đơn hàng trên toàn hệ thống, được sắp xếp để các đơn hàng mới nhất xuất hiện trước. Phải áp dụng phân trang, hiển thị khoảng 20 mục mỗi trang. Giao diện này cũng phải cho phép quản trị viên lọc đơn hàng theo các khoảng thời gian khác nhau, chẳng hạn: hôm nay, hôm qua, tuần này, tháng này hoặc khoảng ngày cụ thể (bắt đầu–kết thúc).
- Xem chi tiết đơn hàng: Quản trị viên có thể chọn một đơn hàng để xem thông tin chi tiết (như tên người mua, thời gian mua, tổng tiền, có áp dụng giảm giá hay không, v.v.) cùng danh sách sản phẩm trong đơn. Ngoài ra, quản trị viên cũng có thể thay đổi trạng thái đơn hàng (ví dụ: từ đang chờ sang đã xác nhận).
- Quản lý mã giảm giá: Quản trị viên phải có khả năng xem danh sách mã giảm giá với các thông tin liên quan, bao gồm thời gian tạo, giá trị giảm giá, số lần mã đã được sử dụng trên tổng số lần tối đa được phép và danh sách đơn hàng đã áp dụng mã. Ngoài ra, quản trị viên phải có thể tạo mã giảm giá mới.
- Ngoài những chức năng được đề cập ở trên, bạn không được thêm bất kỳ chức năng nào khác cho quản trị viên.

### 7. Triển khai

Bạn bắt buộc phải chọn một trong hai phương pháp dưới đây để triển khai đồ án của nhóm. Hoàn thành yêu cầu này không được cộng thêm điểm, nhưng không thực hiện sẽ bị trừ điểm: trừ 1,0 điểm nếu tổng điểm từ 8,5 trở lên, và trừ 0,5 điểm nếu tổng điểm dưới 8,5:

### 1. Hosting công khai:

- Website phải được triển khai trên một nền tảng cloud hosting công khai bất kỳ (ví dụ: Heroku, Vercel, AWS, Netlify).
- Cung cấp URL công khai để truy cập đồ án.
- Đảm bảo website hoạt động bình thường giống như trong môi trường cục bộ, vì đây sẽ là cơ sở để đánh giá điểm. Đừng quên cung cấp tên đăng nhập/mật khẩu của tài khoản quản trị viên.

### 2. Docker Compose:

- Nếu không triển khai lên dịch vụ hosting trực tuyến, bạn phải đóng gói ứng dụng bằng Docker Compose.
- Mỗi thành phần (frontend, backend, cơ sở dữ liệu, v.v.) phải nằm trong các container riêng biệt.
- Cung cấp tệp docker-compose.yml với hướng dẫn rõ ràng để chạy đồ án cục bộ.
- Đảm bảo đã kiểm thử cấu hình Docker Compose này và nó hoạt động đúng trước khi nộp. Sinh viên phải đảm bảo giảng viên có thể chạy đồ án chỉ bằng lệnh “docker compose up -d”. Những lệnh khác như “npm install” phải được cấu hình sẵn trong tệp YAML của Docker Compose hoặc Dockerfile.

### 8. Các yêu cầu khác

Trang 5 / 13

- UI/UX: Ứng dụng web phải có thiết kế rõ ràng, thân thiện với người dùng và điều hướng trực quan. Tập trung vào trải nghiệm người dùng, tốc độ tải nhanh và tương tác dễ dàng với các thành phần.
- Hợp tác nhóm: Các thành viên phải cùng làm việc bằng hệ thống quản lý phiên bản (ví dụ: Git), phân chia nhiệm vụ và đảm bảo tích hợp các phần đóng góp suôn sẻ. Giao tiếp thường xuyên là rất cần thiết. Bạn được yêu cầu chứng minh quá trình làm việc nhóm bằng cách chụp ảnh màn hình các đóng góp của thành viên qua tính năng GitHub Insights. Bằng chứng phải thể hiện rõ đồ án đã được tiến hành ít nhất một tháng kể từ ngày bắt đầu, với mỗi thành viên thực hiện tối thiểu hai commit mỗi tuần. Không đáp ứng những tiêu chí này có thể bị trừ điểm hoặc không được chấm điểm cho phần làm việc nhóm. Nhóm chỉ có một thành viên sẽ không được tính điểm làm việc nhóm.
- Thiết kế responsive: Ứng dụng web phải có khả năng đáp ứng, thích ứng liền mạch với các thiết bị và kích thước màn hình khác nhau. Sử dụng các framework như Bootstrap hoặc CSS Grid để đảm bảo tương thích.
- Mở rộng theo chiều ngang: Thiết kế ứng dụng để mở rộng theo chiều ngang, cho phép xử lý lưu lượng lớn hơn bằng cách thêm máy chủ. Triển khai kiến trúc không lưu trạng thái, cân bằng tải và cân nhắc microservices. Có thể triển khai trên dịch vụ hosting công khai tự chọn hoặc dùng Docker Compose. Dù lựa chọn cách nào, bạn phải cung cấp bằng chứng rõ ràng về những gì đã thực hiện.

### 10. Chức năng cộng điểm

Triển khai và hoàn thành đầy đủ thành công các chức năng sau sẽ được cộng 0,5 điểm cho mỗi chức năng, tổng điểm cộng tối đa là 2 điểm cho tất cả chức năng cộng điểm:

- Sử dụng quy trình CI/CD trong quá trình phát triển: Jenkins, Github Actions, Circle CI, GitLab CI/CD hoặc giải pháp của một trong ba nhà cung cấp Cloud hàng đầu.
- Triển khai hệ thống theo Kiến trúc Microservices. Ngoài frontend và cơ sở dữ liệu, phải có ít nhất ba dịch vụ khác. Bạn cũng phải chứng minh khả năng giao tiếp bất đồng bộ và tách rời các dịch vụ thông qua một kênh trung gian như RabbitMQ hoặc Redis.
- Tích hợp các chức năng liên quan đến AI, chẳng hạn chatbot thông minh có thể đề xuất các sản phẩm trực tiếp liên quan đến hệ thống này, tìm kiếm sản phẩm bằng hình ảnh tải lên và phân tích cảm xúc của các đánh giá và phản hồi.
- Tích hợp ElasticSearch để tìm kiếm sản phẩm: Triển khai ElasticSearch để cải thiện tốc độ và hiệu quả tìm kiếm sản phẩm. Việc tích hợp này phải cho phép trả về kết quả tìm kiếm nhanh và phù hợp, cải thiện trải nghiệm người dùng tổng thể.

Nếu nhóm triển khai thành công bất kỳ chức năng cộng điểm nào trong số này, bạn phải nêu rõ trong phiếu tự đánh giá, tệp README, video giới thiệu sản phẩm cùng bằng chứng cụ thể và thuyết phục. Điều này đảm bảo các đóng góp của nhóm được ghi nhận và truyền đạt đầy đủ tới người đánh giá.

Trang 6 / 13

## III. BẢNG TIÊU CHÍ CHẤM ĐIỂM


| ID                              | CHỨC NĂNG                                           |      | 1                                                                                                       | 2                                                                                                                                          | 3                                                                                                           |
| ------------------------------- | --------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
|                                 |                                                     | ĐIỂM | 0 ĐIỂM                                                                                                  | 1/2 ĐIỂM                                                                                                                                   | ĐIỂM TỐI ĐA                                                                                                 |
| CHỨC NĂNG KHÁCH HÀNG – 6,0 điểm |                                                     |      |                                                                                                         |                                                                                                                                            |                                                                                                             |
| 1                               | Xác thực qua mạng xã hội                            | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 2                               | Xem trang hồ sơ                                     | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 3                               | Đổi mật khẩu                                        | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 4                               | Khôi phục mật khẩu                                  | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 5                               | Quản lý nhiều địa chỉ giao hàng (nhiều hơn một)     | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 6                               | Xem lịch sử mua hàng (yêu cầu đăng nhập)            | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 7                               | Xem chi tiết giao dịch mua hàng (yêu cầu đăng nhập) | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |


Trang 7 / 13


| 8   | Trang chủ                                            | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| --- | ---------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 9   | Danh mục sản phẩm (xem sản phẩm theo danh mục)       | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 10  | Phân trang                                           | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 11  | Xem chi tiết sản phẩm                                | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 12  | Xem các biến thể sản phẩm (trên cùng trang chi tiết) | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 14  | Tìm kiếm sản phẩm theo từ khóa                       | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 15  | Lọc sản phẩm                                         | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 16  | Sắp xếp sản phẩm (ví dụ theo giá, thời gian)         | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 17  | Hiển thị giỏ hàng                                    | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |


Trang 8 / 13


| 18                            | Cập nhật giỏ hàng                                                | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| ----------------------------- | ---------------------------------------------------------------- | ---- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| 19                            | Quy trình thanh toán                                             | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 20                            | Sử dụng mã giảm giá khi mua hàng                                 | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 21                            | Thông báo qua email (sau khi đặt hàng)                           | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 22                            | Nhận xét sản phẩm (bình luận)                                    | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 23                            | Đánh giá sản phẩm bằng sao                                       | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
|                               | Cập nhật nhận xét và đánh giá theo thời gian thực bằng websocket | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 24                            | Chương trình khách hàng thân thiết                               | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn. | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| CHỨC NĂNG QUẢN TRỊ – 2,0 điểm |                                                                  |      |                                                                                                         |                                                                                                                                            |                                                                                                             |





| 26                        | Quản lý người dùng                                                                                                                  | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản     | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn.                                                                                | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| 25                        | Quản lý sản phẩm                                                                                                                    | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản     | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn.                                                                                | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 31                        | Quản lý mã giảm giá                                                                                                                 | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản     | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn.                                                                                | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 29                        | Xem danh sách đơn hàng                                                                                                              | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản     | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn.                                                                                | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 30                        | Xem chi tiết đơn hàng (và thay đổi trạng thái đơn hàng)                                                                             | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản     | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn.                                                                                | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 27                        | Bảng điều khiển cơ bản                                                                                                              | 0.25 | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản     | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn.                                                                                | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| 28                        | Bảng điều khiển nâng cao                                                                                                            | 0.5  | Chức năng chưa được triển khai, không hoạt động hoặc có lỗi nghiêm trọng khiến không thể sử dụng cơ bản     | Chức năng đã có nhưng chưa hoàn chỉnh, có các vấn đề như kiểm tra dữ liệu đầu vào kém, lỗ hổng bảo mật hoặc không tuân thủ các tiêu chuẩn.                                                                                | Chức năng được triển khai đầy đủ, bảo mật và đáp ứng các tiêu chuẩn, không có vấn đề hoặc lỗi nghiêm trọng. |
| CÁC YÊU CẦU KHÁC – 2 điểm |                                                                                                                                     |      |                                                                                                             |                                                                                                                                                                                                                           |                                                                                                             |
| 32                        | UI/UX Chấm điểm dựa trên đánh giá của giảng viên; chỉ sản phẩm trên mức trung bình mới được điểm (giao diện cơ bản không được điểm) | 0.5  | Có UI và UX cơ bản nhưng thiếu nhất quán, có một số vấn đề về khả năng sử dụng và tính thẩm mỹ còn hạn chế. | Website có một số thành phần thân thiện với người dùng nhưng thiếu nhất quán trong thiết kế và điều hướng. Dù có khả năng sử dụng cơ bản, vẫn còn nhiều điểm quan trọng cần cải thiện để nâng cao trải nghiệm người dùng. | UI và UX được thiết kế tốt, trực quan, đẹp mắt, đem lại trải nghiệm người dùng liền mạch và hấp dẫn.        |


Trang 10 / 13


| 33  | Làm việc nhóm (làm một mình hoặc không có bằng chứng GitHub Insights sẽ không được điểm này)                                             | 0.5 | Không có bằng chứng làm việc nhóm trên GitHub; đóng góp rời rạc hoặc không có, không có commit từ sớm hoặc đều đặn.                                                      | Có thể thấy một phần hoạt động làm việc nhóm với các commit thỉnh thoảng xuất hiện, nhưng công việc phân chia không đều, có trì hoãn hoặc thiếu đóng góp từ sớm.                                                     | Có bằng chứng làm việc nhóm hiệu quả, phân chia công việc cân bằng, commit sớm và thường xuyên, chủ động hợp tác trong suốt đồ án.                                                                                        |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------- | --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 34  | Responsive Chấm điểm dựa trên đánh giá của giảng viên; chỉ sản phẩm trên mức trung bình mới được điểm (giao diện cơ bản không được điểm) | 0.5 | Website không responsive; không điều chỉnh theo các kích thước màn hình hoặc thiết bị khác nhau. Người dùng gặp vấn đề bố cục, khiến điều hướng khó khăn.                | Website có một số thành phần responsive nhưng chưa được tối ưu hoàn toàn. Một số trang hoặc thành phần có thể không hiển thị đúng trên mọi thiết bị, dẫn đến trải nghiệm không nhất quán.                            | Website hoàn toàn responsive, mang đến trải nghiệm tối ưu trên mọi thiết bị. Mọi thành phần, bố cục và chức năng điều chỉnh liền mạch theo các kích thước màn hình khác nhau, bảo đảm điều hướng dễ dàng.                 |
| 35  | Mở rộng theo chiều ngang                                                                                                                 | 0.5 | Ứng dụng không được thiết kế để mở rộng theo chiều ngang; nó phụ thuộc vào một máy chủ duy nhất. Điều này giới hạn hiệu năng và có thể gây ngừng hoạt động khi tải tăng. | Ứng dụng cho thấy một số tiềm năng mở rộng theo chiều ngang nhưng chưa được triển khai đầy đủ. Một số thành phần có thể phân tán trên nhiều máy chủ, nhưng có thể gặp vấn đề về cân bằng tải hoặc quản lý trạng thái | Ứng dụng được thiết kế đầy đủ để mở rộng theo chiều ngang. Ứng dụng sử dụng hiệu quả nhiều máy chủ, áp dụng cân bằng tải và duy trì kiến trúc không lưu trạng thái, cho phép xử lý lưu lượng tăng lên một cách liền mạch. |


Mô tả ở trên chỉ nhằm làm hướng dẫn chung và không thể được xem là hướng dẫn triển khai chi tiết từng bước cho mỗi chức năng, xác định điều gì đúng hay sai. Tuy nhiên, trong quá trình chấm điểm, các chức năng phải được phát triển dựa trên những mô tả này, đặc biệt là những nội dung được tô màu riêng biệt. Các chức năng này phải được triển khai ở mức tiêu chuẩn tương đối cao để đủ điều kiện nhận điểm tối đa. Các nhóm nên chủ động tham khảo các ứng dụng liên quan và áp dụng trải nghiệm sử dụng những ứng dụng đó hằng ngày vào bài làm. Ví dụ:

- Hiển thị giá sản phẩm:
- Cách làm chưa tốt: Hiển thị dữ liệu trực tiếp từ cơ sở dữ liệu dưới dạng “75299000”, rất khó đọc.
- Cách làm tốt hơn: Định dạng thành “75,299,000đ” có dấu phân cách và đơn vị tiền tệ, cải thiện độ rõ ràng và dễ đọc.
- Khi hiển thị danh sách đơn hàng:
- Cách làm chưa tốt: Chỉ sử dụng “select all” từ cơ sở dữ liệu, hiển thị dữ liệu theo thứ tự tăng dần. Đơn hàng mới xuất hiện ở cuối, không có phân trang nên khó tìm kiếm. Những thông tin quan trọng như tổng tiền, tên người mua, trạng thái và định dạng ngày tháng không được hiển thị rõ ràng.
- Cách làm tốt hơn: Sắp xếp dữ liệu theo ngày giảm dần để đơn hàng mới nằm trên cùng. Triển khai phân trang để dễ xem hơn, đảm bảo mọi thông tin quan trọng được hiển thị rõ ràng với định dạng phù hợp và sử dụng màu sắc thích hợp.

Trang 11 / 13

## IV. YÊU CẦU ĐẦU RA

- Các thành phần bắt buộc khi nộp bài bao gồm:
  - Thư mục "source":
    - Nếu không sử dụng docker compose: thư mục source phải chứa toàn bộ mã nguồn ứng dụng web (ví dụ frontend, backend), cùng các tệp cơ sở dữ liệu có liên quan. Đảm bảo mã nguồn này chạy được trên máy tính của giảng viên. Dự án cần được “dọn dẹp” để loại bỏ nội dung không cần thiết trước khi nộp và giảm kích thước tệp nén.
    - Nếu sử dụng docker compose: Thư mục này phải chứa tất cả mã nguồn của các module cần thiết, tệp docker-compose và hướng dẫn chạy ứng dụng trên máy của giảng viên (ví dụ: nơi chạy npm install và docker-compose up). Đảm bảo đã kiểm thử kỹ lưỡng trước khi nộp.
  - Video giới thiệu "demo.mp4": Một đại diện nhóm phải quay video màn hình trình bày ứng dụng của nhóm, giới thiệu TẤT CẢ chức năng dựa trên phần tự đánh giá. Video phải có độ phân giải tối thiểu 1080p, âm thanh rõ ràng và nghe được, không có phần giải thích lý thuyết.
  - Thư mục “git”: Chứa các ảnh chụp màn hình thể hiện sự hợp tác giữa các thành viên trên repository github hoặc gitlab. Có thể nộp nhiều ảnh chụp màn hình, miễn là có bằng chứng làm việc nhóm hiệu quả, phân chia công việc cân bằng, commit sớm và thường xuyên, chủ động hợp tác trong suốt dự án. Bằng chứng làm việc nhóm phải thể hiện rõ thời gian thực hiện dự án từ khi bắt đầu tới hiện tại ít nhất là một tháng, trong đó mỗi thành viên phải có ít nhất hai commit mỗi tuần.
  - Tệp Readme.txt: Cung cấp mọi thông tin cần thiết cho quá trình đánh giá, như hướng dẫn build và chạy dự án, URL + thông tin đăng nhập máy chủ (nếu có), tên đăng nhập/mật khẩu của các tài khoản có dữ liệu được nạp sẵn để đánh giá. Bao gồm mọi ghi chú liên quan đến việc build, chạy và sử dụng ứng dụng để giảng viên có thể tái hiện dự án. Nếu nhóm triển khai một số chức năng tùy chọn (được cộng điểm), phải nêu rõ trong tệp readme.
  - Thư mục “Bonus”: Thư mục bonus phải chứa mô tả các chức năng bổ sung mà nhóm đã triển khai để được cộng điểm, cùng bằng chứng. Tổ chức thông tin rõ ràng, ngắn gọn và thuyết phục.
  - Rubrik.docx: Tệp này liệt kê các chức năng bắt buộc của dự án. Các nhóm phải tự đánh giá mức độ hoàn thành trong tệp này. Giảng viên sẽ cung cấp tệp vào thời điểm nộp bài. Tệp cũng sẽ chứa URL công khai của ứng dụng web và mọi tên đăng nhập/mật khẩu cần thiết để đăng nhập.

Trang 12 / 13

- Sắp xếp tất cả nội dung trên vào một thư mục có tên id1_fullname1_id2_fullname2, sau đó nén thư mục này thành định dạng ZIP với cùng tên, ví dụ id1_fullname1_id2_fullname2.zip. Một đại diện nhóm phải nộp tệp này trên hệ thống học tập trực tuyến theo hướng dẫn của giảng viên môn học.
- Giảng viên không chấp nhận bài nộp qua email, chỉ chấp nhận qua elearning.

## IV. LƯU Ý QUAN TRỌNG

- Đồ án cuối kỳ phải được triển khai dưới dạng dự án Nodejs sử dụng ngôn ngữ lập trình Javascript. Bạn được phép sử dụng bất kỳ thư viện hoặc framework nào cho frontend và backend, miễn là chúng dựa trên Node.js.
- Nếu nhóm nộp một dự án không liên quan, bài sẽ không được chấm và toàn bộ nhóm nhận 0 điểm. Ví dụ, nếu nhóm sử dụng mã nguồn từ một website thương mại điện tử khác và chỉ triển khai một vài chức năng liên quan đến bài tập này trong khi phần lớn chức năng không liên quan, dự án sẽ nhận 0 điểm.
- Bài tiểu luận hoàn toàn độc lập với Đồ án cuối kỳ. Vì vậy, tất cả thành viên nhóm phải tham gia cả Bài tiểu luận và Đồ án cuối kỳ. Bài tiểu luận sẽ do giảng viên thực hành đánh giá, còn Đồ án cuối kỳ do giảng viên lý thuyết đánh giá.
- Các nhóm bị cấm chia sẻ mã nguồn với nhau, lấy mã nguồn từ internet và phải chịu trách nhiệm bảo vệ mã nguồn của nhóm mình. Những nhóm có mã nguồn tương tự nhau (được xác minh bằng phần mềm chuyên dụng) hoặc có mã nguồn tìm thấy trực tuyến, dù chỉ một phần, sẽ nhận 0 điểm cho tất cả thành viên, bất kể nhóm nào chia sẻ hay nhận mã nguồn.
- Không nộp mã nguồn sẽ khiến toàn bộ nhóm nhận 0 điểm.
- Nếu nhóm không điền và nộp tệp rubrik.docx, bài nộp sẽ không được chấm.
- Nếu nhóm không triển khai dự án (ví dụ: hosting công khai hoặc Docker Compose) hoặc không cung cấp video giới thiệu, bài nộp sẽ không được chấm.
- Điểm cũng sẽ bị trừ trong các trường hợp sau:
  - Nộp muộn: Muộn 1 ngày bị trừ 1 điểm. Nộp muộn từ 1 giây đến dưới 1 ngày đều được tính là muộn 1 ngày.
  - Cấu hình dự án phức tạp nhưng không có hướng dẫn cụ thể để giảng viên biên dịch và chạy chương trình: Trừ 2 điểm.
  - Nộp toàn bộ dự án mà không dọn dẹp để loại bỏ các tệp không cần thiết: Trừ 0,5 điểm.
  - Không cung cấp thông tin cần thiết để chấm điểm, chẳng hạn thiếu tên đăng nhập/mật khẩu, đặt tên tệp không đúng hoặc thiếu nội dung bắt buộc: Trừ 1,0 điểm.

Trang 13 / 13