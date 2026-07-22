-- CreateEnum
CREATE TYPE "PriceService" AS ENUM ('DEVELOP_SCAN', 'DEVELOP', 'SCAN', 'BORDER_BONUS');

-- CreateTable
CREATE TABLE "processing_price_tables" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_price_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_prices" (
    "id" SERIAL NOT NULL,
    "priceTableId" INTEGER NOT NULL,
    "service" "PriceService" NOT NULL,
    "process" "Process" NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_price_table_customers" (
    "priceTableId" INTEGER NOT NULL,
    "customerId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_price_table_customers_pkey" PRIMARY KEY ("priceTableId","customerId")
);

-- CreateIndex
CREATE UNIQUE INDEX "processing_price_tables_single_default_key" ON "processing_price_tables"("isDefault") WHERE "isDefault" = true;

-- CreateIndex
CREATE UNIQUE INDEX "processing_prices_priceTableId_service_process_key" ON "processing_prices"("priceTableId", "service", "process");

-- CreateIndex
CREATE INDEX "processing_prices_priceTableId_idx" ON "processing_prices"("priceTableId");

-- CreateIndex
CREATE INDEX "processing_prices_process_idx" ON "processing_prices"("process");

-- CreateIndex
CREATE UNIQUE INDEX "processing_price_table_customers_customerId_key" ON "processing_price_table_customers"("customerId");

-- CreateIndex
CREATE INDEX "processing_price_table_customers_priceTableId_idx" ON "processing_price_table_customers"("priceTableId");

-- AddForeignKey
ALTER TABLE "processing_prices" ADD CONSTRAINT "processing_prices_priceTableId_fkey" FOREIGN KEY ("priceTableId") REFERENCES "processing_price_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_price_table_customers" ADD CONSTRAINT "processing_price_table_customers_priceTableId_fkey" FOREIGN KEY ("priceTableId") REFERENCES "processing_price_tables"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_price_table_customers" ADD CONSTRAINT "processing_price_table_customers_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed default processing-scan price table.
INSERT INTO "processing_price_tables" ("name", "isDefault")
VALUES ('Bảng giá mặc định', true);

INSERT INTO "processing_prices" ("priceTableId", "service", "process", "amount")
SELECT pt."id", seed."service"::"PriceService", seed."process"::"Process", seed."amount"
FROM "processing_price_tables" pt
CROSS JOIN (
    VALUES
        ('DEVELOP_SCAN', 'C41', 75000),
        ('DEVELOP_SCAN', 'ECN2', 85000),
        ('DEVELOP_SCAN', 'E6', 300000),
        ('DEVELOP_SCAN', 'BW', 55000),
        ('DEVELOP_SCAN', 'DAO_DUONG', 55000),
        ('DEVELOP', 'C41', 55000),
        ('DEVELOP', 'ECN2', 65000),
        ('DEVELOP', 'E6', 250000),
        ('DEVELOP', 'BW', 35000),
        ('DEVELOP', 'DAO_DUONG', 35000),
        ('SCAN', 'C41', 35000),
        ('SCAN', 'ECN2', 35000),
        ('SCAN', 'E6', 50000),
        ('SCAN', 'BW', 35000),
        ('SCAN', 'DAO_DUONG', 35000),
        ('BORDER_BONUS', 'C41', 50000),
        ('BORDER_BONUS', 'ECN2', 50000),
        ('BORDER_BONUS', 'E6', 50000),
        ('BORDER_BONUS', 'BW', 50000),
        ('BORDER_BONUS', 'DAO_DUONG', 50000)
) AS seed("service", "process", "amount")
WHERE pt."isDefault" = true;
