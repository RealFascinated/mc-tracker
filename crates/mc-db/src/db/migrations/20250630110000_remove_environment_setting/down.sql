INSERT INTO settings (key, value) VALUES ('environment', 'production')
ON CONFLICT (key) DO NOTHING;
