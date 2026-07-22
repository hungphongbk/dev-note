import { PriceService, Process } from "@prisma/client";

export const PRICE_SERVICE_LABELS: Record<PriceService, string> = {
  DEVELOP_SCAN: "Tráng scan",
  DEVELOP: "Tráng",
  SCAN: "Scan",
  BORDER_BONUS: "Tràn viền (bonus)",
};

export const PRICE_SERVICE_VALUES = [
  PriceService.DEVELOP_SCAN,
  PriceService.DEVELOP,
  PriceService.SCAN,
  PriceService.BORDER_BONUS,
] as const;

export const PRICE_PROCESS_VALUES = [
  Process.C41,
  Process.ECN2,
  Process.E6,
  Process.BW,
  Process.DAO_DUONG,
] as const;

export const DEFAULT_PROCESSING_PRICES: Record<PriceService, Record<Process, number>> = {
  DEVELOP_SCAN: {
    C41: 75000,
    ECN2: 85000,
    E6: 300000,
    BW: 55000,
    DAO_DUONG: 55000,
  },
  DEVELOP: {
    C41: 55000,
    ECN2: 65000,
    E6: 250000,
    BW: 35000,
    DAO_DUONG: 35000,
  },
  SCAN: {
    C41: 35000,
    ECN2: 35000,
    E6: 50000,
    BW: 35000,
    DAO_DUONG: 35000,
  },
  BORDER_BONUS: {
    C41: 50000,
    ECN2: 50000,
    E6: 50000,
    BW: 50000,
    DAO_DUONG: 50000,
  },
};

export function formatVnd(amount: number) {
  return new Intl.NumberFormat("vi-VN").format(amount);
}
