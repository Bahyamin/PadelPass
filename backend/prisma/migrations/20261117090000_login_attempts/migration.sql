-- Failed login attempts are tracked per email (table login_attempts) instead of
-- per user (users.failed_logins, users.locked_until), so that an unknown email
-- is locked exactly like a real account (RULE-11) without revealing which
-- accounts exist.

-- AlterTable
ALTER TABLE "users" DROP COLUMN "failed_logins",
DROP COLUMN "locked_until";

-- CreateTable
CREATE TABLE "login_attempts" (
    "email" TEXT NOT NULL,
    "failed_count" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),

    CONSTRAINT "login_attempts_pkey" PRIMARY KEY ("email")
);

