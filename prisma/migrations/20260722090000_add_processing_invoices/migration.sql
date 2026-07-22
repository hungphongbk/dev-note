-- CreateTable
CREATE TABLE "processing_invoices" (
    "id" SERIAL NOT NULL,
    "customerId" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "processing_invoice_items" (
    "id" SERIAL NOT NULL,
    "invoiceId" INTEGER NOT NULL,
    "devNoteItemId" INTEGER,
    "service" "PriceService" NOT NULL,
    "process" "Process" NOT NULL,
    "filmStockName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "processing_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "processing_invoices_customerId_idx" ON "processing_invoices"("customerId");

-- CreateIndex
CREATE INDEX "processing_invoices_createdAt_idx" ON "processing_invoices"("createdAt");

-- CreateIndex
CREATE INDEX "processing_invoice_items_invoiceId_idx" ON "processing_invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "processing_invoice_items_devNoteItemId_idx" ON "processing_invoice_items"("devNoteItemId");

-- AddForeignKey
ALTER TABLE "processing_invoices" ADD CONSTRAINT "processing_invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_invoice_items" ADD CONSTRAINT "processing_invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "processing_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "processing_invoice_items" ADD CONSTRAINT "processing_invoice_items_devNoteItemId_fkey" FOREIGN KEY ("devNoteItemId") REFERENCES "dev_note_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;
