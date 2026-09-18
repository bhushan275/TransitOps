-- CreateTable
CREATE TABLE "TripSafetyReview" (
    "id" TEXT NOT NULL,
    "tripId" TEXT NOT NULL,
    "driverId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "remarks" TEXT,
    "reviewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TripSafetyReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TripSafetyReview_tripId_key" ON "TripSafetyReview"("tripId");

-- CreateIndex
CREATE INDEX "TripSafetyReview_driverId_idx" ON "TripSafetyReview"("driverId");

-- CreateIndex
CREATE INDEX "TripSafetyReview_reviewerId_idx" ON "TripSafetyReview"("reviewerId");

-- AddForeignKey
ALTER TABLE "TripSafetyReview" ADD CONSTRAINT "TripSafetyReview_tripId_fkey" FOREIGN KEY ("tripId") REFERENCES "Trip"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripSafetyReview" ADD CONSTRAINT "TripSafetyReview_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TripSafetyReview" ADD CONSTRAINT "TripSafetyReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
