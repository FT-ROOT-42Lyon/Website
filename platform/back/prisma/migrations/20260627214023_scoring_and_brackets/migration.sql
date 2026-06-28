-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('VERY_EASY', 'EASY', 'MEDIUM', 'HARD', 'VERY_HARD');

-- AlterTable
ALTER TABLE "challenges" ADD COLUMN     "difficulty" "Difficulty" NOT NULL DEFAULT 'MEDIUM',
ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 100;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "score" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "brackets" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brackets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bracket_members" (
    "id" SERIAL NOT NULL,
    "user_id" INTEGER NOT NULL,
    "bracket_id" INTEGER NOT NULL,
    "score" INTEGER NOT NULL DEFAULT 0,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bracket_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "brackets_slug_key" ON "brackets"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "brackets_name_key" ON "brackets"("name");

-- CreateIndex
CREATE UNIQUE INDEX "bracket_members_user_id_bracket_id_key" ON "bracket_members"("user_id", "bracket_id");

-- AddForeignKey
ALTER TABLE "bracket_members" ADD CONSTRAINT "bracket_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bracket_members" ADD CONSTRAINT "bracket_members_bracket_id_fkey" FOREIGN KEY ("bracket_id") REFERENCES "brackets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
