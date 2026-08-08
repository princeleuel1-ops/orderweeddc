-- ============================================================================
-- CANA GEO KERNEL — PostGIS provisioning and spatial indexes
--
-- Idempotent. Safe to run repeatedly and safe to run before or after
-- `prisma migrate deploy`.
--
-- Why this file exists separately from Prisma migrations:
--   Prisma models the geometry column as `Unsupported("geometry(Point, 4326)")`,
--   which creates the column but does NOT create spatial indexes, the PostGIS
--   extension ordering, or the lat/lng <-> geom consistency guarantees. Those
--   are expressed here so they are reviewable as plain SQL and portable to any
--   PostgreSQL host.
--
-- Verified against: PostgreSQL 17.8 / POSTGIS 3.5.6 / GEOS 3.14.1 / PROJ 9.8.1
-- ============================================================================

-- 1. Extension. Must exist before any geometry column is created.
CREATE EXTENSION IF NOT EXISTS postgis;

-- 2. Fail loudly if the host silently lacks PostGIS rather than proceeding
--    with a broken geo layer. An absent extension is an UNKNOWN world model,
--    not a degraded one.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'postgis') THEN
    RAISE EXCEPTION 'PostGIS is not available on this database. CANA geo kernel cannot be provisioned.';
  END IF;
END
$$;

-- 3. Geometry column. Created defensively so this file also works when the
--    Prisma migration has not yet introduced it.
ALTER TABLE "GeoEntity"
  ADD COLUMN IF NOT EXISTS "geom" geometry(Point, 4326);

-- 4. Spatial index. GiST is required for && / ST_DWithin / ST_Contains to use
--    an index rather than degrading to a sequential scan.
CREATE INDEX IF NOT EXISTS "GeoEntity_geom_gist"
  ON "GeoEntity" USING GIST ("geom");

-- 5. Coordinate integrity. Reject impossible coordinates at the storage layer
--    so a bad provider response cannot poison the world model.
ALTER TABLE "GeoEntity" DROP CONSTRAINT IF EXISTS "GeoEntity_lat_range";
ALTER TABLE "GeoEntity" ADD CONSTRAINT "GeoEntity_lat_range"
  CHECK ("lat" >= -90 AND "lat" <= 90);

ALTER TABLE "GeoEntity" DROP CONSTRAINT IF EXISTS "GeoEntity_lng_range";
ALTER TABLE "GeoEntity" ADD CONSTRAINT "GeoEntity_lng_range"
  CHECK ("lng" >= -180 AND "lng" <= 180);

-- 6. Null Island guard. (0,0) is the single most common geocoding failure
--    signature and must never be mistaken for a real DC location.
ALTER TABLE "GeoEntity" DROP CONSTRAINT IF EXISTS "GeoEntity_not_null_island";
ALTER TABLE "GeoEntity" ADD CONSTRAINT "GeoEntity_not_null_island"
  CHECK (NOT ("lat" = 0 AND "lng" = 0));

-- 7. lat/lng -> geom coherence. The portable mirror and the canonical geometry
--    must never silently diverge. Enforced by trigger so it holds regardless of
--    whether a write came from Prisma, a script, or raw SQL.
CREATE OR REPLACE FUNCTION cana_geoentity_sync_geom()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."geom" := ST_SetSRID(ST_MakePoint(NEW."lng", NEW."lat"), 4326);
  RETURN NEW;
END
$$;

DROP TRIGGER IF EXISTS "GeoEntity_sync_geom" ON "GeoEntity";
CREATE TRIGGER "GeoEntity_sync_geom"
  BEFORE INSERT OR UPDATE OF "lat", "lng" ON "GeoEntity"
  FOR EACH ROW EXECUTE FUNCTION cana_geoentity_sync_geom();

-- 8. Backfill geometry for any row written before the trigger existed.
UPDATE "GeoEntity"
   SET "geom" = ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)
 WHERE "geom" IS NULL;

-- 9. Supporting indexes for evidence-gated reads. The public map filters on
--    these constantly, so they must not be sequential scans.
CREATE INDEX IF NOT EXISTS "GeoClaim_eligible_lookup"
  ON "GeoClaim" ("geoEntityId", "claimType")
  WHERE "decisionEligible" = true;
