import { PrismaClient, Process } from "@prisma/client";

const prisma = new PrismaClient();

function parseDate(str: string): Date {
  // Format: "M/D/YYYY HH:MM:SS" — treat as UTC+7
  const [date, time] = str.trim().split(" ");
  const [m, d, y] = date.split("/");
  return new Date(
    `${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T${time}+07:00`
  );
}

async function main() {
  // ── Customers ────────────────────────────────────────────────────────────
  const customerNames = [
    "Tôi",
    "Phan Đức",
    "Thanh Ngân",
    "Cẩm Tâm",
    "Tuyết Anh",
    "Việt Dũng",
  ];
  const customerMap: Record<string, number> = {};

  for (const name of customerNames) {
    const c = await prisma.customer.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    customerMap[name] = c.id;
  }

  // ── Film stocks ──────────────────────────────────────────────────────────
  const filmStockNames = [
    "Kodak Gold 200 120",
    "Kodak Vision3 50D 120",
    "Fomapan 100",
    "Kodak Vision3 50D",
    "Fuji Velvia 100",
    "Fuji Velvia 100 120",
    "Kodak Vision3 200T",
    "Kodak Vision3 500T",
    "Fuji Sensia 100",
    "Kodak Vision3 250D",
  ];
  const filmMap: Record<string, number> = {};

  for (const name of filmStockNames) {
    const f = await prisma.filmStock.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    filmMap[name] = f.id;
  }

  // ── Dev notes ────────────────────────────────────────────────────────────
  type SeedNote = {
    timestamp: string;
    customer: string;
    films: string[];
    rollCount: number;
    process: Process;
    notes: string | null;
  };

  const notes: SeedNote[] = [
    {
      timestamp: "4/8/2026 22:29:39",
      customer: "Tôi",
      films: ["Kodak Gold 200 120"],
      rollCount: 1,
      process: Process.C41,
      notes: null,
    },
    {
      timestamp: "4/8/2026 22:30:00",
      customer: "Tôi",
      films: ["Kodak Vision3 50D 120"],
      rollCount: 1,
      process: Process.ECN2,
      notes: null,
    },
    {
      timestamp: "4/8/2026 22:30:13",
      customer: "Tôi",
      films: ["Fomapan 100"],
      rollCount: 1,
      process: Process.DAO_DUONG,
      notes: "Fail",
    },
    {
      timestamp: "4/8/2026 22:30:44",
      customer: "Phan Đức",
      films: ["Kodak Vision3 50D"],
      rollCount: 1,
      process: Process.ECN2,
      notes: "Khách chụp xpan",
    },
    {
      timestamp: "4/8/2026 22:30:57",
      customer: "Thanh Ngân",
      films: ["Fomapan 100"],
      rollCount: 1,
      process: Process.BW,
      notes: null,
    },
    {
      timestamp: "4/8/2026 22:31:34",
      customer: "Cẩm Tâm",
      films: ["Kodak Vision3 200T", "Kodak Vision3 500T"],
      rollCount: 2,
      process: Process.ECN2,
      notes: null,
    },
    {
      timestamp: "4/8/2026 22:32:18",
      customer: "Tuyết Anh",
      films: ["Fuji Velvia 100"],
      rollCount: 1,
      process: Process.E6,
      notes: "Nửa cuộn",
    },
    {
      timestamp: "4/8/2026 22:32:54",
      customer: "Việt Dũng",
      films: ["Fuji Velvia 100 120"],
      rollCount: 1,
      process: Process.E6,
      notes: null,
    },
    {
      timestamp: "4/8/2026 22:33:12",
      customer: "Tôi",
      films: ["Fuji Sensia 100"],
      rollCount: 1,
      process: Process.E6,
      notes: "Film test 12exp",
    },
    {
      timestamp: "4/11/2026 21:08:30",
      customer: "Tôi",
      films: ["Kodak Vision3 250D"],
      rollCount: 1,
      process: Process.ECN2,
      notes: null,
    },
  ];

  for (const note of notes) {
    await prisma.devNote.create({
      data: {
        customerId: customerMap[note.customer],
        process: note.process,
        rollCount: note.rollCount,
        notes: note.notes,
        createdAt: parseDate(note.timestamp),
        films: {
          create: note.films.map((name) => ({ filmStockId: filmMap[name] })),
        },
      },
    });
  }

  console.log("✅ Seed xong: 6 khách hàng, 10 film stocks, 10 dev notes");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
