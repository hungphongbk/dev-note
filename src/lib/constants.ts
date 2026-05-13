import { Process } from "@prisma/client";

export const PROCESS_LABELS: Record<Process, string> = {
  BW: "BW — Đen trắng",
  DAO_DUONG: "BW đảo dương",
  C41: "C41",
  ECN2: "ECN2",
  E6: "E6",
};

export const PROCESS_VALUES = Object.keys(PROCESS_LABELS) as Process[];

export const PROCESS_COLORS: Record<Process, string> = {
  BW: "gray",
  DAO_DUONG: "purple",
  C41: "green",
  ECN2: "blue",
  E6: "red",
};
