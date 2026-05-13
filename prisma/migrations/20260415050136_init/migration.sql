-- CreateEnum
CREATE TYPE "Process" AS ENUM ('BW', 'DAO_DUONG', 'C41', 'ECN2', 'E6');

-- CreateTable
CREATE TABLE "customers" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "film_stocks" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "film_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev_notes" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "process" "Process" NOT NULL,
    "rollCount" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dev_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dev_note_films" (
    "devNoteId" INTEGER NOT NULL,
    "filmStockId" INTEGER NOT NULL,

    CONSTRAINT "dev_note_films_pkey" PRIMARY KEY ("devNoteId","filmStockId")
);

-- CreateIndex
CREATE UNIQUE INDEX "customers_name_key" ON "customers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "film_stocks_name_key" ON "film_stocks"("name");

-- AddForeignKey
ALTER TABLE "dev_notes" ADD CONSTRAINT "dev_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dev_note_films" ADD CONSTRAINT "dev_note_films_devNoteId_fkey" FOREIGN KEY ("devNoteId") REFERENCES "dev_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dev_note_films" ADD CONSTRAINT "dev_note_films_filmStockId_fkey" FOREIGN KEY ("filmStockId") REFERENCES "film_stocks"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
