-- AlterTable
ALTER TABLE "Expense" ADD COLUMN     "driverId" TEXT;

-- CreateIndex
CREATE INDEX "Expense_driverId_idx" ON "Expense"("driverId");

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
