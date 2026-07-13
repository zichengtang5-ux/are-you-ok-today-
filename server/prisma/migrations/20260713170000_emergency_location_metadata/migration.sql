ALTER TABLE "User"
ADD COLUMN "addressLatitude" DOUBLE PRECISION,
ADD COLUMN "addressLongitude" DOUBLE PRECISION,
ADD COLUMN "addressAccuracyMeters" DOUBLE PRECISION;

ALTER TABLE "HelpRequest"
ADD COLUMN "accuracyMeters" DOUBLE PRECISION,
ADD COLUMN "locationCapturedAt" TIMESTAMP(3),
ADD COLUMN "fixSource" TEXT,
ADD COLUMN "precisionAuthorization" TEXT,
ADD COLUMN "addressSource" TEXT,
ADD COLUMN "addressConfirmed" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mapsProvider" TEXT,
ADD COLUMN "mapUrl" TEXT;
