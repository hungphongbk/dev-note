const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
  try {
    const latestMedBatch = await prisma.medBatch.findFirst({
      where: { process: "E6" },
      orderBy: { createdAt: "desc" },
      include: {
        devNotes: {
          select: {
            id: true,
            rollCount: true,
            createdAt: true,
            items: {
              select: {
                quantity: true,
                filmStock: {
                  select: {
                    name: true
                  }
                }
              }
            }
          }
        }
      }
    });

    if (!latestMedBatch) {
      console.log(JSON.stringify({ message: "No MedBatch found for process E6" }));
    } else {
      console.log(JSON.stringify(latestMedBatch, null, 2));
    }
  } catch (error) {
    console.error(error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
