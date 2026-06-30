/*
  Warnings:

  - You are about to drop the `rootme_categories` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rootme_challenges` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `rootme_solves` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[rootme_id]` on the table `categories` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[rootme_id]` on the table `challenges` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "rootme_challenges" DROP CONSTRAINT "rootme_challenges_category_id_fkey";

-- DropForeignKey
ALTER TABLE "rootme_solves" DROP CONSTRAINT "rootme_solves_challenge_id_fkey";

-- DropForeignKey
ALTER TABLE "rootme_solves" DROP CONSTRAINT "rootme_solves_user_id_fkey";

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "rootme_id" INTEGER;

-- AlterTable
ALTER TABLE "challenges" ADD COLUMN     "external_url" TEXT,
ADD COLUMN     "rootme_id" INTEGER;

-- DropTable
DROP TABLE "rootme_categories";

-- DropTable
DROP TABLE "rootme_challenges";

-- DropTable
DROP TABLE "rootme_solves";

-- CreateIndex
CREATE UNIQUE INDEX "categories_rootme_id_key" ON "categories"("rootme_id");

-- CreateIndex
CREATE UNIQUE INDEX "challenges_rootme_id_key" ON "challenges"("rootme_id");
