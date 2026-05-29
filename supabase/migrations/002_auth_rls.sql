-- Securing the terminals table with Auth

-- Drop the permissive public policies we created in step 001
DROP POLICY IF EXISTS "Public insert access" ON terminals;
DROP POLICY IF EXISTS "Public update access" ON terminals;
DROP POLICY IF EXISTS "Public delete access" ON terminals;

-- 1. Insert Policy: Only authenticated users can insert, and created_by must be their own user ID
CREATE POLICY "Users can insert their own terminals" ON terminals
  FOR INSERT 
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- 2. Update Policy: Users can only update terminals they created
CREATE POLICY "Users can update their own terminals" ON terminals
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- 3. Delete Policy: Users can only delete terminals they created
CREATE POLICY "Users can delete their own terminals" ON terminals
  FOR DELETE
  TO authenticated
  USING (auth.uid() = created_by);

-- Note: "Public read access" remains active so everyone can still see the terminals!
