-- CreateTable
CREATE TABLE "source_indexes" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "source_url" TEXT NOT NULL,
    "last_indexed_at" TIMESTAMP(3) NOT NULL,
    "pages_indexed" INTEGER NOT NULL,
    "total_chunks" INTEGER NOT NULL,

    CONSTRAINT "source_indexes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "source_indexes_organization_id_source_url_key" ON "source_indexes"("organization_id", "source_url");

-- AddForeignKey
ALTER TABLE "source_indexes" ADD CONSTRAINT "source_indexes_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
