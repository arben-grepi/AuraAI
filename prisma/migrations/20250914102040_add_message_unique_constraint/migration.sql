/*
  Warnings:

  - A unique constraint covering the columns `[conversationId,content,role]` on the table `message` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "message_conversationId_content_role_key" ON "public"."message"("conversationId", "content", "role");
