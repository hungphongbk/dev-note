import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withCache, invalidateCacheByPattern, CacheKey, TTL } from "@/lib/redis";
import { Process } from "@prisma/client";

interface IncomingItem {
  customerId: number;
  filmStockId: number;
  quantity?: number;
}

function normalizeItems(items: IncomingItem[]) {
  const grouped = new Map<string, { customerId: number; filmStockId: number; quantity: number }>();

  for (const raw of items) {
    const customerId = Number(raw.customerId);
    const filmStockId = Number(raw.filmStockId);
    const quantity = Math.max(1, Math.trunc(Number(raw.quantity ?? 1)));

    if (!Number.isInteger(customerId) || !Number.isInteger(filmStockId) || !Number.isFinite(quantity)) {
      return null;
    }

    const key = `${customerId}:${filmStockId}`;
    const current = grouped.get(key);

    if (current) {
      current.quantity += quantity;
    } else {
      grouped.set(key, { customerId, filmStockId, quantity });
    }
  }

  return Array.from(grouped.values());
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const customerId = searchParams.get("customerId");
  const process = searchParams.get("process") as Process | null;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") ?? "10") || 10));
  const skip = (page - 1) * pageSize;
  const parsedCustomerId = customerId ? parseInt(customerId) : null;

  const cacheKey = CacheKey.devNotes(customerId, process, page, pageSize);

  const result = await withCache(cacheKey, TTL.LIST, async () => {
    const where = {
      ...(parsedCustomerId ? { items: { some: { customerId: parsedCustomerId } } } : {}),
      ...(process ? { process } : {}),
    };

    const total = await prisma.devNote.count({ where });

    const notes = await prisma.devNote.findMany({
      where,
      include: {
        customer: true,
        films: {
          include: { filmStock: true },
        },
        items: {
          include: {
            customer: true,
            filmStock: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
    });

    return {
      items: notes,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  });

  return NextResponse.json(result);
}

export async function POST(request: Request) {
  const body = await request.json();
  const { customerId, filmStockIds, items, process, rollCount, notes: bodyNotes } = body;

  const normalizedItems = Array.isArray(items)
    ? normalizeItems(items as IncomingItem[])
    : normalizeItems(
        (filmStockIds as number[] | undefined)?.map((filmStockId) => ({
          customerId,
          filmStockId,
          quantity: 1,
        })) ?? []
      );

  if (!normalizedItems || normalizedItems.length === 0 || !process || !rollCount) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  if (!normalizedItems.every((item) => item.quantity > 0)) {
    return NextResponse.json({ error: "Số lượng cuộn phải lớn hơn 0" }, { status: 400 });
  }

  const primaryCustomerId = normalizedItems[0]?.customerId;

  if (!primaryCustomerId) {
    return NextResponse.json({ error: "Thiếu thông tin bắt buộc" }, { status: 400 });
  }

  const legacyFilmStockIds = Array.from(new Set(normalizedItems.map((item) => item.filmStockId)));

  // Check if there's an active med batch for this process
  const activeMedBatch = await prisma.medBatch.findFirst({
    where: { process },
    orderBy: { createdAt: "desc" },
  });

  const note = await prisma.devNote.create({
    data: {
      customerId: primaryCustomerId,
      process,
      rollCount,
      notes: bodyNotes ?? null,
      medBatchId: activeMedBatch?.id ?? null,
      films: {
        create: legacyFilmStockIds.map((id) => ({ filmStockId: id })),
      },
      items: {
        create: normalizedItems,
      },
    },
    include: {
      customer: true,
      films: { include: { filmStock: true } },
      items: {
        include: {
          customer: true,
          filmStock: true,
        },
      },
    },
  });

  // A newly created dev note impacts all paginated/filter variants of note listings.
  await invalidateCacheByPattern(`${CacheKey.devNotesPrefix()}*`);

  return NextResponse.json(note, { status: 201 });
}
