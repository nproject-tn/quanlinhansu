<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# 📘 MASTER PROJECT SPECIFICATION & SINGLE SOURCE OF TRUTH
Always read [PROJECT_SPECIFICATION.md](PROJECT_SPECIFICATION.md) and [DATABASE_ARCHITECTURE.md](DATABASE_ARCHITECTURE.md) before writing or modifying any code.

### 🌟 BẮT BUỘC DUY TRÌ TÀI LIỆU (MANDATORY BLUEPRINT SYNC):
1. **[PROJECT_SPECIFICATION.md](PROJECT_SPECIFICATION.md) là bản đặc tả 100% của toàn bộ hệ thống ApexFlow**:
   - Chứa toàn bộ ngôn ngữ thiết kế UI/UX (Trắng/Đen/Slate tối giản), kiến trúc Multi-tenant, 29 bảng Prisma, và chi tiết 7 phân hệ (Auth/Workspaces, Stores, Employees, Shift Templates, Smart Scheduling, Goods/Inventory/Factory Orders, Settings).
2. **LUÔN ĐỒNG BỘ KHI CÓ THAY ĐỔI**:
   - Khi thêm tính năng mới -> Cập nhật chi tiết vào [PROJECT_SPECIFICATION.md](PROJECT_SPECIFICATION.md).
   - Khi sửa đổi hoặc loại bỏ tính năng cũ -> Lập tức sửa hoặc xóa bỏ phần mô tả cũ trong [PROJECT_SPECIFICATION.md](PROJECT_SPECIFICATION.md).
   - Đảm bảo bất kỳ lúc nào đọc file [PROJECT_SPECIFICATION.md](PROJECT_SPECIFICATION.md), AI Agent đều có thể tái tạo 100% dự án chuẩn xác mà không thiếu sót bất kỳ chi tiết nào.

# 🏛️ DATABASE ARCHITECTURE & MULTI-TENANT IMMUTABLE RULES
1. **TWO SEPARATE DATABASES ON ORACLE (140.245.105.160)**:
   - **Production DB**: Port `5432` (`quanlinhansu`). Password: `IdpyutdZI3y1qDHJaTn-gsoaG3l8MAUi`. For live web users (`https://apexflow.id.vn`). NEVER use for local dev testing.
   - **Development DB**: Port `5433` (`quanlinhansu_dev`). Password: `jTgC48v11MCVqB_KH28MthKhQ2ZCUH_b`. For local `npm run dev`. `.env` must ALWAYS point to this port 5433 DB.
2. **MULTI-TENANT ISOLATION**:
   - Every model must have `companyId String` with relation to `Company(id)` with `onDelete: Cascade` and `@@index([companyId])`.
   - Every API query / mutation MUST filter by `companyId`.
3. **NEVER OVERWRITE PRODUCTION DATA**:
   - Never copy dev test data to production.
   - Test all schema changes via `npm run db:push` (Dev) before syncing to production (`npm run db:push:prod`).

