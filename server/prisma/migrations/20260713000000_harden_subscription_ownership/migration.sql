ALTER TABLE "Subscription"
ADD COLUMN "appleOriginalTransactionId" TEXT;

-- Legacy development builds did not enforce transaction ownership. Keep the
-- most recently updated owner so the unique index can be applied safely.
WITH ranked_transactions AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "appleTransactionId"
      ORDER BY "updatedAt" DESC, id DESC
    ) AS duplicate_rank
  FROM "Subscription"
  WHERE "appleTransactionId" IS NOT NULL
)
UPDATE "Subscription" AS subscription
SET "appleTransactionId" = NULL
FROM ranked_transactions
WHERE subscription.id = ranked_transactions.id
  AND ranked_transactions.duplicate_rank > 1;

CREATE UNIQUE INDEX "Subscription_appleTransactionId_key"
ON "Subscription"("appleTransactionId");

CREATE UNIQUE INDEX "Subscription_appleOriginalTransactionId_key"
ON "Subscription"("appleOriginalTransactionId");
