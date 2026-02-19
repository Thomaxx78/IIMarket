-- Add resolution_request column to markets table
-- This stores a pending resolution request that must be approved by a random validator

ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolution_request jsonb DEFAULT NULL;
