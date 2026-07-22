import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CacheKey, invalidateCache, TTL, withCache } from "@/lib/redis";

export async function GET() {
  const customers = await withCache(
    CacheKey.customers(),
    TTL.REFERENCE,
    () => prisma.customer.findMany({ orderBy: { name: "asc" } }),
  );
  return NextResponse.json(customers);
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = body?.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Tên không được để trống" }, { status: 400 });
  }

  try {
    const customer = await prisma.customer.create({ data: { name } });
    await invalidateCache(CacheKey.customers());
    return NextResponse.json(customer, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Khách hàng đã tồn tại" }, { status: 409 });
  }
}
