# 🏛️ HỆ THỐNG KIẾN TRÚC VÀ QUY TẮC DATABASE (ORACLE CLOUD POSTGRESQL)

> ⚠️ **TÀI LIỆU QUAN TRỌNG DÀNH CHO AGENT & DEVELOPER**:
> Mọi phiên làm việc phải đọc và tuân thủ tuyệt đối các quy tắc trong tài liệu này trước khi thực hiện bất kỳ thao tác nào lên Database hoặc File cấu hình (`.env`, `docker-compose.yml`, `schema.prisma`).

---

## 1. 🖥️ TỔNG QUAN HỆ THỐNG & 2 DATABASE ĐỘC LẬP

Server lưu trữ: **Oracle Cloud Ubuntu VM** (`140.245.105.160`)

```mermaid
graph TD
    UserDev[Local Machine / Next.js Dev] -->|Cổng 5433| DevDB[(Dev DB: quanlinhansu_dev)]
    UserProd[Người dùng Web / apexflow.id.vn] -->|Cổng 5432| ProdDB[(Production DB: quanlinhansu)]
    DevDB -.->|KHÔNG BAO GIỜ GỘP / ĐÈ| ProdDB
```

### A. Database Production (Chính thức - Trực tiếp)
* **Mục đích**: Chạy cho toàn bộ người dùng thật trên website [https://apexflow.id.vn](https://apexflow.id.vn).
* **Host**: `140.245.105.160`
* **Cổng (Port)**: `5432`
* **Database Name**: `quanlinhansu`
* **User**: `postgres`
* **Password**: `IdpyutdZI3y1qDHJaTn-gsoaG3l8MAUi` (Mật khẩu bảo mật cao 32 ký tự ngẫu nhiên)
* **Chuỗi kết nối chuẩn**:
  ```env
  DATABASE_URL="postgresql://postgres:IdpyutdZI3y1qDHJaTn-gsoaG3l8MAUi@140.245.105.160:5432/quanlinhansu?schema=public"
  DIRECT_URL="postgresql://postgres:IdpyutdZI3y1qDHJaTn-gsoaG3l8MAUi@140.245.105.160:5432/quanlinhansu?schema=public"
  ```
* 🛑 **NGUYÊN TẮC BẢO VỆ PROD**:
  1. Tuyệt đối KHÔNG trỏ file `.env` local sang cổng 5432 khi đang code/test tính năng.
  2. Tuyệt đối KHÔNG chạy lệnh reset, drop, truncate hoặc dump đè từ Dev sang Production.
  3. Khi cần xem trực quan DB Production, chạy: `npm run db:studio:prod` (Mở cổng `5556`).

---

### B. Database Development (Phát triển & Kiểm thử)
* **Mục đích**: Dành riêng cho lập trình viên chạy test code trên máy local (`npm run dev`), tạo dữ liệu giả lập test tính năng.
* **Host**: `140.245.105.160`
* **Cổng (Port)**: `5433`
* **Database Name**: `quanlinhansu_dev`
* **User**: `postgres`
* **Password**: `jTgC48v11MCVqB_KH28MthKhQ2ZCUH_b` (Mật khẩu bảo mật cao 32 ký tự ngẫu nhiên)
* **Chuỗi kết nối chuẩn trong file `.env` local**:
  ```env
  DATABASE_URL="postgresql://postgres:jTgC48v11MCVqB_KH28MthKhQ2ZCUH_b@140.245.105.160:5433/quanlinhansu_dev?schema=public"
  DIRECT_URL="postgresql://postgres:jTgC48v11MCVqB_KH28MthKhQ2ZCUH_b@140.245.105.160:5433/quanlinhansu_dev?schema=public"
  ```
* Khi cần xem trực quan DB Dev, chạy: `npm run db:studio` (Mở cổng `5555`).

---

## 2. 🔐 NGUYÊN TẮC CÔ LẬP ĐA DOANH NGHIỆP (MULTI-TENANT RULES)

Hệ thống quản lý theo mô hình **Multi-Tenant (Mỗi khách hàng/công ty là một `Company`)**:

1. **Ràng buộc Schema (`schema.prisma`)**:
   - Tất cả các bảng nghiệp vụ (Nhân viên, Cửa hàng, Ca làm việc, Sản phẩm, Đơn đặt NSX, Cấu hình, Doanh thu...) **BẮT BUỘC PHẢI CÓ** trường:
     ```prisma
     companyId   String
     company     Company  @relation(fields: [companyId], references: [id], onDelete: Cascade)
     ```
   - Phải có index `@@index([companyId])` và unique compund `@@unique([companyId, code])` nếu có mã định danh.
2. **Ràng buộc Backend API (`/src/app/api/...`)**:
   - Mọi route API phải gọi `const { companyId } = await requireAuth(...)`.
   - Tất cả câu lệnh truy vấn Prisma (`findMany`, `findFirst`, `create`, `update`, `delete`) **BẮT BUỘC** phải có điều kiện `companyId`.
   - Tuyệt đối không bao giờ được `findMany()` hoặc `deleteMany()` mà không có `where: { companyId }`.

---

## 3. 📦 DANH SÁCH 29 BẢNG DỮ LIỆU CHUẨN TRONG HỆ THỐNG

| STT | Tên Bảng | Phân hệ | Mô tả nghiệp vụ |
| :--- | :--- | :--- | :--- |
| 1 | `Company` | Multi-tenant | Danh sách công ty / doanh nghiệp |
| 2 | `User` | Multi-tenant | Tài khoản người dùng |
| 3 | `CompanyMember` | Multi-tenant | Liên kết User - Company & Vai trò thành viên |
| 4 | `CompanyRole` | Multi-tenant | Bảng vai trò tùy chỉnh & quyền chi tiết |
| 5 | `CompanyInvitation`| Multi-tenant | Lời mời gia nhập doanh nghiệp |
| 6 | `Subscription` | Multi-tenant | Gói cước dịch vụ |
| 7 | `Account` | Auth | Tài khoản liên kết OAuth Google |
| 8 | `Session` | Auth | Phiên đăng nhập NextAuth |
| 9 | `VerificationToken`| Auth | Mã xác thực token |
| 10 | `Store` | Nhân sự & Cửa hàng | Cửa hàng / chi nhánh |
| 11 | `Employee` | Nhân sự & Cửa hàng | Hồ sơ nhân viên, loại lương, định mức |
| 12 | `EmployeeStore` | Nhân sự & Cửa hàng | Phân bổ nhân viên vào các cửa hàng & định mức giờ theo cửa hàng (`maxHoursPerMonth`) |
| 13 | `ShiftTemplate` | Xếp ca | Mẫu khung giờ ca làm việc |
| 14 | `StaffingRule` | Xếp ca | Định mức nhân sự theo thứ trong tuần |
| 15 | `StaffingOverride`| Xếp ca | Định mức nhân sự theo ngày cụ thể |
| 16 | `ShiftAssignment` | Xếp ca | Phân công ca làm việc cho nhân viên |
| 17 | `ShiftOvertime` | Xếp ca | Làm thêm giờ (Tăng ca / OT) |
| 18 | `ShiftFault` (`ShiftFaults`) | Xếp ca | Ghi nhận lỗi vi phạm ca làm việc |
| 19 | `ScheduleDayNote` | Xếp ca | Ghi chú ngày trên bảng lịch ca |
| 20 | `ScheduleApprovalRequest` | Xếp ca | Yêu cầu duyệt đổi ca/xóa ca/thêm OT |
| 21 | `ScheduleConfig` | Xếp ca | Cấu hình ràng buộc (ngày làm liên tục...) |
| 22 | `RevenueRecord` | Xếp ca & Cửa hàng | Báo cáo doanh thu ngày của cửa hàng |
| 23 | `AttendanceLog` | Chấm công | Check-in / Check-out GPS & chụp ảnh |
| 24 | `Manufacturer` | Hàng hóa | Nhà sản xuất / Xưởng may gia công |
| 25 | `Category` | Hàng hóa | Loại hàng (Áo, Quần...) |
| 26 | `Subcategory` | Hàng hóa | Chủng loại (Áo thun, Jean...) |
| 27 | `Product` | Hàng hóa & Tồn kho | Sản phẩm, biến thể màu/size, SKU, Barcode |
| 28 | `FactoryOrder` | Đơn NSX & Lô SX | Đơn đặt hàng NSX, mã PO, mã Lô, kiểm hàng QC |
| 29 | `FactoryOrderItem`| Đơn NSX & Lô SX | Chi tiết số lượng biến thể trong lô sản xuất |

---

## 4. 🛠️ QUY TRÌNH KHI CẬP NHẬT DATABASE / SCHEMA

1. **Bước 1: Chỉnh sửa `prisma/schema.prisma`**
   - Đảm bảo đầy đủ quan hệ 2 chiều (`relations`) và `companyId`.
2. **Bước 2: Sinh lại Prisma Client**
   ```bash
   npx prisma generate
   ```
3. **Bước 3: Đồng bộ lên Database Dev**
   ```bash
   npm run db:push
   ```
4. **Bước 4: Kiểm thử ứng dụng trên Local (`npm run dev`)**
   - Đảm bảo các luồng thêm / sửa / xóa / hiển thị hoạt động trơn tru.
5. **Bước 5: Đồng bộ an toàn lên Database Production**
   ```bash
   npm run db:push:prod
   ```
   *(Chỉ chạy khi đã test hoàn tất trên Dev và người dùng xác nhận).*
