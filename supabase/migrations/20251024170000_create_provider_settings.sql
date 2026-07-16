-- Create provider settings table for admin control
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
VALUES ('default_call_provider', 'ultravox', 'Default call provider for all users (ultravox, agora, custom)')
ON CONFLICT (setting_key) DO NOTHING;

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_provider_settings_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for updated_at
DROP TRIGGER IF EXISTS provider_settings_updated_at ON provider_settings;
CREATE TRIGGER provider_settings_updated_at
  BEFORE UPDATE ON provider_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_provider_settings_updated_at();

-- Enable RLS
ALTER TABLE provider_settings ENABLE ROW LEVEL SECURITY;

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
