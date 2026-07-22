import { NextResponse } from "next/server";
import { PriceService } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { CacheKey, CacheVersion, TTL, bumpCacheVersion, getCacheVersion, withCache } from "@/lib/redis";
import { getApplicablePriceTableForCustomer, isPriceService } from "@/lib/priceTables";

interface IncomingInvoiceItem {
  devNoteItemId?: number | null;
  service?: PriceService;
  unitPrice?: number;
}

function serializeInvoice<T extends { items: { lineTotal: number }[] }>(invoice: T) {
  const total = invoice.items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    ...invoice,
    total,
  };
}

function normalizeItems(rawItems: unknown): IncomingInvoiceItem[] | null {
  if (!Array.isArray(rawItems) || rawItems.length === 0) {
    return null;
  }

  const items = rawItems.map((raw) => {
    const source = raw as Record<string, unknown>;
    const devNoteItemId = Number(source.devNoteItemId);
    const service = source.service;
    const unitPrice = Number(source.unitPrice);

    if (!Number.isInteger(devNoteItemId) || devNoteItemId <= 0 || !isPriceService(service)) {
      throw new Error("Item hóa đơn không hợp lệ");
    }

    return {
      devNoteItemId,
      service,
      unitPrice: Number.isInteger(unitPrice) && unitPrice >= 0 ? unitPrice : undefined,
    };
  });

  const seen = new Set<number>();
  return items.filter((item) => {
    if (!item.devNoteItemId || seen.has(item.devNoteItemId)) return false;
    seen.add(item.devNoteItemId);
    return true;
  });
}

async function buildInvoiceItems(customerId: number, rawItems: IncomingInvoiceItem[]) {
  const devNoteItemIds = rawItems.map((item) => item.devNoteItemId).filter((id): id is number => Boolean(id));
  const sourceItems = await prisma.devNoteItem.findMany({
    where: {
      id: { in: devNoteItemIds },
      customerId,
    },
    include: {
      filmStock: true,
      devNote: true,
    },
  });

  if (sourceItems.length !== devNoteItemIds.length) {
    throw new Error("Có cuộn film không thuộc khách đã chọn");
  }

  const sourceById = new Map(sourceItems.map((item) => [item.id, item]));
  const priceTable = await getApplicablePriceTableForCustomer(customerId);

  return rawItems.map((rawItem) => {
    const source = sourceById.get(rawItem.devNoteItemId ?? 0);

    if (!source) {
      throw new Error("Không tìm thấy cuộn film");
    }

    const unitPrice = rawItem.unitPrice ?? priceTable.prices[rawItem.service!][source.devNote.process];

    return {
      devNoteItemId: source.id,
      service: rawItem.service!,
      process: source.devNote.process,
      filmStockName: source.filmStock.name,
      quantity: source.quantity,
      unitPrice,
      lineTotal: unitPrice * source.quantity,
    };
  });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const parsedCustomerId = customerId ? Number(customerId) : null;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") ?? "10") || 10));
  const skip = (page - 1) * pageSize;

  if (parsedCustomerId !== null && (!Number.isInteger(parsedCustomerId) || parsedCustomerId <= 0)) {
    return NextResponse.json({ error: "Khách hàng không hợp lệ" }, { status: 400 });
  }

  const version = await getCacheVersion(CacheVersion.invoices());
  const cacheKey = CacheKey.invoices(version, customerId, page, pageSize);

  const result = await withCache(cacheKey, TTL.LIST, async () => {
    const where = parsedCustomerId ? { customerId: parsedCustomerId } : {};
    const total = await prisma.processingInvoice.count({ where });
    const invoices = await prisma.processingInvoice.findMany({
      where,
      include: {
        customer: true,
        items: {
          include: {
            devNoteItem: {
              include: {
                devNote: true,
                filmStock: true,
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    return {
      items: invoices.map(serializeInvoice),
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  });

  return NextResponse.json(result, {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const customerId = Number(body?.customerId);
    const notes = String(body?.notes ?? "").trim() || null;
    const normalizedItems = normalizeItems(body?.items);

    if (!Number.isInteger(customerId) || customerId <= 0 || !normalizedItems) {
      return NextResponse.json({ error: "Thiếu thông tin hóa đơn" }, { status: 400 });
    }

    const customer = await prisma.customer.findUnique({ where: { id: customerId } });
    if (!customer) {
      return NextResponse.json({ error: "Khách hàng không tồn tại" }, { status: 404 });
    }

    const invoiceItems = await buildInvoiceItems(customerId, normalizedItems);

    const invoice = await prisma.processingInvoice.create({
      data: {
        customerId,
        notes,
        items: {
          create: invoiceItems,
        },
      },
      include: {
        customer: true,
        items: {
          include: {
            devNoteItem: {
              include: {
                devNote: true,
                filmStock: true,
              },
            },
          },
          orderBy: { id: "asc" },
        },
      },
    });

    await bumpCacheVersion(CacheVersion.invoices());

    return NextResponse.json(serializeInvoice(invoice), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi tạo hóa đơn";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
