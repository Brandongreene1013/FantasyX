-- FX-006 NFL Data Engine
-- Adds player status placeholder and external provider ID fields
-- for the provider abstraction / sync service.

-- Player: status (injury/availability) and external provider mapping
ALTER TABLE "players" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "players" ADD COLUMN "external_provider_id" TEXT;
CREATE UNIQUE INDEX "players_external_provider_id_key" ON "players"("external_provider_id");

-- Game: external provider mapping (id gets a default via cuid in app layer)
ALTER TABLE "games" ADD COLUMN "external_provider_id" TEXT;
CREATE UNIQUE INDEX "games_external_provider_id_key" ON "games"("external_provider_id");
