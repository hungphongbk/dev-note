import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

try {
  const data = await prisma.filmStock.findMany({ take: 1 });
  console.log("ok", data.length);
} catch (e) {
  console.error(e);
} finally {
  await prisma.$disconnect();
}
