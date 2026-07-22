import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { CacheKey, invalidateCache, TTL, withCache } from "@/lib/redis";

export async function GET() {
  const filmStocks = await withCache(
    CacheKey.filmStocks(),
    TTL.REFERENCE,
    () => prisma.filmStock.findMany({ orderBy: { name: "asc" } }),
  );
  return NextResponse.json(filmStocks);
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = body?.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Tên film không được để trống" }, { status: 400 });
  }

  try {
    const filmStock = await prisma.filmStock.create({ data: { name } });
    await invalidateCache(CacheKey.filmStocks());
    return NextResponse.json(filmStock, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Film stock đã tồn tại" }, { status: 409 });
  }
}
