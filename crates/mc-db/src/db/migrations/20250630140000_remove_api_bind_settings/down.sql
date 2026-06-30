INSERT INTO settings (key, value) VALUES
    ('api_port', '3000'),
    ('api_address', '0.0.0.0')
ON CONFLICT (key) DO NOTHING;
