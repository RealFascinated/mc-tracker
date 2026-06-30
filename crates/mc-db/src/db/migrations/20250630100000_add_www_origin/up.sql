INSERT INTO settings (key, value) VALUES ('www_origin', '')
ON CONFLICT (key) DO NOTHING;
