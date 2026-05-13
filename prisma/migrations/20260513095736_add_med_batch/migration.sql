-- AlterTable
ALTER TABLE "dev_note_items" ADD COLUMN     "medBatchId" INTEGER;

-- CreateTable
CREATE TABLE "med_batches" (
    "id" SERIAL NOT NULL,
    "process" "Process" NOT NULL,
    "createdDate" TIMESTAMP(3) NOT NULL,
    "volume" TEXT NOT NULL DEFAULT '500ml',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "med_batches_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "med_batches_process_idx" ON "med_batches"("process");

-- CreateIndex
CREATE INDEX "dev_note_items_medBatchId_idx" ON "dev_note_items"("medBatchId");

-- AddForeignKey
ALTER TABLE "dev_note_items" ADD CONSTRAINT "dev_note_items_medBatchId_fkey" FOREIGN KEY ("medBatchId") REFERENCES "med_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
