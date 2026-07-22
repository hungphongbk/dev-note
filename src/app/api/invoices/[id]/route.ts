import { NextResponse } from "next/server";
import { PriceService } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { CacheVersion, bumpCacheVersion } from "@/lib/redis";
import { getApplicablePriceTableForCustomer, isPriceService } from "@/lib/priceTables";

interface IncomingInvoiceItem {
  devNoteItemId?: number | null;
  service?: PriceService;
  unitPrice?: number;
}

type InvoiceWithDetails = NonNullable<Awaited<ReturnType<typeof findInvoiceById>>>;

function serializeInvoice(invoice: InvoiceWithDetails) {
  const total = invoice.items.reduce((sum, item) => sum + item.lineTotal, 0);

  return {
    ...invoice,
    total,
  };
}

async function findInvoiceById(id: number) {
  return prisma.processingInvoice.findUnique({
    where: { id },
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
}

function parseInvoiceId(id: string) {
  const invoiceId = Number(id);
  return Number.isInteger(invoiceId) && invoiceId > 0 ? invoiceId : null;
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

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = parseInvoiceId(id);

  if (!invoiceId) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const invoice = await findInvoiceById(invoiceId);

  if (!invoice) {
    return NextResponse.json({ error: "Hóa đơn không tồn tại" }, { status: 404 });
  }

  return NextResponse.json(serializeInvoice(invoice), {
    headers: {
      "Cache-Control": "no-store",
    },
  });
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = parseInvoiceId(id);

  if (!invoiceId) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  try {
    const existing = await prisma.processingInvoice.findUnique({
      where: { id: invoiceId },
    });

    if (!existing) {
      return NextResponse.json({ error: "Hóa đơn không tồn tại" }, { status: 404 });
    }

    const body = await request.json();
    const notes = String(body?.notes ?? "").trim() || null;
    const normalizedItems = normalizeItems(body?.items);

    if (!normalizedItems) {
      return NextResponse.json({ error: "Hóa đơn cần ít nhất một item" }, { status: 400 });
    }

    const invoiceItems = await buildInvoiceItems(existing.customerId, normalizedItems);

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.processingInvoiceItem.deleteMany({
        where: { invoiceId },
      });

      await tx.processingInvoice.update({
        where: { id: invoiceId },
        data: {
          notes,
          items: {
            create: invoiceItems,
          },
        },
      });

      return tx.processingInvoice.findUniqueOrThrow({
        where: { id: invoiceId },
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
    });

    await bumpCacheVersion(CacheVersion.invoices());

    return NextResponse.json(serializeInvoice(invoice));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi cập nhật hóa đơn";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const invoiceId = parseInvoiceId(id);

  if (!invoiceId) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const existing = await prisma.processingInvoice.findUnique({
    where: { id: invoiceId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Hóa đơn không tồn tại" }, { status: 404 });
  }

  await prisma.processingInvoice.delete({
    where: { id: invoiceId },
  });
  await bumpCacheVersion(CacheVersion.invoices());

  return NextResponse.json({ ok: true });
}
