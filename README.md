# Apexflow HR - Hệ thống Quản lý Nhân sự & Xếp ca

Phase 1: Quản lý nhân viên, cửa hàng, cấu hình ca, xếp ca tự động multi-store, kéo thả đổi ca, cảnh báo ca trống.

## Công nghệ

- **Next.js 16** (App Router) + TypeScript
- **PostgreSQL** (Supabase) + Prisma ORM
- **NextAuth v5** — phân quyền 3 vai trò
- **Tailwind CSS** — giao diện tiếng Việt
- Deploy: **Vercel** + **Supabase** free tier

## Tính năng Phase 1

| Module | Mô tả |
|--------|-------|
| Nhân viên | Loại FT/PT, chức vụ, số ca/giờ tối đa, phân bổ cửa hàng |
| Cửa hàng | Quản lý 1-2+ cửa hàng, nhân viên luân phiên |
| Cấu hình ca | 2-5 ca/ngày, số NV/ca theo ngày trong tuần (1 hoặc 2) |
| Xếp ca tự động | Thuật toán đa dạng ca, cân bằng giờ, chống trùng multi-store |
| Kéo thả | Đổi ca thủ công, kiểm tra xung đột |
| Cảnh báo | Thông báo ca trống — cần tuyển thêm hoặc làm thêm ca |

## Phân quyền

| Vai trò | Quyền |
|---------|-------|
| **Admin** | Toàn quyền: nhân viên, cửa hàng, cấu hình, xếp ca |
| **Người xếp ca** | Chỉ xem & xếp ca (không chỉnh cấu hình) |
| **Nhân viên** | Chỉ xem lịch làm của mình |
