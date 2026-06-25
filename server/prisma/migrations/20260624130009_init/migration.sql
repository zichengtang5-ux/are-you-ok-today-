-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "nickname" TEXT,
    "address" TEXT,
    "onboardingStep" TEXT NOT NULL DEFAULT 'login',
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "notificationAuth" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "EmergencyContact" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT '家人',
    "priority" INTEGER NOT NULL DEFAULT 1,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EmergencyContact_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ReminderConfig" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startTime" TEXT NOT NULL DEFAULT '20:00',
    "endTime" TEXT NOT NULL DEFAULT '22:00',
    "gracePeriodMin" INTEGER NOT NULL DEFAULT 30,
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Shanghai',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ReminderConfig_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DailyRecord" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'waiting',
    "repliedAt" DATETIME,
    "replyMethod" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DailyRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuardStatus" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "lastReplyAt" DATETIME,
    "alertTriggeredAt" DATETIME,
    "consecutiveTimeouts" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuardStatus_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "guardStatusId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastReplyAt" DATETIME,
    "triggeredAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    "smsRounds" INTEGER NOT NULL DEFAULT 0,
    "contactsNotified" TEXT NOT NULL DEFAULT '[]',
    "timeline" TEXT NOT NULL DEFAULT '[]',
    CONSTRAINT "AlertEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AlertEvent_guardStatusId_fkey" FOREIGN KEY ("guardStatusId") REFERENCES "GuardStatus" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AlertAction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "alertId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AlertAction_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "AlertEvent" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "AlertAction_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "EmergencyContact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "contactId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "round" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sentAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NotificationLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "EmergencyContact" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuardianRelation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guardianId" TEXT NOT NULL,
    "wardId" TEXT NOT NULL,
    "relation" TEXT NOT NULL DEFAULT '子女',
    "inviteCode" TEXT,
    "isBound" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuardianRelation_guardianId_fkey" FOREIGN KEY ("guardianId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GuardianRelation_wardId_fkey" FOREIGN KEY ("wardId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PauseLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "startTime" DATETIME NOT NULL,
    "endTime" DATETIME NOT NULL,
    "reason" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PauseLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HelpRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "latitude" REAL,
    "longitude" REAL,
    "addressText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "HelpRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgreementConsent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "agreementVersion" TEXT NOT NULL,
    "disclaimer1" BOOLEAN NOT NULL DEFAULT false,
    "disclaimer2" BOOLEAN NOT NULL DEFAULT false,
    "disclaimer3" BOOLEAN NOT NULL DEFAULT false,
    "userAgreement" BOOLEAN NOT NULL DEFAULT false,
    "privacyPolicy" BOOLEAN NOT NULL DEFAULT false,
    "consentedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AgreementConsent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "status" TEXT NOT NULL DEFAULT 'inactive',
    "trialEndsAt" DATETIME,
    "currentPeriodEnd" DATETIME,
    "appleTransactionId" TEXT,
    "paidBy" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "phone" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "ReminderConfig_userId_key" ON "ReminderConfig"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DailyRecord_userId_date_key" ON "DailyRecord"("userId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "GuardStatus_userId_key" ON "GuardStatus"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "AlertEvent_guardStatusId_key" ON "AlertEvent"("guardStatusId");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianRelation_inviteCode_key" ON "GuardianRelation"("inviteCode");

-- CreateIndex
CREATE UNIQUE INDEX "GuardianRelation_guardianId_wardId_key" ON "GuardianRelation"("guardianId", "wardId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_userId_key" ON "Subscription"("userId");

-- CreateIndex
CREATE INDEX "VerificationCode_phone_idx" ON "VerificationCode"("phone");
