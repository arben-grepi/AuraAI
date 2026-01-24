-- AlterTable
ALTER TABLE "conversation" ADD COLUMN "chat_folder_id" TEXT;

-- CreateTable
CREATE TABLE "chat_folders" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,

    CONSTRAINT "chat_folders_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "conversation" ADD CONSTRAINT "conversation_chat_folder_id_fkey" FOREIGN KEY ("chat_folder_id") REFERENCES "chat_folders"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chat_folders" ADD CONSTRAINT "chat_folders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
