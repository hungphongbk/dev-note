import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { invalidateCache, CacheKey } from "@/lib/redis";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const filmStockId = parseInt(id);

  if (isNaN(filmStockId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const body = await request.json();
  const name = body?.name?.trim();

  if (!name) {
    return NextResponse.json({ error: "Tên film không được để trống" }, { status: 400 });
  }

  try {
    const filmStock = await prisma.filmStock.update({
      where: { id: filmStockId },
      data: { name },
    });
    await invalidateCache(CacheKey.filmStocks());
    return NextResponse.json(filmStock);
  } catch {
    return NextResponse.json({ error: "Film stock không tồn tại hoặc tên đã được dùng" }, { status: 409 });
  }
}
