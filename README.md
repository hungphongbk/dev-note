# Dev Note — Nh?t kí tráng film

?ng d?ng qu?n lý nh?t kí tráng film, xây d?ng b?ng **Next.js 16 + Supabase + Prisma 5 + Chakra UI 2**.

## Stack

| Layer    | Công ngh?                          |
|----------|------------------------------------|
| Frontend | Next.js 16 App Router + TypeScript |
| UI       | Chakra UI v2                       |
| ORM      | Prisma v5                          |
| Database | Supabase (PostgreSQL)              |

---

## Cài d?t

### 1. T?o Supabase project

Vào supabase.com, t?o project m?i, vào Settings -> Database -> Connection string.

### 2. C?u hình .env

Ði?n vào file .env ? thu m?c g?c:

  DATABASE_URL = Transaction pooler URL (port 6543) -- dùng b?i runtime
  DIRECT_URL   = Direct connection URL (port 5432)  -- dùng b?i prisma migrate

### 3. Migrate database

  npx prisma migrate dev --name init

### 4. Ch?y local

  npm run dev
  # --> http://localhost:3000  (t? redirect v? /log)

---

## Tính nang

- /new  -- Thêm ghi chú: ch?n ho?c t?o m?i khách hàng & film stock ngay trong trang,
           ch?n quy trình (BW / Ð?o ngu?c / Duong b?n / C41 / ECN2 / E6),
           nh?p s? lu?ng cu?n và ghi chú tu? ch?n.
- /log  -- Xem nh?t kí: toggle B?ng <-> Danh sách (m?c d?nh b?ng trên desktop,
           danh sách trên mobile); l?c theo khách hàng và quy trình.
