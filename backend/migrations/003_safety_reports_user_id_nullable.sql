-- Allow user_id to be NULL in safety_reports
-- Auth uses patients (integer IDs), not users (UUIDs). Reports are linked via prescription_id.
ALTER TABLE safety_reports ALTER COLUMN user_id DROP NOT NULL;
