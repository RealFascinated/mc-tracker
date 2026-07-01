DELETE FROM settings WHERE key = 'metrics_push_interval_seconds';
INSERT INTO settings (key, value) VALUES ('metrics_push_cron', '*/10 * * * * *');
