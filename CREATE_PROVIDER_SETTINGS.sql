-- Simple SQL to create provider settings table
CREATE TABLE IF NOT EXISTS provider_settings (
  id SERIAL PRIMARY KEY,
  setting_key VARCHAR(50) UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default provider setting
INSERT INTO provider_settings (setting_key, setting_value, description) 
VALUES ('default_call_provider', 'ultravox', 'Default call provider for all users (ultravox, agora)')
ON CONFLICT (setting_key) DO NOTHING;

-- Enable RLS
ALTER TABLE provider_settings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage provider settings" ON provider_settings;
DROP POLICY IF EXISTS "Users can read provider settings" ON provider_settings;

-- Create policies for admin access
CREATE POLICY "Admins can manage provider settings"
ON provider_settings FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM users 
    WHERE users.id = auth.uid() 
    AND users.is_admin = true
  )
);

-- Allow all authenticated users to read provider settings
CREATE POLICY "Users can read provider settings"
ON provider_settings FOR SELECT
TO authenticated
USING (true);

-- Verify the table was created
SELECT * FROM provider_settings;