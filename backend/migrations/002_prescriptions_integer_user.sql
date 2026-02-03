-- Allow prescriptions to use integer user/patient IDs (app uses patients table with integer id)
-- Run this on Neon if you get: invalid input syntax for type uuid: "2"

ALTER TABLE prescriptions ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE prescriptions DROP CONSTRAINT IF EXISTS prescriptions_user_id_fkey;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS user_id_int INTEGER;
ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS patient_id INTEGER;
