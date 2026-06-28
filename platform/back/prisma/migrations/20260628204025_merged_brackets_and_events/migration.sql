/*
  Warnings:

  - You are about to drop the column `bracket_id` on the `events` table. All the data in the column will be lost.
  - You are about to drop the `bracket_members` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `brackets` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "bracket_members" DROP CONSTRAINT "bracket_members_bracket_id_fkey";

-- DropForeignKey
ALTER TABLE "bracket_members" DROP CONSTRAINT "bracket_members_user_id_fkey";

-- DropForeignKey
ALTER TABLE "events" DROP CONSTRAINT "events_bracket_id_fkey";

-- AlterTable
ALTER TABLE "categories" ALTER COLUMN "description" SET DEFAULT '',
ALTER COLUMN "exploit_description" SET DEFAULT '';

-- AlterTable
ALTER TABLE "challenges" ALTER COLUMN "description" SET DEFAULT '';

-- AlterTable
ALTER TABLE "events" DROP COLUMN "bracket_id",
ALTER COLUMN "description" SET DEFAULT '';

-- DropTable
DROP TABLE "bracket_members";

-- DropTable
DROP TABLE "brackets";

-- CreateTable
CREATE TABLE "event_members" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "event_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_challenges" (
    "id" SERIAL NOT NULL,
    "event_id" INTEGER NOT NULL,
    "challenge_id" INTEGER NOT NULL,

    CONSTRAINT "event_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "event_members_user_id_event_id_key" ON "event_members"("user_id", "event_id");

-- CreateIndex
CREATE UNIQUE INDEX "event_challenges_event_id_challenge_id_key" ON "event_challenges"("event_id", "challenge_id");

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_members" ADD CONSTRAINT "event_members_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_challenges" ADD CONSTRAINT "event_challenges_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_challenges" ADD CONSTRAINT "event_challenges_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
