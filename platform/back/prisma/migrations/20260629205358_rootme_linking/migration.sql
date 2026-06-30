/*
  Warnings:

  - A unique constraint covering the columns `[rootme_id]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "users" ADD COLUMN     "rootme_id" INTEGER,
ADD COLUMN     "rootme_username" TEXT;

-- CreateTable
CREATE TABLE "rootme_categories" (
    "id" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rootme_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rootme_challenges" (
    "id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "score" INTEGER NOT NULL DEFAULT 0,
    "difficulty" TEXT,
    "url_path" TEXT,
    "synced_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rootme_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rootme_solves" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "challenge_id" INTEGER NOT NULL,
    "solved_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rootme_solves_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "rootme_solves_user_id_challenge_id_key" ON "rootme_solves"("user_id", "challenge_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_rootme_id_key" ON "users"("rootme_id");

-- AddForeignKey
ALTER TABLE "rootme_challenges" ADD CONSTRAINT "rootme_challenges_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "rootme_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rootme_solves" ADD CONSTRAINT "rootme_solves_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rootme_solves" ADD CONSTRAINT "rootme_solves_challenge_id_fkey" FOREIGN KEY ("challenge_id") REFERENCES "rootme_challenges"("id") ON DELETE CASCADE ON UPDATE CASCADE;
