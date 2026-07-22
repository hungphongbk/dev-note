import { PriceService, Process } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import {
  DEFAULT_PROCESSING_PRICES,
  PRICE_PROCESS_VALUES,
  PRICE_SERVICE_VALUES,
} from "@/lib/pricing";

export type PriceMatrix = Record<PriceService, Record<Process, number>>;

type PriceRow = {
  service: PriceService;
  process: Process;
  amount: number;
};

export function serializePriceMatrix(prices: PriceRow[]): PriceMatrix {
  return PRICE_SERVICE_VALUES.reduce((serviceAcc, service) => {
    serviceAcc[service] = PRICE_PROCESS_VALUES.reduce((processAcc, process) => {
      const found = prices.find((price) => price.service === service && price.process === process);
      processAcc[process] = found?.amount ?? DEFAULT_PROCESSING_PRICES[service][process];
      return processAcc;
    }, {} as Record<Process, number>);
    return serviceAcc;
  }, {} as PriceMatrix);
}

export function isPriceService(value: unknown): value is PriceService {
  return PRICE_SERVICE_VALUES.includes(value as PriceService);
}

export function isProcess(value: unknown): value is Process {
  return PRICE_PROCESS_VALUES.includes(value as Process);
}

export async function getApplicablePriceTableForCustomer(customerId: number) {
  const customerSpecific = await prisma.priceTableCustomer.findUnique({
    where: { customerId },
    include: {
      priceTable: {
        include: {
          prices: true,
        },
      },
    },
  });

  const table =
    customerSpecific?.priceTable ??
    (await prisma.priceTable.findFirst({
      where: { isDefault: true },
      include: { prices: true },
    }));

  return {
    id: table?.id ?? null,
    name: table?.name ?? "Bảng giá mặc định",
    isDefault: table?.isDefault ?? true,
    prices: table ? serializePriceMatrix(table.prices) : DEFAULT_PROCESSING_PRICES,
  };
}
