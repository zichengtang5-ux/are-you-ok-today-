-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EmergencyContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT '家人',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "isAccountDeleted" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmergencyContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EmergencyContact" ("createdAt", "id", "name", "phone", "priority", "relation", "updatedAt", "userId", "verified") SELECT "createdAt", "id", "name", "phone", "priority", "relation", "updatedAt", "userId", "verified" FROM "EmergencyContact";
DROP TABLE "EmergencyContact";
ALTER TABLE "new_EmergencyContact" RENAME TO "EmergencyContact";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
