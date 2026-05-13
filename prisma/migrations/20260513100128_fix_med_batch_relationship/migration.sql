/*
  Warnings:

  - You are about to drop the column `medBatchId` on the `dev_note_items` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "dev_note_items" DROP CONSTRAINT "dev_note_items_medBatchId_fkey";

-- DropIndex
DROP INDEX "dev_note_items_medBatchId_idx";

-- AlterTable
ALTER TABLE "dev_note_items" DROP COLUMN "medBatchId";

-- AlterTable
ALTER TABLE "dev_notes" ADD COLUMN     "medBatchId" INTEGER;

-- CreateIndex
CREATE INDEX "dev_notes_medBatchId_idx" ON "dev_notes"("medBatchId");

-- AddForeignKey
ALTER TABLE "dev_notes" ADD CONSTRAINT "dev_notes_medBatchId_fkey" FOREIGN KEY ("medBatchId") REFERENCES "med_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
