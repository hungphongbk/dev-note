import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { getApplicablePriceTableForCustomer } from "@/lib/priceTables";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerId = Number(searchParams.get("customerId"));
  const skip = Math.max(0, parseInt(searchParams.get("skip") ?? "0") || 0);
  const take = Math.max(1, Math.min(30, parseInt(searchParams.get("take") ?? "10") || 10));

  if (!Number.isInteger(customerId) || customerId <= 0) {
    return NextResponse.json({ error: "Khách hàng không hợp lệ" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
  });

  if (!customer) {
    return NextResponse.json({ error: "Khách hàng không tồn tại" }, { status: 404 });
  }

  const where = {
    items: {
      some: {
        customerId,
      },
    },
  };

  const [total, batches, priceTable] = await Promise.all([
    prisma.devNote.count({ where }),
    prisma.devNote.findMany({
      where,
      include: {
        customer: true,
        medBatch: true,
        items: {
          where: {
            customerId,
          },
          include: {
            customer: true,
            filmStock: true,
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take,
    }),
    getApplicablePriceTableForCustomer(customerId),
  ]);

  return NextResponse.json(
    {
      customer,
      batches,
      priceTable,
      pagination: {
        skip,
        take,
        total,
        hasMore: skip + batches.length < total,
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}
