-- CreateTable
CREATE TABLE "dev_note_items" (
    "id" SERIAL NOT NULL,
    "devNoteId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "filmStockId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dev_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "dev_note_items_devNoteId_customerId_filmStockId_key" ON "dev_note_items"("devNoteId", "customerId", "filmStockId");

-- CreateIndex
CREATE INDEX "dev_note_items_devNoteId_idx" ON "dev_note_items"("devNoteId");

-- CreateIndex
CREATE INDEX "dev_note_items_customerId_idx" ON "dev_note_items"("customerId");

-- CreateIndex
CREATE INDEX "dev_note_items_filmStockId_idx" ON "dev_note_items"("filmStockId");

-- AddForeignKey
ALTER TABLE "dev_note_items" ADD CONSTRAINT "dev_note_items_devNoteId_fkey" FOREIGN KEY ("devNoteId") REFERENCES "dev_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dev_note_items" ADD CONSTRAINT "dev_note_items_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dev_note_items" ADD CONSTRAINT "dev_note_items_filmStockId_fkey" FOREIGN KEY ("filmStockId") REFERENCES "film_stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Backfill from legacy schema: each old film entry becomes one item for the note's customer.
INSERT INTO "dev_note_items" ("devNoteId", "customerId", "filmStockId", "quantity")
SELECT dnf."devNoteId", dn."customerId", dnf."filmStockId", 1
FROM "dev_note_films" dnf
JOIN "dev_notes" dn ON dn."id" = dnf."devNoteId";
