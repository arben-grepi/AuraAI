-- AlterTable
ALTER TABLE "organization" ADD COLUMN     "maxMembers" INTEGER;

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "maxOrgs" INTEGER;
