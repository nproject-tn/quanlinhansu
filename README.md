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

## Cài đặt local

### 1. Clone & cài dependency

```bash
npm install
```

### 2. Cấu hình Supabase

1. Tạo project tại [supabase.com](https://supabase.com)
2. Vào **Project Settings → Database → Connection string (URI)**
3. Copy `.env.example` thành `.env`:

```bash
cp .env.example .env
```

4. `.env` chi dung cho local/dev. Khong dien URL production vao file nay.

5. Điền `DATABASE_URL` và tạo `AUTH_SECRET`:

```bash
openssl rand -base64 32
```

### Tach local va production de tranh nham

- `.env` = local/dev DB
- `.env.production.manual` = chi dung khi can chay lenh truc tiep vao production DB
- Vercel env = production runtime

Neu can thao tac DB production bang tay, copy file mau:

```bash
cp .env.production.manual.example .env.production.manual
```

Khi do dung cac lenh co hau to `:prod`:

```bash
npm run db:test:prod
npm run db:push:prod
npm run db:seed:prod
```

### 3. Khởi tạo database

```bash
npm run db:push      # Tạo bảng
npm run db:seed      # Dữ liệu mẫu
```

### 4. Chạy dev

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000)

## Deploy Vercel + Supabase

Tai lieu deploy/update an toan: [docs/DEPLOY-PRODUCTION.md](/Users/nguyenthanhnam/Library/Mobile%20Documents/com~apple~CloudDocs/anti/ban-sao-quanlinhansu/docs/DEPLOY-PRODUCTION.md)

### Supabase (Production DB)

1. Dùng connection string **Pooler** (port 6543) cho Vercel serverless
2. Thêm `?pgbouncer=true` vào URL nếu cần
3. Tạo **production project riêng**, không dùng chung với local/dev

### Vercel

1. Push code lên GitHub
2. Import project trên [vercel.com](https://vercel.com)
3. Thêm Environment Variables:
   - `DATABASE_URL`
   - `DIRECT_URL`
   - `AUTH_SECRET`
   - `AUTH_URL` = `https://your-domain.vercel.app`
4. Deploy

### Migrate production

```bash
npm run db:migrate:deploy
```

Khong khuyen nghi dung `db:push` hoac `db:seed` truc tiep tren production.

## Quy trình xếp ca

1. **Admin** cấu hình ca & số nhân viên/ca theo ngày
2. **Admin / Người xếp ca** vào **Lịch xếp ca** → **Xếp ca tự động**
3. Hệ thống phân bổ theo:
   - Giờ/ca tối đa mỗi nhân viên
   - Không trùng giờ giữa 2 cửa hàng
   - Đa dạng ca (hôm nay Ca 1 → ngày mai ưu tiên Ca 2)
   - Cân bằng số giờ giữa các nhân viên
4. Chỉnh thủ công bằng kéo thả nếu cần
5. Xem cảnh báo ca trống nếu thiếu nhân sự

## Roadmap Phase 2 & 3

- **Phase 2**: Doanh thu theo ca, target KPI, tích hợp TikTok/Shopee (nếu API cho phép)
- **Phase 3**: Tính lương (cứng/giờ), thưởng theo hệ số target, import Excel

## Cấu trúc thư mục

```
src/
├── app/
│   ├── (dashboard)/     # Trang chính (có sidebar)
│   ├── api/             # REST API
│   └── dang-nhap/       # Đăng nhập
├── components/          # UI components
├── lib/
│   ├── schedule-engine.ts   # Thuật toán xếp ca
│   ├── assignment-service.ts
│   └── auth.ts
└── generated/prisma/    # Prisma client
```
