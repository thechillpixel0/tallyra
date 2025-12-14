/*
  # Fix staff table and transactions foreign key

  1. Database Schema Updates
    - Add missing 'address' column to staff table
    - Fix staff_id foreign key relationship in transactions table
    - Add proper indexes for performance

  2. Security
    - Maintain existing RLS policies
    - Ensure proper data integrity
*/

-- Add missing address column to staff table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name = 'address'
  ) THEN
    ALTER TABLE staff ADD COLUMN address text;
  END IF;
END $$;

-- Add missing phone and email columns to staff table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name = 'phone'
  ) THEN
    ALTER TABLE staff ADD COLUMN phone text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'staff' AND column_name = 'email'
  ) THEN
    ALTER TABLE staff ADD COLUMN email text;
  END IF;
END $$;

-- Fix staff_id column type in transactions table to be UUID
DO $$
BEGIN
  -- Check if staff_id is not UUID type
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' 
    AND column_name = 'staff_id' 
    AND data_type != 'uuid'
  ) THEN
    -- Drop existing foreign key constraint if it exists
    ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_staff_id_fkey;
    
    -- Change column type to UUID
    ALTER TABLE transactions ALTER COLUMN staff_id TYPE uuid USING staff_id::uuid;
    
    -- Re-add foreign key constraint
    ALTER TABLE transactions ADD CONSTRAINT transactions_staff_id_fkey 
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Ensure proper foreign key exists between transactions and staff
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'transactions_staff_id_fkey'
  ) THEN
    ALTER TABLE transactions ADD CONSTRAINT transactions_staff_id_fkey 
      FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_transactions_staff_id ON transactions(staff_id);