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

function serializePriceTable(table: Awaited<ReturnType<typeof findPriceTables>>[number]) {
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

async function findPriceTables() {
  return prisma.priceTable.findMany({
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
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
  });
}

async function ensureDefaultPriceTable() {
  const existingDefault = await prisma.priceTable.findFirst({
    where: { isDefault: true },
  });

  if (existingDefault) {
    return existingDefault;
  }

  return prisma.$transaction(async (tx) => {
    const table = await tx.priceTable.create({
      data: {
        name: "Bảng giá mặc định",
        isDefault: true,
      },
    });

    await tx.processingPrice.createMany({
      data: buildPriceRows(table.id, DEFAULT_PROCESSING_PRICES),
    });

    return table;
  });
}

function parsePrices(rawPrices: unknown): PriceMatrix | null {
  if (!rawPrices || typeof rawPrices !== "object") {
    return null;
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

export async function GET() {
  await ensureDefaultPriceTable();
  const [tables, customers] = await Promise.all([
    findPriceTables(),
    prisma.customer.findMany({ orderBy: { name: "asc" } }),
  ]);

  return NextResponse.json({
    tables: tables.map(serializePriceTable),
    customers,
  });
}

export async function POST(request: Request) {
  const body = await request.json();
  const name = String(body?.name ?? "").trim();

  if (!name) {
    return NextResponse.json({ error: "Tên bảng giá không được để trống" }, { status: 400 });
  }

  try {
    const prices = parsePrices(body?.prices) ?? DEFAULT_PROCESSING_PRICES;
    const customerIds = parseCustomerIds(body?.customerIds);

    const table = await prisma.$transaction(async (tx) => {
      const created = await tx.priceTable.create({
        data: {
          name,
          isDefault: false,
        },
      });

      await tx.processingPrice.createMany({
        data: buildPriceRows(created.id, prices),
      });

      if (customerIds.length > 0) {
        await tx.priceTableCustomer.createMany({
          data: customerIds.map((customerId) => ({
            priceTableId: created.id,
            customerId,
          })),
        });
      }

      return tx.priceTable.findUniqueOrThrow({
        where: { id: created.id },
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

    return NextResponse.json(serializePriceTable(table), { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Lỗi tạo bảng giá";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
