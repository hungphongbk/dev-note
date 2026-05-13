import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Process } from "@prisma/client";

export async function POST(request: Request) {
  const body = await request.json();
  const { process, createdDate, volume, sourceDevNoteId } = body;

  // Validate input
  if (!process || !createdDate || !volume) {
    return NextResponse.json(
      { error: "Thiếu thông tin bắt buộc (process, createdDate, volume)" },
      { status: 400 }
    );
  }

  if (!["500ml", "1l"].includes(volume)) {
    return NextResponse.json(
      { error: "Dung tích không hợp lệ. Chỉ chấp nhận: 500ml, 1l" },
      { status: 400 }
    );
  }

  try {
    // Create the med batch
    const medBatch = await prisma.medBatch.create({
      data: {
        process: process as Process,
        createdDate: new Date(createdDate),
        volume,
      },
    });

    // Get the source dev note to know from which point to assign
    let sourceDevNote = null;
    if (sourceDevNoteId) {
      sourceDevNote = await prisma.devNote.findUnique({
        where: { id: sourceDevNoteId },
      });
    }

    // Auto-assign dev notes if sourceDevNote is provided
    if (sourceDevNote) {
      // Find all dev notes with the same process from the source dev note onwards
      const devNotesToAssign = await prisma.devNote.findMany({
        where: {
          process: process as Process,
          createdAt: {
            gte: sourceDevNote.createdAt,
          },
          // Exclude dev notes that are already assigned to another med batch
          // But force include the source dev note
          OR: [
            {
              id: sourceDevNoteId,
            },
            {
              medBatchId: null,
            },
          ],
        },
      });

      // Assign all found dev notes to this med batch
      await prisma.devNote.updateMany({
        where: {
          id: {
            in: devNotesToAssign.map((note) => note.id),
          },
        },
        data: {
          medBatchId: medBatch.id,
        },
      });
    }

    // Fetch the created batch with its dev notes
    const batchWithNotes = await prisma.medBatch.findUnique({
      where: { id: medBatch.id },
      include: {
        devNotes: {
          include: {
            customer: true,
            items: {
              include: {
                customer: true,
                filmStock: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(batchWithNotes, { status: 201 });
  } catch (error) {
    console.error("Error creating med batch:", error);
    return NextResponse.json({ error: "Lỗi tạo mẻ thuốc" }, { status: 500 });
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const process = searchParams.get("process") as Process | null;
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1") || 1);
  const pageSize = Math.max(1, Math.min(100, parseInt(searchParams.get("pageSize") ?? "10") || 10));
  const skip = (page - 1) * pageSize;

  const where = process ? { process } : {};

  const total = await prisma.medBatch.count({ where });

  const batches = await prisma.medBatch.findMany({
    where,
    include: {
      devNotes: {
        include: {
          customer: true,
          items: {
            include: {
              customer: true,
              filmStock: true,
            },
          },
        },
      },
    },
    orderBy: { createdDate: "desc" },
    skip,
    take: pageSize,
  });

  return NextResponse.json({
    items: batches,
    pagination: {
      page,
      pageSize,
      total,
      totalPages: Math.max(1, Math.ceil(total / pageSize)),
    },
  });
}

