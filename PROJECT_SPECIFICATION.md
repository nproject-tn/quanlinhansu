# 📘 APEXFLOW - MASTER SYSTEM SPECIFICATION & BLUEPRINT
> **TÀI LIỆU ĐẶC TẢ TOÀN DIỆN HỆ THỐNG APEXFLOW (SINGLE SOURCE OF TRUTH)**
> *Phiên bản cập nhật mới nhất: 2026*  
> *Lưu ý sống còn: File này chứa 100% logic, kiến trúc, thiết kế, cơ sở dữ liệu và quy tắc nghiệp vụ của toàn bộ dự án. Khi đọc file này, lập trình viên hoặc AI Agent có thể tái tạo lại 100% hệ thống mà không thiếu sót bất kỳ tính năng nào.*

---

## 📑 MỤC LỤC
1. [Triết lý Thiết kế & Ngôn ngữ UI/UX (Design System)](#1-triết-lý-thiết-kế--ngôn-ngữ-uiux-design-system)
2. [Kiến trúc Hạ tầng & Cơ sở Dữ liệu (Infrastructure & Multi-Tenant DB)](#2-kiến-trúc-hạ-tầng--cơ-sở-dữ-liệu-infrastructure--multi-tenant-db)
3. [Cơ sở Dữ liệu Chi tiết: 29 Models Prisma](#3-cơ-sở-dữ-liệu-chi-tiết-29-models-prisma)
4. [Phân hệ 1: Xác thực, Phân quyền & Không gian làm việc (Auth & Workspaces)](#4-phân-hệ-1-xác-thực-phân-quyền--không-gian-làm-việc)
5. [Phân hệ 2: Cửa hàng & Định biên Nhân sự (Stores & Staffing)](#5-phân-hệ-2-cửa-hàng--định-biên-nhân-sự)
6. [Phân hệ 3: Hồ sơ Nhân viên & Theo dõi Giờ làm (Employees & Hours)](#6-phân-hệ-3-hồ-sơ-nhân-viên--theo-dõi-giờ-làm)
7. [Phân hệ 4: Cấu hình Ca & Quy tắc Định biên (Shift Templates & Rules)](#7-phân-hệ-4-cấu-hình-ca--quy-tắc-định-biên)
8. [Phân hệ 5: Lịch Xếp Ca Thông minh & Vận hành Ca (Smart Scheduling Engine)](#8-phân-hệ-5-lịch-xếp-ca-thông-minh--vận-hành-ca)
9. [Phân hệ 6: Hàng hóa, Tồn kho & Đơn đặt NSX (Goods, Inventory & Factory Orders)](#9-phân-hệ-6-hàng-hóa-tồn-kho--đơn-đặt-nsx)
10. [Phân hệ 7: Cài đặt Doanh nghiệp & Thành viên (Settings & Members)](#10-phân-hệ-7-cài-đặt-doanh-nghiệp--thành-viên)
11. [Quy tắc Duy trì & Cập nhật Bản thiết kế này (Maintenance Rules)](#11-quy-tắc-duy-trì--cập-nhật-bản-thiết-kế-này)

---

## 1. TRIẾT LÝ THIẾT KẾ & NGÔN NGỮ UI/UX (DESIGN SYSTEM)

### 1.1. Bảng màu Chủ đạo & Hệ thống Theme Đa chế độ (3 Chế độ: Sáng / Tối / Tự động)
* **Hệ thống Giao diện Toàn diện (Theme System)**:
  * **3 Chế độ lựa chọn**:
    1. **☀️ Sáng (Light Mode)**: Nền trắng - xám thanh lịch (`#F6F7F9` / `#FFFFFF`), tương phản sắc sảo với các ô ca làm việc phân cấp rõ nét (ô ca `#EDF2F7`, ô nhân viên trắng tinh `#FFFFFF` viền `#CBD5E1`).
    2. **🌙 Tối (Dark Mode)**: Tông **Xám Graphite & Charcoal Trung Tính chuẩn Antigravity Theme** (`#1E1E1E` / `#252526` / `#2D2D30` / `#333333` / `#3C3C3C` / `#E0E0E0` / `#9D9D9D`), triệt tiêu 100% ánh xanh lam lạnh và không bị quá tối/đen tuyền, đem lại độ tương phản hoàn hảo, thị giác êm dịu và cảm giác chuyên nghiệp cao cấp.
    3. **💻 Tự động (System/Auto)**: Tự động phát hiện và đồng bộ theo cài đặt hệ điều hành (OS) của người dùng (`prefers-color-scheme: dark`).
  * **Bộ lưu trữ, Khởi tạo & Hiệu ứng mượt mà (Storage, Anti-flicker & Smooth Transitions)**:
    * Lưu lựa chọn trong `localStorage` (key: `apexflow-theme`).
    * Inline script chống chớp nháy (Zero-FOUT) tiêm trực tiếp vào `<head>` của `RootLayout` giúp hiển thị theme chuẩn xác ngay lập tức trước khi React DOM render.
    * Cơ chế chuyển theme đồng bộ mượt mà (Smooth 220ms GPU View Transitions) trên toàn bộ các bề mặt card, layout, viền và đổ bóng mà không bị khựng giật.
    * Tích hợp nút chuyển đổi giao diện đơn icon thông minh (Single-icon Theme Trigger with Floating Popover Picker: Light / Dark / System) đặt cạnh nút chuyển đổi doanh nghiệp ở chân thanh Sidebar và bộ Segmented Control trong trang Cài đặt (`/app/[companyId]/cai-dat`).
* **Bảng màu Chi tiết**:
  * **Light Theme**:
    * Nền canvas: `bg-[#F6F7F9]` / `bg-slate-50`.
    * Thẻ card / Container: `bg-white` hoặc `bg-white/80 backdrop-blur-md`.
    * Thẻ ca làm việc (Outer Shift Card): `bg-[#EDF2F7] border-slate-300/80`.
    * Ô nhân viên gán ca (Inner Employee Slot): `bg-white border-slate-300/90 shadow-xs text-slate-900 font-bold`.
    * Chữ chính: `text-slate-900`. Chữ phụ: `text-slate-500` / `text-slate-600`.
    * Viền mỏng: `border-slate-200` / `border-slate-300`.
  * **Dark Theme (Antigravity Neutral Graphite Style)**:
    * Nền canvas: `bg-[#1E1E1E]` (Warm Neutral Graphite Dark Canvas).
    * Thẻ card / Panels / Sidebar / Modal dialogs: `bg-[#252526]` (Sidebar `bg-[#181818]`) với viền `border-[#333333]`.
    * Sub-cards, Bảng con, Table headers, Slots, Inner controls: `bg-[#252526]` / `bg-[#2D2D30]` với viền `border-[#3C3C3C]`.
    * Ô nhân viên gán ca (Inner Employee Slot): `bg-[#2D2D30] border-[#3C3C3C] hover:bg-[#37373D] text-white font-bold`.
    * Nút bấm chính (Primary Action): Nền trắng tinh `bg-white text-black font-bold hover:bg-neutral-200 shadow-md`.
    * Nút bấm phụ (Secondary / Outline): `bg-[#252526] border-[#3C3C3C] text-[#E0E0E0] hover:bg-[#2D2D30]`.
    * Chữ tiêu đề / Tiêu đề card: `text-white font-bold` (`#FFFFFF`).
    * Chữ nhãn / Table headers: `text-[#E0E0E0]` / `text-[#CCCCCC]`.
    * Chữ phụ / Muted text: `text-[#9D9D9D]` (`#A0A0A0`).
    * Mã SKU / Code / Barcode: `text-indigo-300 font-mono font-bold`.
    * Giá bán: `text-emerald-400 font-mono font-bold`.
    * Giá nhập: `text-neutral-300 font-mono`.
    * Hiệu ứng kính mờ (Liquid Glass Dark): `rgba(37, 37, 38, 0.95)` + `backdrop-blur-xl` + viền `rgba(255, 255, 255, 0.08)`.
* **Điểm nhấn chức năng (Semantic Accents)**:
  * **Indigo (`indigo-600` / dark: `indigo-400` / `dark:text-indigo-300`)**: Điểm nhấn thương hiệu, mã SKU/PO, trạng thái đang xử lý, icon module.
  * **Emerald (`emerald-600` / dark: `emerald-400`)**: Thành công, QC Pass, Đã nhập kho, Đã duyệt ca.
  * **Amber (`amber-600` / dark: `amber-400`)**: Cảnh báo, Đang sản xuất, Chờ duyệt.
  * **Rose (`rose-600` / dark: `rose-400`)**: Nguy hiểm, Quá hạn (Overdue), Lỗi QC (Defect), Trả hàng NSX, Xóa.

### 1.2. Typography & Định dạng
* Font chữ giao diện: **Inter** / Sans-serif chuẩn hệ điều hành.
* Font chữ số liệu, mã code: **Monospace** (`font-mono`) cho SKU, Barcode, Mã Lô, Giờ làm việc, Tiền tệ.
* Tiền tệ: Luôn format phân cách hàng nghìn (ví dụ: `350.000 đ`).

### 1.3. Thành phần Giao diện Chuẩn (Core UI Components)
* **Pill Badges**: Bo tròn góc (`rounded-full`), viền mỏng (`border`), chữ nhỏ gọn (`text-[11px] font-semibold`).
* **Modal Dialogs**: Lớp phủ làm mờ nền (`bg-slate-950/60 backdrop-blur-sm`), khung bo tròn `rounded-2xl`, bóng đổ sâu `shadow-2xl`.
* **Toast Thông báo**: Sử dụng `useNotifications` (hỗ trợ `tone: "success" | "error" | "info"`).
* **Hộp thoại Xác nhận**: Sử dụng `useConfirmDialog` (hỗ trợ `title`, `description`, `confirmLabel`, `tone: "destructive"`).
* **Dữ liệu Thời gian thực**: Tích hợp **SWR** (`useSWR`) tự động fetch, cache và mutate tức thì khi thao tác dữ liệu.

### 1.4. Bố cục Toàn màn hình & Tối ưu Màn hình lớn (Fluid Full-Width Responsive Canvas)
* **Khung chứa Động (Fluid Main Content Container)**:
  * Loại bỏ hoàn toàn giới hạn chiều rộng cứng (`max-w-7xl` / `max-w-6xl`) ở khung `main` của `DashboardLayout`.
  * Nội dung các phân hệ (Lịch xếp ca, Hàng hoá, Đơn hàng, Nhân sự, Cửa hàng, Cài đặt) luôn trải rộng tối đa (`w-full`) theo độ phân giải màn hình của người dùng (Full HD 1080p, 2K 1440p, 4K Ultrawide).
  * Padding viền cân đối (`p-4 md:p-6`) tạo khoảng thở thẩm mỹ, không để thừa khoảng trống lãng phí ở hai bên bảng dữ liệu.

---

## 2. KIẾN TRÚC HẠ TẦNG & CƠ SỞ DỮ LIỆU (INFRASTRUCTURE & MULTI-TENANT DB)

### 2.1. Máy chủ Triển khai (Oracle Cloud Infrastructure)
* **IP Server**: `140.245.105.160` (Ubuntu VM).
* **Tên miền & SSL**: `https://apexflow.id.vn` qua Nginx Reverse Proxy (Let's Encrypt SSL).
* **Khởi chạy ứng dụng**: Docker Compose / PM2 Node.js container (`nextjs_app`).

### 2.2. Hai Cơ sở Dữ liệu PostgreSQL Tách biệt
1. **Production DB (Cổng 5432)**:
   * DB Name: `quanlinhansu`
   * Mật khẩu: `IdpyutdZI3y1qDHJaTn-gsoaG3l8MAUi`
   * URL: `postgresql://postgres:IdpyutdZI3y1qDHJaTn-gsoaG3l8MAUi@140.245.105.160:5432/quanlinhansu?schema=public`
   * **QUY TẮC SỐNG CÒN**: Dành riêng cho người dùng thực tế trên web. TUYỆT ĐỐI KHÔNG dùng cho dev test local.
2. **Development DB (Cổng 5433)**:
   * DB Name: `quanlinhansu_dev`
   * Mật khẩu: `jTgC48v11MCVqB_KH28MthKhQ2ZCUH_b`
   * URL: `postgresql://postgres:jTgC48v11MCVqB_KH28MthKhQ2ZCUH_b@140.245.105.160:5433/quanlinhansu_dev?schema=public`
   * File `.env` local LUÔN LUÔN trỏ về cổng `5433`.

### 2.3. Quy tắc Multi-Tenant Tuyệt đối (Cô lập dữ liệu Doanh nghiệp)
* Mọi model nghiệp vụ BẮT BUỘC có trường `companyId String`.
* Quan hệ khóa ngoại: `company Company @relation(fields: [companyId], references: [id], onDelete: Cascade)`.
* Index bắt buộc: `@@index([companyId])`.
* Mọi API query / mutation / delete BẮT BUỘC phải lọc và kiểm tra theo `companyId` của phiên đăng nhập.

---

## 3. CƠ SỞ DỮ LIỆU CHI TIẾT: 29 MODELS PRISMA

1. **Company**: Doanh nghiệp/Tổ chức (id, name, slug, logo, plan, maxStores, maxEmployees, maxUsers, status).
2. **User**: Tài khoản người dùng (id, name, email, password, image, role, isSuperAdmin).
3. **CompanyMember**: Quan hệ User - Company (id, companyId, userId, roleId, isOwner, status).
4. **CompanyRole**: Vai trò tùy biến trong công ty (id, companyId, name, description, isSystem, permissions JSON).
5. **CompanyInvitation**: Lời mời tham gia doanh nghiệp (id, companyId, email, roleId, token, expires, status).
6. **Subscription**: Gói cước dịch vụ (id, companyId, plan, status, startDate, endDate, price).
7. **Account**: NextAuth OAuth provider accounts.
8. **Session**: NextAuth session tokens.
9. **VerificationToken**: NextAuth token xác thực email.
10. **Store**: Chi nhánh / Cửa hàng (id, companyId, name, code, address, phone, managerName, status, openingHours JSON, displayOrder).
11. **Employee**: Hồ sơ nhân sự (id, companyId, code, name, email, phone, avatar, position, contractType, baseSalary, hourlyRate, targetHours, status, joinedDate).
12. **EmployeeStore**: Quan hệ Nhân viên - Cửa hàng được phép làm việc (id, companyId, employeeId, storeId).
13. **ShiftTemplate**: Ca làm việc mẫu (id, companyId, name, code, startTime, endTime, breakMinutes, durationHours, payMultiplier, color, isNightShift).
14. **StaffingRule**: Quy tắc định biên nhân sự theo doanh thu / theo giờ (id, companyId, storeId, dayOfWeek, shiftTemplateId, minStaff, targetRevenue).
15. **StaffingOverride**: Ngoại lệ định biên ngày lễ/sự kiện (id, companyId, storeId, date, shiftTemplateId, requiredStaff, note).
16. **ShiftAssignment**: Phân công ca làm việc thực tế (id, companyId, storeId, employeeId, shiftTemplateId, date, startTime, endTime, status, actualCheckIn, actualCheckOut, note).
17. **ShiftOvertime**: Bản ghi tăng ca (id, companyId, assignmentId, employeeId, date, overtimeHours, payMultiplier, reason, status).
18. **ShiftFault**: Vi phạm ca làm việc - trễ, về sớm, vắng (id, companyId, assignmentId, employeeId, date, faultType, minutesLate, penaltyAmount, note).
19. **ScheduleDayNote**: Ghi chú ngày trên lịch (id, companyId, storeId, date, title, content, color, icon).
20. **ScheduleApprovalRequest**: Yêu cầu phê duyệt đổi ca / lịch làm việc (id, companyId, requesterId, approverId, type, status, details JSON, note).
21. **ScheduleConfig**: Cấu hình quy tắc xếp ca tự động (id, companyId, maxHoursPerWeek, minRestBetweenShifts, maxConsecutiveDays, rules JSON).
22. **RevenueRecord**: Dữ liệu doanh thu cửa hàng phục vụ tính định biên (id, companyId, storeId, date, revenue).
23. **AttendanceLog**: Lịch sử chấm công máy/GPS (id, companyId, employeeId, storeId, checkTime, type, method, deviceId).
24. **Manufacturer**: Nhà sản xuất / Xưởng may gia công (id, companyId, name, code, address, phone, taxId, country).
25. **Category**: Chủng loại sản phẩm cấp 1 (id, companyId, name, codeLetter, description).
26. **Subcategory**: Chất liệu / Chủng loại cấp 2 (id, companyId, categoryId, name, codeLetter).
27. **Product**: Dòng sản phẩm & Biến thể SKU (id, companyId, name, sku, barcode, brandName, categoryId, subcategoryId, manufacturerId, colorName, sizeName, unit, costPrice, sellingPrice, stockQuantity, minStock, imageUrl, description, barcodeNeedsReprint).
28. **FactoryOrder**: Đơn đặt hàng sản xuất / Phiếu đặt xưởng PO (id, companyId, poNumber, manufacturerId, orderDate, expectedDeliveryDate, actualReceivedDate, status, note, totalCost).
29. **FactoryOrderItem**: Chi tiết mặt hàng trong đơn đặt xưởng & Lô hàng (id, companyId, factoryOrderId, productId, batchCode, orderQuantity, qcPassedQuantity, qcDefectQuantity, status, note).
30. **Customer**: Khách hàng & CRM (id, companyId, name, phone, email, address, totalOrders, totalSpent).
31. **Order**: Đơn hàng đa kênh (id, companyId, code, orderDate, channel, storeId, employeeId, customerId, customerName, customerPhone, customerAddress, totalAmount, discountAmount, shippingFee, finalAmount, paymentStatus, paymentMethod, orderStatus, externalOrderId, externalTrackingCode, note).
32. **OrderItem**: Chi tiết mặt hàng trong đơn (id, companyId, orderId, productId, sku, productName, unitPrice, costPrice, quantity, discount, totalPrice).
33. **EcommerceConnection**: Cấu hình liên kết sàn TMĐT (id, companyId, platform, shopId, shopName, accessToken, refreshToken, expiresAt, isActive, autoSyncStock, autoSyncOrders).

---

### 7.1. Phân hệ 1: Xác thực & Quản lý Không gian làm việc (Auth & Multi-tenant Workspaces)
* **Giao diện Đăng nhập Floating Rounded Showcase Split UI (`/dang-nhap`)**:
  * Thiết kế hiện đại chuẩn phong cách Magnific/AI Canvas:
    * **Cột trái (50% Desktop - Floating Dark Showcase Card)**: Khung canvas nền đen sâu lơ lửng được bo góc tinh tế (`rounded-lg lg:rounded-xl`) với viền đệm cách điệu thanh mảnh (`p-1.5 sm:p-2 lg:p-2`), bóng mờ `shadow-md`, chứa hệ thống 3D Feature Cards và thanh điều hướng tab tương tác.
    * **Cột phải (50% Desktop - Clean Minimalist Auth)**: Nền trắng phẳng tối giản, logo ApexFlow căn giữa, tiêu đề gọn gàng, hỗ trợ sẵn sàng cho Dark Mode trong tương lai.
  * **Cơ chế Điều hướng Đăng nhập & Chuyển đổi Tài khoản Linh hoạt (Account Switching & Session Continuity)**:
    * Người dùng từ Landing Page (`/home-apexflow`) khi bấm *Đăng nhập* hoặc truy cập `/dang-nhap` sẽ **luôn luôn được hiển thị trang đăng nhập** mà không bị hệ thống tự động cưỡng chế chuyển hướng thẳng vào Workspaces.
    * **Khung Thẻ Tài khoản Đang Đăng nhập (Active Session Card)**:
      * Nếu người dùng đã có phiên đăng nhập trước đó, trang đăng nhập hiển thị thẻ thông tin tài khoản hiện tại (Avatar, Họ tên, Email, huy hiệu *Đang đăng nhập*).
      * Nút bấm *Tiếp tục với tài khoản này* cho phép truy cập nhanh vào Không gian làm việc.
      * Bên dưới cung cấp đầy đủ các phương thức *Tiếp tục với Google* và *Nhập Email khác* để người dùng có thể linh hoạt đăng nhập lại bằng chính email đó hoặc chuyển sang một tài khoản / email khác tùy ý.
* **3 Phương thức Đăng nhập Không Mật khẩu Chuẩn Hiện Đại (100% Passwordless Architecture)**:
  1. **Google ("Tiếp tục với Google" - Khuyên dùng)**:
     * Nút trắng viền mảnh sang trọng, logo Google chuẩn, tích hợp Google One-Tap for Chrome và popup Account Chooser (`prompt: "select_account"`). Hoàn toàn miễn phí 100%.
     * **Cơ chế Google Name Guard (Bảo vệ tên người dùng)**: Nếu tài khoản đã tồn tại trong Database và người dùng đã từng nhập Họ Tên tùy chỉnh trước đó qua Email OTP, hệ thống **bảo toàn 100% tên người dùng tự nhập**, tuyệt đối không để tên tài khoản Google ghi đè lên!
  2. **Đăng nhập bằng Số điện thoại (SĐT OTP - Tạm thời bảo trì)**: Nút trắng viền mảnh có biểu tượng Smartphone. Khi bấm vào sẽ hiển thị thông báo "Phương thức đăng nhập bằng Số điện thoại đang bảo trì. Vui lòng chọn phương án đăng nhập bằng Google hoặc Email."
  3. **Đăng nhập bằng Email OTP (Tích hợp Resend Email Gateway - 100% Passwordless)**:
     * Ô nhập Email tối giản với kiểm tra định dạng regex theo thời gian thực và nút `Continue` chuyển màu thông minh (Xám khi chưa nhập -> Đen khi hợp lệ).
     * **Giao diện 6 ô nhập mã OTP tách rời (`OtpInput`)**:
       * Mỗi ô nhận 1 chữ số, tự động chuyển con trỏ sang ô tiếp theo khi gõ.
       * Hỗ trợ xóa lùi (Backspace) thông minh về ô trước.
       * Tích hợp `autoComplete="one-time-code"` và `inputMode="numeric"`, cho phép hệ điều hành (iOS, macOS, Android) tự động nhận diện và điền mã OTP từ SMS/Email/Clipboard chỉ với 1 chạm.
       * Tự động xác thực và đăng nhập tức thì ngay khi hoàn tất 6 số mà không cần bấm thêm nút.
     * **Quy trình Onboarding Họ & Tên cho Email đăng nhập lần đầu**:
       * Chỉ hiển thị 1 lần duy nhất đối với tài khoản mới đăng nhập qua Email.
       * Cho phép người dùng nhập Họ và Tên chính thức (lưu qua API `/api/users/update-profile`) trước khi chuyển tiếp vào Không gian làm việc.
       * Từ lần đăng nhập thứ 2 trở đi, hệ thống tự động nhận diện và vào thẳng Không gian làm việc ngay sau khi xác thực OTP.
* **Trang chọn Không gian làm việc (`/workspaces`)**:
  * Thiết kế tối giản theo hệ màu Trắng / Đen / Slate chuẩn mực, loại bỏ các gam màu tím/indigo rực rỡ ở chế độ sáng để đảm bảo tính đồng bộ và chuyên nghiệp cao cấp.
  * Hiển thị danh sách tất cả các công ty/chuỗi cửa hàng mà tài khoản đang tham gia.
  * Tùy chọn tạo công ty mới hoặc tham gia bằng mã mời (Invite Code).
  * Chuyển đổi nhanh giữa các Workspace mà không cần đăng nhập lại.
  * Đường dẫn ứng dụng gắn liền với slug: `/app/[companyId]/...` (ví dụ: `/app/tokyolife-hcm/...`).
* **Thanh điều hướng Sidebar Đa nền tảng & Cấu trúc phân lớp z-index**:
  * **Desktop**: Hỗ trợ mở rộng (`w-64`) và thu gọn linh hoạt (`w-[5.5rem]`), hover flyout submenu cho phân hệ Hàng hoá, ghim dọc cố định (`md:sticky md:z-30`).
  * **Mobile Drawer**: Khi mở trên điện thoại (`isMobileOpen`), Sidebar hiển thị dưới dạng ngăn kéo trượt (Slide-out Drawer `max-md:z-[90]`) với nền kính mờ `backdrop-blur-xl` (`z-[80]`), tự động hiển thị đầy đủ 100% logo thương hiệu, tên mục điều hướng, thông tin tài khoản người dùng, và thanh công cụ Đăng xuất / Đổi giao diện Sáng - Tối / Chuyển doanh nghiệp ở dạng hàng ngang tinh tế.
  * **Chuẩn hóa phân tầng z-index toàn hệ thống**: Chuông thông báo (`z-40`), Sidebar Desktop (`z-30`), Table sticky header/column (`z-10` đến `z-30`), Toàn bộ Modal/Dialog/Sheet backdrop (`z-[100]`), Hộp thoại xác nhận nguy hiểm (`z-[120]`). Khi bất kỳ Modal nào mở ra, toàn bộ Sidebar Desktop và Chuông thông báo đều tự động chìm xuống sau lớp kính mờ làm mờ tối màu chuẩn xác.
* **Phân quyền RBAC & Quản lý Quyền hạn Động (Dynamic Permissions & Role Inheritance)**:
  * Phân quyền theo ma trận: `Module` (`schedule`, `employees`, `stores`, `products`, `shift_config`, `settings`) × `Action` (`VIEW`, `EDIT`, `DELETE`, `APPROVE`, `EDIT_FREE`, `VIEW_LIST`, `VIEW_HOURS`).
  * **Kế thừa quyền linh hoạt**: Hợp nhất quyền hạn từ vai trò tùy biến (`CompanyRole`) và quyền ghi đè theo từng thành viên (`CompanyMember.permissions`).
  * **Kiểm soát hiển thị Sidebar & Dashboard tuyệt đối**: Mỗi tab điều hướng và các nút liên kết trực tiếp trên trang Tổng quan (`/app/[companyId]`) (bao gồm nút *Xem lịch xếp ca*) được kiểm tra nghiêm ngặt thông qua hàm `hasPermission`. Khi người dùng không có quyền xem lịch ca, nút điều hướng sẽ tự động ẩn và hiển thị thông báo hướng dẫn liên hệ quản trị viên, triệt tiêu hoàn toàn lỗi 404.
  * `requireAuth` helper kiểm tra quyền chặt chẽ trên từng API endpoint, cho phép nhân viên được phân quyền hợp lệ thao tác đầy đủ mà không bị lỗi 403 Forbidden.

---

## 5. PHÂN HỆ 2: CỬA HÀNG & ĐỊNH BIÊN NHÂN SỰ

* **Quản lý Cửa hàng (`/app/[companyId]/cua-hang`)**:
  * Thêm, sửa, xóa, tìm kiếm cửa hàng.
  * Gán Quản lý cửa hàng phụ trách, số điện thoại, địa chỉ, giờ mở/đóng cửa.
  * Kéo thả sắp xếp thứ tự hiển thị (`displayOrder`).
  * **Phân quyền Chi tiết 3 Cấp độ (Granular Store Permissions Enforcement)**:
    * **Chỉ xem (`VIEW`)**: Xem danh sách cửa hàng, logo, địa chỉ, số ca/ngày, không thể chỉnh sửa hay xóa.
    * **Chỉnh sửa (`EDIT`)**: Đổi tên cửa hàng, sửa địa chỉ, cập nhật logo, thay đổi số ca/ngày, kéo thả sắp xếp thứ tự hiển thị.
    * **Xoá cửa hàng (`DELETE`)**: Kiểm soát độc lập bằng nút switch *Xoá cửa hàng*.
      * Khi tắt quyền Xóa: Nút *Xóa* màu đỏ trên từng thẻ cửa hàng sẽ **tự động ẩn hoàn toàn khỏi giao diện người dùng**.
      * API `DELETE /api/stores/[id]` kiểm tra nghiêm ngặt `action: "DELETE"`, lập tức từ chối 403 Forbidden nếu thành viên không có quyền xóa, triệt tiêu mọi khả năng xóa ngoài ý muốn.
* **Quy tắc định biên cửa hàng**:
  * Thiết lập số lượng nhân sự tối thiểu trên từng khung giờ.
  * Định biên theo ngưỡng doanh thu kỳ vọng (Revenue-based staffing).

---

## 6. PHÂN HỆ 3: HỒ SƠ NHÂN VIÊN & THEO DÕI GIỜ LÀM

* **Quản lý Nhân sự (`/app/[companyId]/nhan-vien`)**:
  * Thông tin cơ bản: Mã nhân viên (tự sinh hoặc tùy chỉnh), Họ tên, Email, Điện thoại, Ảnh đại diện, Vị trí công tác.
  * Loại hợp đồng: Full-time (toàn thời gian), Part-time (bán thời gian), Thử việc (Intern/Probation).
  * Cơ chế lương: Lương cơ bản tháng (Base salary) hoặc Lương theo giờ (Hourly rate).
  * Định mức giờ làm mục tiêu (Target hours/tháng) & Số ca tối đa/tháng:
    * **Cơ chế tính toán 2 chiều tự động (Bidirectional Shift-Hour Sync)**: Khi người dùng nhập số giờ tối đa/tháng, hệ thống tự động quy đổi ra số ca dựa trên thời lượng ca trung bình (~2.6h - 3h/ca) và ngược lại.
    * **Giới hạn kiểm thực linh hoạt (Flexible Validation Limits)**: Hỗ trợ số ca tối đa/tháng lên đến **300 ca/tháng** và số giờ tối đa lên đến **720 giờ/tháng** (thay vì giới hạn cũ 62 ca) để đáp ứng trọn vẹn cho các mô hình ca ngắn, ca livestream liên tục 2h - 2.5h/ca nhiều ca trong ngày.
  * Gán cửa hàng: Một nhân viên có thể được phân quyền làm việc tại một hoặc nhiều cửa hàng (`EmployeeStore`).
  * **Bộ lọc Đa lựa chọn Thông minh & Cơ chế Lọc Xếp tầng 2 Chiều (Bidirectional Cascading Multi-Select Filters)**:
    * **Lọc Trạng thái (`Select`)**: Phân loại theo "Đang làm việc", "Đã nghỉ việc", hoặc "Tất cả trạng thái". Đóng vai trò **Bộ lọc gốc (Master Filter)** thiết lập tập ứng viên hợp lệ:
      * Khi chọn *Đang làm việc*: Bộ lọc nhân viên chỉ hiển thị nhân sự đang hoạt động; Bộ lọc cửa hàng chỉ hiển thị các cửa hàng mà nhân sự đang làm việc phụ trách.
      * Khi chọn *Đã nghỉ việc*: Bộ lọc nhân viên chỉ hiển thị nhân sự đã nghỉ; Bộ lọc cửa hàng chỉ hiển thị các cửa hàng mà các nhân sự đó từng phụ trách trước khi nghỉ.
      * Khi chuyển đổi trạng thái: Hệ thống tự động thu dọn (auto-prune) các lựa chọn cũ không còn thuộc phạm vi trạng thái mới, tránh tình trạng lưu sót bộ lọc ẩn.
    * **Cơ chế Lọc Chéo Động 2 Chiều (Bidirectional Cross-Filtering)**:
      * **Khi chọn Nhân viên cụ thể trước**: Danh sách trong **Bộ lọc Cửa hàng** tự động thu hẹp để chỉ hiển thị các cửa hàng mà những nhân viên được chọn phụ trách/làm việc.
      * **Khi chọn Cửa hàng cụ thể trước**: Danh sách trong **Bộ lọc Nhân viên** tự động thu hẹp để chỉ hiển thị những nhân viên thuộc các cửa hàng được chọn.
      * **Tự động mở rộng & Đồng bộ**: Khi xoá lựa chọn ở một bên, danh sách tuỳ chọn ở bên còn lại tự động mở rộng trở lại theo phạm vi ứng viên của trạng thái hiện hành mà không cần tải lại trang.
    * Đồng bộ trạng thái bộ lọc vào `sessionStorage` để duy trì khi chuyển đổi giữa các tab chức năng.
  * **Tính năng Thu gọn / Mở rộng Bảng Nhân viên (Collapsible Employee Table)**:
    * Cho phép người dùng bấm nút **Thu gọn bảng** / **Mở rộng bảng** ngay trên thanh tiêu đề Card.
    * Khi thu gọn, bảng dữ liệu nhân sự sẽ ẩn đi giúp tiết kiệm không gian màn hình, trong khi **thanh bộ lọc (Cửa hàng, Nhân viên, Trạng thái)** vẫn giữ nguyên trên đầu để người dùng lọc và đối soát nhanh bảng *Giờ làm thực tế trong tháng* bên dưới mà không cần phải cuộn chuột dài.
    * Hiển thị thanh thông báo trạng thái thu gọn kèm nút kích hoạt nhanh để mở lại bảng khi cần sửa/xem thông tin nhân sự.
* **Báo cáo Giờ làm Hàng tháng (`monthly-hours`)**:
  * **Đồng bộ lọc dữ liệu 2 chiều**: Khi áp dụng bộ lọc theo Cửa hàng hoặc Nhân viên ở bảng danh sách trên, bảng *Giờ làm thực tế trong tháng* bên dưới sẽ tự động cập nhật đồng bộ:
    * **Lọc theo nhân viên**: Chỉ hiển thị đúng các nhân viên được chọn.
    * **Lọc theo cửa hàng**: Chỉ hiển thị nhân viên phụ trách/làm việc tại các cửa hàng đó, đồng thời **toàn bộ số giờ làm chính, giờ làm thêm, số ca thực tế và số lỗi phát sinh chỉ tính toán trên các cửa hàng được lọc**.
  * Tự động tổng hợp số giờ đã làm thực tế trong tháng đối chiếu với chỉ tiêu giờ để phục vụ tính lương.

---

## 7. PHÂN HỆ 4: CẤU HÌNH CA & QUY TẮC ĐỊNH BIÊN

* **Ca làm việc Mẫu (`/app/[companyId]/cau-hinh-ca`)**:
  * Khai báo các ca chuẩn: Ca Sáng (08:00 - 16:00), Ca Chiều (14:00 - 22:00), Ca Tối, Ca Gãy...
  * Thiết lập: Giờ bắt đầu, Giờ kết thúc, Thời gian nghỉ giữa ca (phút), Tổng giờ công thực tế, Hệ số lương (1.0, 1.5, 2.0 cho ca đêm/ngày lễ), Mã màu nhận diện.
* **Quy tắc Định biên & Ngoại lệ**:
  * `StaffingRule`: Số lượng nhân sự tối thiểu của từng ca theo các thứ trong tuần (Thứ 2 -> Chủ Nhật).
  * `StaffingOverride`: Tăng cường định biên cho các dịp khuyến mãi Black Friday, Tết, Khai trương...
  * **Tối ưu hóa Bảng Ma trận Ca Siêu Tinh gọn (High-Density Mobile Optimized Matrix)**:
    * **Rút gọn Cột Cố định từ 3 cột (370px) xuống 2 cột (225px)**:
      * **Cột 1: `Ca` (`w-[60px]`)**: Hiển thị tên ca (Ca 1, Ca 2...), in đậm, cố định góc trái (`sticky left-0`).
      * **Cột 2: `Giờ & Thao tác` (`w-[165px]`)**: Cố định (`sticky left-[60px]`, viền `border-r`), hợp nhất toàn bộ thông tin ca và nút tác vụ:
        * Hàng trên: Khoảng thời gian ca (ví dụ: `08:00-11:00 (3h)`) đi kèm **2 nút icon siêu nhỏ tinh tế** (*Sửa ca* với icon Pencil và *Xóa ca* với icon Trash2 màu đỏ).
        * Hàng dưới: Dropdown chọn *Áp dụng cả tháng* (`h-6.5 text-[11px]`) để nhanh chóng gán định biên cho tất cả các ngày trong tháng.
        * Chế độ chỉnh sửa trực tiếp: Ô nhập giờ bắt đầu - kết thúc thu nhỏ kèm nút icon *Lưu* (Check xanh) và *Hủy* (Xám) gọn gàng.
      * Giúp giải phóng hơn **145px không gian hiển thị**, cho phép màn hình điện thoại (375px - 430px) hiển thị rõ ràng và cuộn mượt mà các cột ngày để chỉnh định biên nhân sự.
    * **Cố định Tiêu đề 2 chiều (Dual-axis Sticky Header)**:
      * Khi cuộn dọc xuống danh sách các ca (Ca 1 -> Ca 6...), toàn bộ hàng tiêu đề ngày trong tháng (1 T7, 2 CN...) và hàng ghi chú/áp dụng định biên ngày được cố định vững chắc ở đỉnh bảng (`sticky top-0`, `sticky top-[52px]`).
      * Khi cuộn ngang, 2 cột thông tin ca bên trái (Ca, Giờ & Thao tác) được cố định độc lập (`sticky left-0`, `left-[60px]`), với màu nền đặc 100% không bị lộ nội dung phía sau.
  * **Hỗ trợ Giao diện Tối (Dark Mode) chuẩn xác**:
    * Các cột cố định bên trái (Ca, Giờ & Thao tác) và hàng tiêu đề/ghi chú ngày sử dụng màu nền đồng bộ (`dark:bg-[#252526]`), viền `dark:border-[#333333]`.
    * Màu đánh dấu ngày (Day Note Colors) hiển thị dưới dạng dải màu dịu nhẹ (`dark:bg-*-950/20 dark:border-*-900/40`), chữ hiển thị rõ nét, tương phản cao, triệt tiêu hiện tượng lóa trắng trên nền tối.

---

## 8. PHÂN HỆ 5: LỊCH XẾP CA THÔNG MINH & VẬN HÀNH CA

* **Giao diện Lịch Xếp Ca (`/app/[companyId]/lich-xep-ca`)**:
  * Chế độ xem đa dạng: Xem theo Tuần (Week View), Xem theo Tháng (Month View), Xem theo Ngày (Day View).
    * **Bộ chọn ngày thông minh (`DatePicker` & `MonthPicker`)**:
      * Ở chế độ **Theo tuần**: Ô chọn ngày hiển thị dạng `20-26/07/2026 📅` (hoặc `27/07 - 02/08/2026`). Khi mở bảng lịch popup, toàn bộ 7 ngày trong tuần được chọn (T2 -> CN) sẽ được **tô đen đồng bộ (`bg-slate-900 text-white`)** trực quan.
      * Ở chế độ **Theo ngày**: Ô chọn ngày hiển thị `DD/MM/YYYY 📅`, popup tô đen đúng 1 ngày được chọn.
      * Ở chế độ **Theo tháng**: `MonthPicker` hiển thị `Tháng MM/YYYY 📅`, popup tô đen đúng tháng được chọn.
      * Ghi chú khoảng thời gian bên dưới luôn hiển thị chuẩn Ngày-Tháng-Năm `DD/MM/YYYY → DD/MM/YYYY`.
  * **Bộ lọc Đa Lựa Chọn Thông Minh (Multi-Select Filters)**:
    * **Lọc Cửa hàng (`MultiSelect`)**: Hỗ trợ chọn linh hoạt 1 hoặc nhiều cửa hàng, kèm ô tìm kiếm nhanh, nút Chọn tất cả / Bỏ chọn. Mặc định là Tất cả cửa hàng.
    * **Lọc Nhân viên (`MultiSelect`)**: Hỗ trợ chọn lọc đồng thời 1 hoặc nhiều nhân viên để theo dõi chéo ca làm việc giữa các nhân sự được chọn. Mặc định là Tất cả nhân viên.
    * Đồng bộ trạng thái vào Session Storage và URL Query API `/api/schedule?storeIds=id1,id2`. Tương thích 100% với cả 2 tính năng xuất file Excel và xuất ảnh bảng ngang.
  * **Tối ưu hóa Hiển thị Đa Kích Thước (Responsive 100% Mobile / Tablet / Desktop)**:
    * **Thanh công cụ Toolbar linh hoạt**: Tự động co giãn theo 1 dòng trên màn hình lớn hoặc chia cột gọn gàng trên mobile/tablet, không gây tràn màn hình ngang.
    * **Lịch dạng bảng dọc (Vertical Board)**: Grid cửa hàng tự động chuyển đổi `grid-cols-1` trên Mobile/Tablet và `xl:grid-cols-2` trên Desktop. Đặc biệt, danh sách các ca làm việc trong mỗi cửa hàng hiển thị dạng lưới **2 cột (`grid-cols-2`) ngay cả trên màn hình điện thoại nhỏ**, giúp người dùng theo dõi liền mạch 4 ca trong 1 màn hình mà không cần cuộn dọc quá nhiều.
    * **Thẻ ca làm việc (`CompactSlotGroup` & `CompactAssignedSlotRow`)**:
      * Tối ưu kích thước chữ (`text-[10px] - text-xs`), padding tinh gọn, lược bỏ tên cửa hàng trùng lặp để thẻ ca hiển thị cân xứng hoàn hảo khi chia 2 cột trên điện thoại.
      * Sử dụng cấu trúc `min-w-0 flex-1 overflow-hidden` và `truncate` cho tên nhân viên và ca làm việc.
      * Cụm nút thao tác (Thêm lỗi `+`, Kéo thả `⠿`, Xóa `✕`) được gán `shrink-0`, cố định an toàn 100% bên trong khung thẻ, triệt tiêu hoàn toàn hiện tượng icon bị tràn ra ngoài viền khi co giãn cửa sổ.
    * **Lịch dạng bảng ngang (Horizontal Board)**: Hỗ trợ cuộn ngang mượt mà kèm thanh kéo chuột tùy chỉnh và tính năng Pan bằng phím `R`.
  * **Menu Xuất Dữ Liệu Lịch Gộp Thông Minh (Export Popover Menu)**:
    * Nút bấm biểu tượng Download (`Download`) tinh gọn trên thanh Toolbar, khi click sẽ mở popup gồm **2 tùy chọn xuất chuyên nghiệp**:
      1. **Xuất File Excel (.xlsx) Đa Sheet Có Màu Sắc Định Dạng Cao Cấp (`schedule-excel-exporter.ts`)**:
         * **Sheet 1 ("Lịch xếp ca")**: Ma trận trực quan hiển thị từng Cửa hàng, Ca làm, Khung giờ và Ngày trong kỳ. Từng ô ca làm được tô màu phân biệt: Ca đã xếp đủ người (Xanh dương phấn `#EFF6FF` / `#1E3A8A`), Ca trống/chưa đủ người (Vàng nhạt `#FEF3C7` / `#B45309`), hiển thị kèm giờ tăng ca `+Xh OT` và vi phạm.
         * **Sheet 2 ("Tổng hợp công & Giờ làm")**: Thống kê danh sách nhân sự, **chi tiết số ca làm việc (`CA: [TÊN CH]`) và số giờ làm việc (`GIỜ: [TÊN CH]`) ở từng cửa hàng mà mỗi nhân viên phụ trách** (cặp cột động theo từng cửa hàng trong phạm vi lọc/công ty), Tổng số ca làm, Giờ tiêu chuẩn, Giờ tăng ca OT và Tổng số giờ làm việc trong kỳ. Header màu Teal sang trọng (`#0F766E`) kèm dòng Tổng cộng (Total) ở cuối tự động tính tổng ca và tổng giờ của từng cửa hàng cũng như toàn hệ thống.
         * **Sheet 3 ("Chi tiết Tăng ca & Vi phạm")**: Bảng kê chi tiết từng ca có nhân viên làm thêm giờ hoặc vi phạm đi trễ/về sớm kèm lý do.
      2. **Xuất Hình Ảnh PNG Độ Phân Giải Cao (HD 2x) (`schedule-image-exporter.ts`)**:
         * Tự động chụp lại toàn bộ bảng lịch hiện tại (dạng bảng ngang) với chất lượng sắc nét 2x Retina.
         * Gắn kèm Header Watermark thanh lịch: Logo ApexFlow + Tên Workspace/Cửa hàng + Khoảng thời gian + Tình trạng ca đã xếp/trống + Ngày giờ xuất báo cáo.
* **Thuật toán Tự động Xếp Ca (Auto-Scheduler Engine)**:
  * Cân đối tổng giờ làm việc công bằng giữa các nhân viên.
  * Tự động kiểm tra nhân viên có thuộc cửa hàng đó không (`EmployeeStore`).
  * Tránh xung đột ca: Không xếp 2 ca đè giờ nhau hoặc 2 ca liên tiếp thiếu thời gian nghỉ tối thiểu (ví dụ: làm ca đêm hôm trước không được xếp ca sáng sớm hôm sau).
  * Đảm bảo đủ định biên nhân sự của cửa hàng.
* **Vận hành Ca thực tế**:
  * **Tăng ca (`ShiftOvertime`)**: Đăng ký và duyệt làm thêm giờ kèm hệ số lương.
  * **Ghi nhận Vi phạm (`ShiftFault`)**: Ghi nhận đi trễ, về sớm, vắng mặt, số phút trễ, trừ điểm thi đua / tiền phạt.
  * **Ghi chú ngày (`ScheduleDayNote`)**: Tạo ghi chú màu sắc nhắc việc trên từng ngày.
  * **Yêu cầu Phê duyệt (`ScheduleApprovalRequest`)**: Nhân viên gửi yêu cầu đổi ca cho nhau -> Quản lý duyệt -> Lịch tự động hoán đổi.

---

## 9. PHÂN HỆ 6: HÀNG HÓA, TỒN KHO & ĐƠN ĐẶT NSX

Đường dẫn chính: `/app/[companyId]/hang-hoa` gồm **3 Tab Chuyên biệt**:

### 9.1. Tab 1: Nhập hàng (Đơn đặt NSX & Lô hàng sản xuất) - `?tab=import`
* **Mục đích**: Quản lý quy trình từ khi gửi đơn đặt hàng gia công đến xưởng may (NSX), theo dõi tiến độ sản xuất, QC kiểm tra chất lượng tại xưởng, tách lô lỗi và nhập kho chính thức.
* **Thanh công cụ Toolbar**:
  * Ô tìm kiếm: Tìm theo Mã PO, Mã Lô, Tên NSX, Tên sản phẩm.
  * Bộ lọc trạng thái: Đang sản xuất (`IN_PRODUCTION`), Đang QC (`QC_INSPECTION`), Quá hạn giao (`OVERDUE`), Có hàng hư trả NSX (`PARTIAL_RETURN`), Đã nhập kho xong (`COMPLETED`).
  * Nút **`Quản lý NSX`**: Mở popup quản lý danh sách xưởng may/nhà cung ứng.
  * Nút **`+ Tạo đơn đặt NSX`**: Mở popup tạo phiếu đặt xưởng PO với nhiều sản phẩm & biến thể cùng lúc.
* **Quy trình Vòng đời Đơn đặt xưởng & Lô hàng**:
  1. **Khởi tạo đơn (PO Creation)**: Chọn NSX, Ngày đặt hàng (OD), Ngày hẹn giao (ED), thêm danh sách sản phẩm, chọn màu, size, số lượng đặt -> Hệ thống sinh mã PO và các mã Lô hàng (`batchCode`).
  2. **Theo dõi Sản xuất**: Hiển thị cảnh báo màu đỏ nếu ngày hiện tại vượt quá ngày hẹn giao (Overdue).
  3. **Kiểm tra Chất lượng (QC Flow)**:
     * Nhập số lượng đạt (QC Pass) -> Tự động cộng vào tồn kho sản phẩm.
     * Nhập số lượng lỗi (QC Defect) -> Hệ thống tự động tách dòng thành lô hàng lỗi trả xưởng (`PARTIAL_RETURN` / `REJECTED_RETURN`) kèm lý do lỗi để xử lý công nợ với xưởng.
  4. **In Tem Nhãn Thùng / Lô hàng**:
     * In tem Barcode EAN-8 chuẩn kèm thông tin PO, Mã Lô, Tên sản phẩm, Màu, Size, Số lượng để dán lên thùng hàng khi nhập kho.
* **Quản lý Nhà sản xuất (NSX)**:
  * Quản lý danh sách xưởng may: Mã 3 chữ số EAN-8 (ví dụ: `893`), Tên xưởng, SĐT, Mã số thuế, Địa chỉ xưởng.
  * Hỗ trợ Thêm, Sửa, Xóa (tự động gỡ liên kết an toàn).

### 9.2. Tab 2: Sản phẩm (Dòng sản phẩm & Biến thể SKU) - `?tab=products`
* **Mục đích**: Khai báo danh mục sản phẩm của thương hiệu, tự động sinh mã SKU chuẩn và tạo biến thể ma trận Màu x Size.
* **Nguyên tắc Thiết kế Khởi tạo Sạch (Clean Slate Rule)**:
  * Không chứa bất kỳ dữ liệu mẫu cố định (hardcoded preset) nào (Thương hiệu, Chủng loại, Chất liệu, Tên, Giá, Màu sắc, Size đều bắt đầu trống).
  * Người dùng bấm `+ Thêm` Thương hiệu / Chủng loại / Chất liệu theo thực tế của doanh nghiệp.
  * Dữ liệu chủng loại / chất liệu / thương hiệu tự động đồng bộ và lưu trữ vào CSDL.
* **Quy tắc tạo sản phẩm**:
  * Không gán Nhà sản xuất ở bước tạo sản phẩm (NSX chỉ được gán khi tạo Đơn đặt xưởng PO ở Tab Nhập hàng).
* **Thuật toán Sinh mã SKU Thông minh Chuẩn 8 ký tự (`sku-engine.ts`)**:
  * Cấu trúc: `[Ký tự Chủng loại (1)][Ký tự Chất liệu (1)][2 số Mã Tên SP (ngẫu nhiên)][2 số Mã Màu (ngẫu nhiên/chuẩn)][2 số Mã Size (tái sử dụng)]` = **8 ký tự**.
  * Ví dụ: Chủng loại Áo (`V`), Chất liệu Thun giấy (`X`), Tên SP Dak rad (Mã `01`), Màu Vàng (`06`), Size XL (`05`) -> SKU: **`VX010605`**.
  * Biến thể Màu Vàng - Size L (`04`) -> SKU: **`VX010604`**.
  * Biến thể Màu Trắng (`01`) - Size XL (`05`) -> SKU: **`VX010105`**.
  * Mã gốc gom cụm theo Màu (Base SKU): Lấy 6 ký tự đầu (`VX0106` + `xx`) để phân tách các màu thành từng cụm dòng độc lập trên bảng danh sách.
* **Thuật toán Sinh mã Barcode EAN-8**:
  * Cấu trúc: `[3 số Mã NSX/Prefix][4 số Thứ tự Sản phẩm][1 số Checksum EAN-8]`.
* **Quản lý Dòng sản phẩm & Cụm Màu (Grouped by Color Cluster)**:
  * Khi tạo một sản phẩm có nhiều màu (VD: 3 màu Vàng, Trắng, Đen), hệ thống tự động tách thành **3 cụm dòng độc lập** tương ứng với 3 màu đó.
  * Tất cả các size trong cùng một cụm màu có **trùng 6 ký tự đầu** (VD: cụm Vàng `VX0106xx`, cụm Trắng `VX0101xx`, cụm Đen `VX0102xx`).
  * Mỗi cụm hiển thị ảnh đại diện riêng theo màu, nhãn tên màu, số lượng biến thể size của màu đó, khoảng giá bán `Min - Max`.
  * Click vào dòng để mở rộng (Accordion) xem bảng chi tiết từng size (S, M, L, XL) với mã SKU chính xác 8 ký tự.
  * **Sửa / Xóa theo Cụm Màu**: Cho phép chỉnh sửa hoặc xóa nhanh toàn bộ các biến thể của riêng cụm màu đó hoặc xóa toàn bộ dòng sản phẩm.

### 9.3. Tab 3: Tồn kho (Live Inventory & Sổ kho) - `?tab=inventory`
* **Mục đích**: Kiểm soát số lượng hàng tồn kho thực tế của từng mã SKU và theo dõi hàng sắp về từ các đơn xưởng PO.
* **Quy chuẩn hiển thị đồng bộ với Tab Sản phẩm**:
  * **Hình ảnh đại diện sản phẩm**: Hiển thị ảnh sắc nét theo từng cụm màu/sản phẩm ở cột đầu tiên.
  * **Phân cụm theo Màu sắc**: Gom nhóm và phân tách theo từng cụm màu của sản phẩm (trùng 6 ký tự đầu `[BaseSKU]xx`).
  * **Mã gốc (SKU)**: Hiển thị dạng `[BaseSKU]xx` (VD: `VX0106xx`, `VX0101xx`).
  * **Bảng chi tiết biến thể con (Accordion)**: Liệt kê chi tiết từng size với SKU 8 ký tự chính xác, mã vạch EAN-8, số lượng tồn kho thực tế, số lượng sắp về hàng, và trạng thái kho.
* **Cơ chế cập nhật tự động**:
  * Tự động cộng dồn số lượng thực nhận sau khi hoàn tất kiểm tra QC (QC Pass) từ Tab Nhập hàng.
  * Cảnh báo tồn kho dưới mức an toàn (`minStock` $\le 5$ hoặc hết hàng $= 0$).
  * Thanh tìm kiếm quét nhanh mã vạch Barcode EAN-8 hoặc mã SKU để tra cứu tức thì.

---

## 10. PHÂN HỆ 7: CÀI ĐẶT DOANH NGHIỆP, THÀNH VIÊN & GIAO DIỆN

Đường dẫn: `/app/[companyId]/cai-dat`
* **Hồ sơ Doanh nghiệp**: Logo công ty, Tên doanh nghiệp, Mã định danh Slug, Địa chỉ, Email liên hệ.
* **Cài đặt Giao diện (Theme Preferences)**:
  * Lựa chọn trực tiếp 3 chế độ: ☀️ Giao diện sáng, 🌙 Giao diện tối (Neutral Charcoal & True Black), 💻 Tự động theo hệ điều hành (OS).
  * Hiển thị trạng thái đang kích hoạt (`Check` icon) và giải thích tương thích.
* **Quản lý Thành viên & Mời người dùng vào Doanh nghiệp**:
  * Mời thành viên mới qua email với tính năng **chỉ định vai trò trực tiếp khi gửi lời mời** (Lựa chọn giữa **"Không có quyền"** và các **Vai trò tùy chỉnh** do doanh nghiệp tự tạo, loại bỏ hoàn toàn các vai trò mặc định cũ).
  * Tích hợp nút **"+ Tạo vai trò"** trực tiếp trong hộp thoại Mời thành viên, cho phép tạo nhanh vai trò mới kèm ma trận phân quyền chi tiết mà không cần thoát ra ngoài. Khi tạo thành công, hệ thống tự động chọn vai trò mới này.
  * **Huỷ lời mời đang chờ (`Cancel Invitation`)**: Bảng "Lời mời đang chờ" cung cấp nút **[Huỷ lời mời]** cho phép Quản trị viên/Chủ sở hữu thu hồi lời mời bất kỳ lúc nào trước khi người nhận đăng nhập.
  * **Tự rời doanh nghiệp (`Leave Company`)**:
    * Trong bảng Thành viên, dòng của tài khoản đang đăng nhập (chính chủ) luôn trang bị nút **[Thoát]** (`LogOut` icon):
      * **Đối với thành viên thường / quản lý (`role !== "OWNER"`)**: Bấm [Thoát] sẽ mở hộp thoại xác nhận rời doanh nghiệp. Khi xác nhận, API `POST /api/companies/leave` sẽ xoá bản ghi `CompanyMember`, giải phóng `user.companyId` và xoá lời mời tương ứng, sau đó điều hướng về trang `/workspaces`.
      * **Đối với Chủ sở hữu (`role === "OWNER"`)**: Bấm [Thoát] sẽ mở hộp thoại **"Chuyển giao quyền & Thoát"**, yêu cầu chỉ định 1 thành viên tiếp quản quyền Chủ sở hữu. Khi thành viên được chọn chấp thuận lời mời, họ sẽ trở thành Chủ sở hữu mới và Chủ sở hữu cũ sẽ **tự động được rời khỏi doanh nghiệp**.
    * Trên trang Không gian làm việc (`/workspaces`), thẻ các doanh nghiệp được phụ trách cũng trang bị nút **[Thoát / Rời doanh nghiệp]** nhanh.
  * **Xoá thành viên triệt để (`Clean Member Deletion`)**: Khi xoá nhân viên khỏi doanh nghiệp, hệ thống xoá bản ghi `CompanyMember`, đồng thời xóa sạch liên kết `user.companyId` và mọi bản ghi lời mời `CompanyInvitation` tương ứng, đảm bảo doanh nghiệp không còn xuất hiện trong trang Không gian làm việc (`/workspaces`) của nhân viên đó và không bị tự động khôi phục.
  * Khi người được mời đăng nhập vào hệ thống, lời mời hợp lệ sẽ tự động được chấp thuận và kế thừa đầy đủ vai trò `companyRoleId` đã được gán sẵn.
* **Quy tắc Đơn sở hữu (Single Owner Rule) & Chuyển giao quyền Chủ sở hữu (Ownership Transfer Workflow)**:
  * Mỗi doanh nghiệp tại mọi thời điểm chỉ có **DUY NHẤT 1 Chủ sở hữu (`role: "OWNER"`)**.
  * **Bảo vệ Chủ sở hữu**: Người không phải Chủ sở hữu (kể cả khi được phân quyền xem/chỉnh sửa tab Cài đặt) **không thể thấy tùy chọn Chủ sở hữu** trong dropdown, **không thể chỉnh sửa hoặc xóa** tài khoản của Chủ sở hữu.
  * **Luồng chuyển giao quyền Chủ sở hữu an toàn (2-way Confirmation)**:
    * Chỉ Chủ sở hữu hiện tại mới có quyền chọn *"👑 Chuyển giao quyền Chủ sở hữu"* cho một thành viên trong danh sách hoặc qua tính năng "Thoát doanh nghiệp".
    * Khi bấm Lưu / Gửi lời mời, hệ thống tạo bản ghi `OwnershipTransfer` ở trạng thái `PENDING` (chưa chuyển quyền ngay).
    * **Khóa gửi lời mời đồng thời**: Khi đang có 1 lời mời chuyển quyền chờ xác nhận, tùy chọn chuyển giao quyền Chủ sở hữu ở tất cả các tài khoản khác sẽ bị **mờ và vô hiệu hóa (`disabled`)**. Chủ sở hữu chỉ có thể mời người khác sau khi đã bấm **Huỷ lời mời** hiện tại hoặc khi người nhận bấm từ chối.
    * **Đối với người được chuyển giao**:
      * *Trường hợp 1 (Đã có quyền vào Cài đặt)*: Nhận thông báo Banner nổi bật ngay phía trên bảng Danh sách thành viên kèm 2 nút **[Tiếp nhận quyền]** và **[Từ chối]**.
      * *Trường hợp 2 (Chưa có quyền vào Cài đặt)*: Hệ thống **đặc cách hiển thị tab Cài đặt & Phân quyền trên Sidebar** (kèm huy hiệu *Lời mời*). Khi click vào, trang **ẩn toàn bộ thông tin quản trị** và **chỉ hiển thị duy nhất Thẻ tiếp nhận lời mời làm Chủ sở hữu**.
    * Khi người nhận bấm **[Tiếp nhận quyền Chủ sở hữu]**: Thực hiện transaction nguyên tử chuyển người nhận thành `OWNER` (toàn quyền) và **tự động xoá tư cách thành viên của Chủ sở hữu cũ khỏi doanh nghiệp**.
* **Quản lý Vai trò Tùy chỉnh (Roles Management) & Phân quyền Chi tiết (Granular Permissions)**:
  * Doanh nghiệp có thể tạo, chỉnh sửa và phân bổ quyền chi tiết theo từng phân hệ (`schedule`, `store`, `products`, `employees`, `shift_config`, `settings`).
  * **Cơ chế Phân quyền Chi tiết theo từng Thành viên (`Per-Member Granular Permissions`)**:
    * Khi mở bảng phân quyền của một thành viên, hệ thống tải chính xác quyền hạn thực tế hiện tại (nếu thành viên chưa tùy chỉnh, hệ thống tự động kế thừa từ Vai trò được gán).
    * Khi quản trị viên điều chỉnh các switch quyền hạn chi tiết cho từng thành viên, hệ thống lưu trực tiếp cấu hình quyền hạn này vào bản ghi `CompanyMember`.
    * Cấu hình phân quyền chi tiết của thành viên có độ ưu tiên cao nhất, áp dụng ngay lập tức trên cả Giao diện (Sidebar, các trang chức năng, các nút thao tác) và toàn bộ các API Backend thông qua `requireAuth` và `hasPermission`.
* **Quản lý Gói cước (Subscription)**: Hiển thị gói dịch vụ (Free, Pro, Enterprise), giới hạn số lượng cửa hàng, nhân viên, dung lượng lưu trữ.
* **Vùng Nguy hiểm (Danger Zone)**: Giải thể doanh nghiệp (`/api/companies/disband`) - Xóa toàn bộ dữ liệu công ty và quan hệ cascade an toàn.

---

### 7.8. Phân hệ 8: Đơn hàng & Bán hàng Đa kênh (Multi-Channel Orders, POS & E-commerce Revenue)
* **Tổng quan Kiến trúc**:
  * Ghi nhận và đối soát toàn bộ đơn hàng từ mọi kênh bán hàng:
    * **Sàn TMĐT (E-commerce)**: Shopee (Shopee Open Platform), TikTok Shop (TikTok Shop Partner API), Lazada.
    * **Bán lẻ tại quầy (POS In-store)**: Bán trực tiếp tại từng cửa hàng, đứng quầy theo ca trực nhân viên.
    * **Mạng xã hội & Giao hàng (Social & Shipping)**: Facebook, Zalo, Instagram (lên đơn COD, tính phí ship và địa chỉ giao hàng).
    * **Website**: Đơn hàng trực tuyến từ ApexFlow Web.
* **Cơ chế Đồng bộ Tồn kho & Đơn hàng Tự động 2 chiều (Bidirectional Real-Time Sync)**:
  * **Trừ tồn kho tức thì (`Real-time Stock Deduction`)**:
    * Khi lên đơn tại POS hoặc khi đơn từ Sàn TMĐT đổ về, hệ thống tự động trừ trực tiếp số lượng tồn kho `stockQuantity` của từng biến thể SKU sản phẩm trong bảng `Product`.
    * Khi đơn hàng bị huỷ (`CANCELLED`), hệ thống tự động hoàn trả lại số lượng tồn kho và cập nhật lại chỉ số khách hàng trong transaction nguyên tử.
  * **Cơ chế Lấy đơn từ Sàn TMĐT**:
    * **Webhook Push API**: Các sàn TMĐT (Shopee, TikTok Shop) gửi dữ liệu đơn hàng thời gian thực tới webhook endpoint của ApexFlow khi khách đặt hàng. Hệ thống tự động tạo đơn và trừ tồn kho ngay lập tức.
    * **Polling / Quét định kỳ**: Tự động quét API mỗi 10-15 phút để đảm bảo không sót đơn hàng.
  * **Cập nhật Tồn kho ngược lên sàn (Outbound Sync)**:
    * Khi bán hàng tại quầy hoặc khi nhập thêm hàng từ xưởng may (`FactoryOrder`), hệ thống tự động gọi API cập nhật tồn kho của sàn theo mã SKU đã liên kết.
* **Giao diện Tab "Đơn hàng" (`/app/[companyId]/don-hang`)**:
  * **Thanh điều hướng Sidebar**:
    * Hiển thị mục **"Đơn hàng"** (`ShoppingBag` icon).
    * Không đặt tab Bán hàng riêng biệt trên sidebar nhằm giữ sự tinh giản tuyệt đối cho menu.
  * **Nút bấm [🛒 Lên đơn Bán hàng (POS)]**:
    * Nút hành động nổi bật trên thanh công cụ của tab Đơn hàng.
    * Khi click sẽ mở trực tiếp màn hình Bán hàng (POS) ở **tab mới độc lập (`target="_blank" rel="noopener noreferrer"`)** tại địa chỉ `/pos/[companyId]`.
  * **Báo cáo Doanh thu Thu gọn [Chi tiết doanh thu] (Collapsible KPI & Revenue Analytics)**:
    * Mặc định thu gọn nhằm tiết kiệm không gian hiển thị cho bảng quản lý đơn hàng.
    * Nút bấm **"Chi tiết doanh thu"** hiển thị nhanh tổng thực thu (kèm icon `TrendingUp` và mũi tên đóng/mở).
    * Khi click bung ra:
      * **Bộ thẻ KPI Tài chính**: Doanh thu thực thu, Lợi nhuận gộp & Tỷ suất lợi nhuận %, Tổng số đơn hàng & Giá trị trung bình đơn (AOV), Kênh bán hàng hiệu quả nhất.
      * **Thanh tỷ trọng Phân bổ Doanh thu Đa kênh**: Thanh progress phân tầng màu (Shopee, TikTok Shop, POS, Facebook, Website) kèm các thẻ kênh bán để lọc nhanh.
  * **Bộ lọc Đa chiều Thời gian thực**:
    * Bộ lọc thời gian nhanh: Hôm nay, 7 ngày qua, Tháng này, Tháng trước, Toàn thời gian.
    * Lọc theo Kênh bán (`channel`), Cửa hàng (`storeId`), Trạng thái đơn (`orderStatus`), Trạng thái thanh toán (`paymentStatus`).
    * Thanh tìm kiếm nhanh theo Mã đơn, Tên khách hàng, SĐT, Mã vận đơn hoặc SKU sản phẩm.
  * **Bảng Quản lý Đơn hàng & Modal Chi tiết Hoá đơn**:
    * Xem đầy đủ danh sách mặt hàng trong đơn, giá bán, giá vốn, chiết khấu, khách hàng, nhân viên phụ trách.
    * Nút In hoá đơn (`window.print()`).
    * Nút Huỷ đơn hàng & Hoàn tồn kho an toàn có xác nhận.
    * Nút Xuất Excel / CSV báo cáo đơn hàng.
* **Giao diện Màn hình "Bán hàng (POS)" Độc lập (`/pos/[companyId]`) - Fullscreen Dedicated POS**:
  * **Không chứa Sidebar Dashboard**: Màn hình thiết kế chuyên biệt toàn màn hình cho thu ngân / nhân viên bán lẻ đứng quầy.
  * **Thanh Header Độc lập**:
    * Logo thương hiệu ApexFlow POS + Huy hiệu *Thu ngân & Bán hàng*.
    * Đồng hồ thời gian thực và chọn nhanh Chi nhánh / Nhân viên thu ngân đứng ca.
    * Chuyển đổi Theme Sáng/Tối.
    * Nút **[Trang Quản Lý]**: Click để quay lại tab Đơn hàng (`/app/[companyId]/don-hang`).
  * **Cột trái (Danh mục Sản phẩm & Tìm kiếm/Barcode)**:
    * Thanh tìm kiếm tức thì theo Tên, SKU hoặc Quét mã vạch Barcode EAN-8.
    * Thanh chuyển đổi danh mục sản phẩm nhanh.
    * Lưới thẻ sản phẩm hiển thị ảnh, tên, SKU, màu sắc, kích thước, giá bán và huy hiệu cảnh báo tồn kho thời gian thực.
    * Thao tác 1-click để đưa sản phẩm vào giỏ hàng.
  * **Cột phải (Giỏ hàng & Thanh toán Đa kênh)**:
    * Chọn Kênh bán hàng (Tại quầy POS hoặc Lên đơn Mạng xã hội / COD).
    * Nhập thông tin Khách hàng (Tự động cập nhật CRM khách hàng thân thiết).
    * Điều chỉnh số lượng (+ / -) và xoá dòng sản phẩm.
    * Chọn Hình thức thanh toán: Tiền mặt, Chuyển khoản QR, Quẹt thẻ, Thu hộ COD.
    * Máy tính tiền thối thông minh cho Tiền mặt với các nút chọn nhanh mệnh giá (50k, 100k, 200k, 500k, Đủ tiền).
    * Nút bấm lớn **"Thanh toán & Trừ Tồn Kho"**: Tự động lưu đơn, trừ tồn kho tức thì và hiển thị hộp thoại in hoá đơn bán hàng.
* **Ma trận Phân quyền Module `revenue`**:
  * `VIEW`: Xem danh sách đơn hàng và báo cáo doanh thu tài chính.
  * `EDIT`: Nhân viên được phép truy cập giao diện Bán hàng (POS) để lên đơn, sửa thông tin đơn hàng.
  * `DELETE`: Huỷ đơn hàng và hoàn trả lại tồn kho (chỉ Quản trị viên và Chủ sở hữu).

---

### 7.9. Phân hệ Thông báo Cá nhân & Lịch sử Thao tác (Notification Center & Audit Trail)

* **Vị trí & Cơ chế Kích hoạt trên Sidebar**:
  * Icon chiếc chuông thông báo (`Bell`) được tích hợp trực tiếp vào thanh Sidebar, nằm **ngay phía trên icon chuyển đổi giao diện Theme (`ThemeToggle`)** ở cả chế độ Sidebar mở rộng lẫn thu nhỏ (collapsed icon-only mode).
  * **Hiệu ứng Chuông rung lắc & Chấm đỏ (Unread Alert)**:
    * Khi có thông báo chưa đọc (`unreadCount > 0`), icon chiếc chuông sẽ tự động lắc (animation `@keyframes bell-ring`) kèm chấm đỏ thông báo nổi bật.
    * Khi người dùng click vào mở bảng thông báo, chấm đỏ sẽ tự động biến mất (được đánh dấu đã đọc `read: true` qua API `/api/user-notifications/mark-read`).
* **Tab 1: "Thông báo" Cá nhân (User-Scoped Notification Widget)**:
  * **Cách ly dữ liệu cá nhân**: Mỗi người dùng / nhân viên chỉ có thể xem được thông báo của riêng tài khoản mình trong công ty.
  * **Định dạng thời gian xuất hiện (Relative Time Ago)**: Mỗi thông báo hiển thị khoảng thời gian xuất hiện trực quan (vd: *"Vừa xong"*, *"6 phút trước"*, *"2 giờ trước"*, *"Hôm qua"*, *"28/08"*) theo phong cách widget thông báo Dynamic Island / iOS.
  * Phân loại cấp độ thông báo (`success`, `warning`, `error`, `info`) kèm icon màu sắc tương ứng.
  * Nút "Xoá tất cả" để người dùng dọn sạch hộp thư thông báo.
* **Tab 2: "Lịch sử thao tác" Hệ thống (System Audit Trail)**:
  * **Cơ chế Phân quyền 4 Cấp độ (4-Tier Permission Matrix)**:
    * `NONE` (Không có quyền): Ẩn hoàn toàn tab "Lịch sử thao tác" trong Notification Popover và API `/api/activity-logs` trả về `403 Forbidden`. Áp dụng mặc định cho các tài khoản nhân viên thường chưa được cấp quyền.
    * `SELF` (Chỉ xem của chính mình): Chỉ hiển thị và cho phép xem các thao tác do chính tài khoản của nhân viên đó thực hiện (`userId === session.user.id` hoặc `userEmail === session.user.email`).
    * `CUSTOM` (Xem của nhân viên/email cụ thể): Cho phép quản trị viên chỉ định danh sách các tài khoản nhân sự cụ thể (`allowedUserIds`) mà nhân viên này được phép xem lịch sử thao tác.
    * `ALL` (Xem toàn bộ): Cho phép xem toàn bộ lịch sử thao tác của mọi thành viên trong toàn doanh nghiệp. Mặc định áp dụng cho `OWNER` và `ADMIN`.
  * **Tính Bất biến của Lịch sử Thao tác (Immutable Audit Trail)**:
    * Lịch sử thao tác là dữ liệu kiểm toán hệ thống bất biến, **tuyệt đối không thể chỉnh sửa hay xoá bỏ** dưới bất kỳ hình thức nào.
  * **Ghi nhận tự động các hành động có tính ảnh hưởng**:
    * Ghi lại tất cả thao tác tạo mới, chỉnh sửa, xoá, phê duyệt, từ chối, huỷ đơn, nhập xuất dữ liệu (`CREATE`, `UPDATE`, `DELETE`, `CANCEL`, `APPROVE`, `REJECT`, `IMPORT`, `EXPORT`) trên toàn bộ các phân hệ (Nhân sự, Cửa hàng, Cấu hình ca, Lịch xếp ca, Hàng hoá, Đơn hàng, Phân quyền cài đặt).
    * **Phân quyền & Vai trò**: Khi cập nhật vai trò / phân quyền thành viên hoặc vai trò tùy chỉnh, hệ thống tự động bóc tách và tóm tắt chi tiết toàn bộ danh sách các quyền được cấp trên từng phân hệ theo tiếng Việt rõ ràng (vd: *Cửa hàng: Xem & Sửa | Nhân sự: Xem danh sách, Xem giờ làm, Chỉnh sửa | Lịch xếp ca: Toàn quyền xếp ca | Lịch sử thao tác: Xem nhân sự chỉ định*).
    * **Cấu hình ca & Định biên nhân sự**: Khi điều chỉnh số lượng nhân viên trong 1 ca (theo thứ trong tuần hoặc theo ngày cụ thể / sao chép tuần / sao chép ngày), hệ thống tự động ghi nhật ký chi tiết gồm tên ca, khung giờ ca, thứ / ngày áp dụng, tên cửa hàng và định biên nhân sự mới.
    * Bỏ qua các hành động xem hoặc chuyển tab của nhân viên để tối ưu dung lượng và hiệu năng.
  * **Thanh tìm kiếm & Lọc phân hệ tức thì**: Tìm kiếm theo tên nhân viên thực hiện, email, đối tượng tác động hoặc lọc theo từng phân hệ cụ thể kết hợp với phạm vi phân quyền đã cấp.
  * **Hộp thoại Xem chi tiết Thao tác (Audit Detail Modal)**:
    * Thời gian thao tác chính xác (ngày, giờ, phút, giây).
    * Thông tin nhân viên thực hiện: Họ tên, Email, Chức vụ.
    * Phân hệ & Loại đối tượng tác động (Target Module & Type).
    * Khối dữ liệu chi tiết có cấu trúc (Payload / Changes) hiển thị các thẻ quyền hạn (badges) và bảng chi tiết tiếng Việt trực quan, đã được giải mã mã CUID sang tên tiếng Việt thực tế.

---

## 11. QUY TẮC DUY TRÌ & CẬP NHẬT BẢN THIẾT KẾ NÀY

1. **Tính chất Bất biến của Tài liệu**:
   * File `PROJECT_SPECIFICATION.md` này là **Kim chỉ nam tối cao (Single Source of Truth)** của dự án ApexFlow.
   * Mọi lập trình viên và AI Agent khi làm việc với dự án BẮT BUỘC phải đọc file này trước tiên để hiểu toàn bộ luồng nghiệp vụ.
2. **Quy tắc Cập nhật Liên tục**:
   * Khi người dùng yêu cầu **thêm tính năng mới** -> Bổ sung mô tả chi tiết vào phân hệ tương ứng trong file này.
   * Khi người dùng yêu cầu **sửa đổi hoặc loại bỏ tính năng** -> Lập tức sửa đổi hoặc xóa bỏ phần ghi chú cũ trong file này.
   * File này luôn luôn phản ánh **100% hiện trạng phiên bản mới nhất** của dự án.
