# Deploy Production An Toan

Tai lieu nay dung cho repo `Apexflow HR` de:

- deploy ban web dang on dinh cho nguoi dung that
- tiep tuc phat trien local/doc lap voi production
- cap nhat tinh nang sau nay ma khong lam anh huong du lieu nguoi dung

## 1. Nguyen tac bat buoc

Luon tach rieng 2 database:

- `DEV DB`: de ban code, test, seed, doi schema
- `PRODUCTION DB`: du lieu nguoi dung that

Khong dung chung 1 Supabase project cho local va production.

## 2. Kien truc de nghi

- Local code tren may cua ban
- `Supabase Dev` cho local
- `Supabase Production` cho web dang chay that
- `Vercel Production` cho website public

Neu sau nay muon an toan hon nua, them:

- `Preview` deploy tren Vercel
- Supabase branch/staging cho kiem thu truoc khi len production

## 3. Bien moi truong

### Local

Copy file mau:

```bash
cp .env.example .env
```

Local nen tro vao `Supabase Dev`.

Khong nen thay `.env` bang URL production.

Neu can chay lenh DB truc tiep vao production, dung file rieng:

```bash
cp .env.production.manual.example .env.production.manual
```

Sau do chi dung cac lenh:

```bash
npm run db:test:prod
npm run db:push:prod
npm run db:seed:prod
npm run db:migrate:deploy:prod
```

Muc dich cua cach nay la de ban khong vo tinh chay local/dev vao DB production.

### Production tren Vercel

Nhap cac bien moi truong tu `.env.production.example`:

- `DATABASE_URL`
- `DIRECT_URL`
- `DATABASE_POOL_MAX`
- `AUTH_SECRET`
- `AUTH_URL`

Goi y:

- `DATABASE_URL`: dung `Transaction pooler` cua Supabase, port `6543`, kem `?pgbouncer=true`
- `DIRECT_URL`: dung `Direct connection`, port `5432`

## 4. Deploy production lan dau

### Buoc 1: Tao Supabase Production

Tao mot project Supabase moi rieng cho production.

### Buoc 2: Day schema len production DB

Repo nay hien co ho tro ca `db push` va `migrate`.
De on dinh lau dai, tu bay gio nen uu tien `migrate`.

Neu ban chua co migration versioned, co 2 cach:

#### Cach nhanh, dung 1 lan de khoi tao production

```bash
npm run db:push
npm run db:seed
```

Chi nen dung cach nay cho lan khoi tao dau tien.

#### Cach chuan hon

Tao migration local roi moi deploy:

```bash
npm run db:migrate:dev -- --name init_production
```

Sau do production chi chay:

```bash
npm run db:migrate:deploy
```

### Buoc 3: Deploy len Vercel

1. Push code len GitHub
2. Import repo vao Vercel
3. Set env production
4. Build command co the de mac dinh `npm run build`
5. Deploy

## 5. Cach lam viec hang ngay de khong anh huong production

### Khi phat trien tinh nang moi

1. Lam tren local
2. Local dung `DEV DB`
3. Neu doi schema:

```bash
npm run db:migrate:dev -- --name ten_thay_doi
```

4. Test xong moi push code
5. Deploy preview hoac test staging
6. Khi on dinh moi len production

## 6. Cach cap nhat production sau nay

### Neu chi sua giao dien / logic, khong doi schema DB

1. Push code
2. Deploy Vercel

Khong dong vao du lieu nguoi dung.

### Neu co doi schema DB

1. Tao migration o local:

```bash
npm run db:migrate:dev -- --name mo_ta_thay_doi
```

2. Commit ca code va thu muc `prisma/migrations`
3. Backup production DB truoc khi deploy
4. Deploy code moi
5. Chay production migration:

```bash
npm run db:migrate:deploy
```

6. Kiem tra nhanh cac man:

- Dang nhap
- Nhan vien
- Cua hang
- Cau hinh ca
- Lich xep ca

## 7. Script nen dung

### Local / dev

```bash
npm run dev
npm run db:migrate:dev -- --name ten_thay_doi
npm run db:seed
```

### Kiem tra migration

```bash
npm run db:migrate:status
```

### Production

```bash
npm run db:migrate:deploy
```

## 8. Khong nen lam tren production

Khong nen dung cac lenh sau truc tiep vao production, tru khi ban biet ro minh dang lam gi:

```bash
npm run db:push
npm run db:seed
```

Ly do:

- `db:push` khong tao lich su migration ro rang
- `seed` co the chen du lieu mau vao du lieu that

## 9. Quy trinh update an toan de nghi

Moi lan cap nhat:

1. Backup production DB
2. Test local bang `DEV DB`
3. Tao migration neu co doi schema
4. Commit code + migration
5. Deploy
6. Chay `npm run db:migrate:deploy`
7. Smoke test 5 man chinh

## 10. Neu ban muon muc an toan cao hon nua

Co the bo sung sau:

- branch `main` = production
- branch `dev` = phat trien
- Vercel Preview cho moi lan push
- Supabase staging branch/project
- job backup dinh ky production DB

## 11. Checklist nhanh

### Khoi tao production

- [ ] Tao Supabase Production rieng
- [ ] Tao env production tren Vercel
- [ ] Day schema len production DB
- [ ] Deploy Vercel
- [ ] Dang nhap test thanh cong

### Moi lan update tinh nang

- [ ] Test local tren DEV DB
- [ ] Tao migration neu doi schema
- [ ] Backup production DB
- [ ] Deploy code
- [ ] Chay `npm run db:migrate:deploy`
- [ ] Test nhanh cac man chinh
