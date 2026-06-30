INSERT INTO settings (key, value) VALUES ('maxmind_database_dir', 'databases')
ON CONFLICT (key) DO NOTHING;
