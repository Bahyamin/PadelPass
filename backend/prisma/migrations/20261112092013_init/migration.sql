-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PLAYER', 'STAFF', 'EQUIPMENT_MANAGER', 'ADMIN');

-- CreateEnum
CREATE TYPE "CourtType" AS ENUM ('INDOOR', 'OUTDOOR');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('UNPAID', 'PAID');

-- CreateEnum
CREATE TYPE "ItemStatus" AS ENUM ('AVAILABLE', 'RENTED', 'DAMAGED', 'MAINTENANCE', 'LOST');

-- CreateEnum
CREATE TYPE "ReturnCondition" AS ENUM ('OK', 'DAMAGED', 'MISSING');

-- CreateTable
CREATE TABLE "users" (
    "id" SERIAL NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PLAYER',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "consent_at" TIMESTAMPTZ(3),
    "failed_logins" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courts" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "CourtType" NOT NULL DEFAULT 'INDOOR',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "courts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "court_closures" (
    "id" SERIAL NOT NULL,
    "court_id" INTEGER NOT NULL,
    "start_time" TIMESTAMPTZ(3) NOT NULL,
    "end_time" TIMESTAMPTZ(3) NOT NULL,
    "reason" TEXT,

    CONSTRAINT "court_closures_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_hours" (
    "day_of_week" INTEGER NOT NULL,
    "open_time" TEXT NOT NULL,
    "close_time" TEXT NOT NULL,

    CONSTRAINT "opening_hours_pkey" PRIMARY KEY ("day_of_week")
);

-- CreateTable
CREATE TABLE "pricing_rules" (
    "id" SERIAL NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "price_per_hour" DECIMAL(8,2) NOT NULL,
    "label" TEXT NOT NULL,

    CONSTRAINT "pricing_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "guest_name" TEXT,
    "guest_phone" TEXT,
    "court_id" INTEGER NOT NULL,
    "start_time" TIMESTAMPTZ(3) NOT NULL,
    "end_time" TIMESTAMPTZ(3) NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'CONFIRMED',
    "court_price" DECIMAL(8,2) NOT NULL,
    "fees_total" DECIMAL(8,2) NOT NULL DEFAULT 0,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'UNPAID',
    "created_by" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_types" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "rental_price" DECIMAL(8,2) NOT NULL,
    "damage_fee" DECIMAL(8,2) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "equipment_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "equipment_items" (
    "id" SERIAL NOT NULL,
    "type_id" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "status" "ItemStatus" NOT NULL DEFAULT 'AVAILABLE',

    CONSTRAINT "equipment_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "booking_equipment" (
    "booking_id" INTEGER NOT NULL,
    "type_id" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unit_price" DECIMAL(8,2) NOT NULL,

    CONSTRAINT "booking_equipment_pkey" PRIMARY KEY ("booking_id","type_id")
);

-- CreateTable
CREATE TABLE "rentals" (
    "id" SERIAL NOT NULL,
    "booking_id" INTEGER NOT NULL,
    "item_id" INTEGER NOT NULL,
    "picked_up_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "returned_at" TIMESTAMPTZ(3),
    "return_condition" "ReturnCondition",
    "fee_charged" DECIMAL(8,2) NOT NULL DEFAULT 0,

    CONSTRAINT "rentals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "booking_id" INTEGER,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "sent_at" TIMESTAMPTZ(3),
    "error" TEXT,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" INTEGER,
    "details" JSONB,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "courts_name_key" ON "courts"("name");

-- CreateIndex
CREATE UNIQUE INDEX "pricing_rules_day_of_week_start_time_key" ON "pricing_rules"("day_of_week", "start_time");

-- CreateIndex
CREATE INDEX "bookings_court_id_start_time_idx" ON "bookings"("court_id", "start_time");

-- CreateIndex
CREATE INDEX "bookings_user_id_status_start_time_idx" ON "bookings"("user_id", "status", "start_time");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_types_name_key" ON "equipment_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "equipment_items_code_key" ON "equipment_items"("code");

-- CreateIndex
CREATE INDEX "equipment_items_type_id_status_idx" ON "equipment_items"("type_id", "status");

-- CreateIndex
CREATE INDEX "rentals_booking_id_idx" ON "rentals"("booking_id");

-- CreateIndex
CREATE INDEX "rentals_item_id_idx" ON "rentals"("item_id");

-- AddForeignKey
ALTER TABLE "court_closures" ADD CONSTRAINT "court_closures_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_court_id_fkey" FOREIGN KEY ("court_id") REFERENCES "courts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "equipment_items" ADD CONSTRAINT "equipment_items_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_equipment" ADD CONSTRAINT "booking_equipment_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "booking_equipment" ADD CONSTRAINT "booking_equipment_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "equipment_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_booking_id_fkey" FOREIGN KEY ("booking_id") REFERENCES "bookings"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ---------------------------------------------------------------------------
-- Added by hand: integrity rules of the SDD (section 4.2) that Prisma cannot express.
-- ---------------------------------------------------------------------------

-- btree_gist lets a GiST index compare the integer court_id with "=".
CREATE EXTENSION IF NOT EXISTS btree_gist;

-- RULE-05: two confirmed bookings on the same court cannot overlap, even when
-- two requests arrive at the same time. The range is [start, end), so a booking
-- may start exactly when the previous one ends.
ALTER TABLE "bookings"
  ADD CONSTRAINT "no_overlap"
  EXCLUDE USING gist (
    "court_id" WITH =,
    tstzrange("start_time", "end_time") WITH &&
  )
  WHERE ("status" = 'CONFIRMED');

ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_end_after_start" CHECK ("end_time" > "start_time");

-- A booking belongs to a registered player or to a guest.
ALTER TABLE "bookings"
  ADD CONSTRAINT "bookings_player_or_guest" CHECK ("user_id" IS NOT NULL OR "guest_name" IS NOT NULL);

ALTER TABLE "booking_equipment"
  ADD CONSTRAINT "booking_equipment_quantity_positive" CHECK ("quantity" > 0);

ALTER TABLE "court_closures"
  ADD CONSTRAINT "court_closures_end_after_start" CHECK ("end_time" > "start_time");
