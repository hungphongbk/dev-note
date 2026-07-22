import { NextResponse } from "next/server";
import { PriceService, Process } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PROCESSING_PRICES,
  PRICE_PROCESS_VALUES,
  PRICE_SERVICE_VALUES,
} from "@/lib/pricing";

type PriceMatrix = Record<PriceService, Record<Process, number>>;

function buildPriceRows(priceTableId: number, prices: PriceMatrix) {
  return PRICE_SERVICE_VALUES.flatMap((service) =>
    PRICE_PROCESS_VALUES.map((process) => ({
      priceTableId,
      service,
      process,
      amount: prices[service][process],
    }))
  );
}

function parsePrices(rawPrices: unknown): PriceMatrix {
  if (!rawPrices || typeof rawPrices !== "object") {
    throw new Error("Thiếu bảng giá");
  }

  const source = rawPrices as Record<string, Record<string, unknown>>;

  return PRICE_SERVICE_VALUES.reduce((serviceAcc, service) => {
    const servicePrices = source[service];

    if (!servicePrices || typeof servicePrices !== "object") {
      throw new Error("Thiếu bảng giá dịch vụ");
    }

    serviceAcc[service] = PRICE_PROCESS_VALUES.reduce((processAcc, process) => {
      const amount = Number(servicePrices[process]);

      if (!Number.isInteger(amount) || amount < 0) {
        throw new Error("Giá phải là số nguyên không âm");
      }

      processAcc[process] = amount;
      return processAcc;
    }, {} as Record<Process, number>);

    return serviceAcc;
  }, {} as PriceMatrix);
}

function parseCustomerIds(rawCustomerIds: unknown) {
  if (!Array.isArray(rawCustomerIds)) {
    return [];
  }

  return Array.from(
    new Set(
      rawCustomerIds
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0)
    )
  );
}

function serializePriceTable(table: {
  id: number;
  name: string;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
  prices: { service: PriceService; process: Process; amount: number }[];
  customers: { customerId: number; customer: { id: number; name: string; createdAt: Date } }[];
}) {
  const matrix = PRICE_SERVICE_VALUES.reduce((serviceAcc, service) => {
    serviceAcc[service] = PRICE_PROCESS_VALUES.reduce((processAcc, process) => {
      const found = table.prices.find((price) => price.service === service && price.process === process);
      processAcc[process] = found?.amount ?? DEFAULT_PROCESSING_PRICES[service][process];
      return processAcc;
    }, {} as Record<Process, number>);
    return serviceAcc;
  }, {} as PriceMatrix);

  return {
    id: table.id,
    name: table.name,
    isDefault: table.isDefault,
    createdAt: table.createdAt,
    updatedAt: table.updatedAt,
    customerIds: table.customers.map((link) => link.customerId),
    customers: table.customers.map((link) => link.customer),
    prices: matrix,
  };
}

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const priceTableId = Number(id);

  if (!Number.isInteger(priceTableId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const body = await request.json();
  const name = String(body?.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Tên bảng giá không được để trống" }, { status: 400 });
  }

  try {
    const prices = parsePrices(body?.prices);
    const customerIds = parseCustomerIds(body?.customerIds);

    const table = await prisma.$transaction(async (tx) => {
      const existing = await tx.priceTable.findUnique({
        where: { id: priceTableId },
      });

      if (!existing) {
        throw new Error("Bảng giá không tồn tại");
      }

      await tx.priceTable.update({
        where: { id: priceTableId },
        data: { name },
      });

      await tx.processingPrice.deleteMany({
        where: { priceTableId },
      });
      await tx.processingPrice.createMany({
        data: buildPriceRows(priceTableId, prices),
      });

      if (!existing.isDefault) {
        await tx.priceTableCustomer.deleteMany({
          where: { priceTableId },
        });

        if (customerIds.length > 0) {
          await tx.priceTableCustomer.createMany({
            data: customerIds.map((customerId) => ({
              priceTableId,
              customerId,
            })),
          });
        }
      }

      return tx.priceTable.findUniqueOrThrow({
        where: { id: priceTableId },
        include: {
          prices: true,
          customers: {
            include: {
              customer: true,
            },
            orderBy: {
              customer: {
                name: "asc",
              },
            },
          },
        },
      });
    });

    return NextResponse.json(serializePriceTable(table));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi cập nhật bảng giá";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const priceTableId = Number(id);

  if (!Number.isInteger(priceTableId)) {
    return NextResponse.json({ error: "ID không hợp lệ" }, { status: 400 });
  }

  const existing = await prisma.priceTable.findUnique({
    where: { id: priceTableId },
  });

  if (!existing) {
    return NextResponse.json({ error: "Bảng giá không tồn tại" }, { status: 404 });
  }

  if (existing.isDefault) {
    return NextResponse.json({ error: "Không thể xoá bảng giá mặc định" }, { status: 400 });
  }

  await prisma.priceTable.delete({
    where: { id: priceTableId },
  });

  return NextResponse.json({ ok: true });
}
