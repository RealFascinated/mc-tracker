usage_engine=$(du -s /home/tracker/influx/db/engine/data/setme/ | cut -f1)
usage_wal=$(du -s /home/tracker/influx/db/engine/wal/setme/ | cut -f1)

# Calculate the sum of usage_engine and usage_wal
total_usage=$((usage_engine + usage_wal))

docker exec influxdb influx write \
  --org homelab \
  --bucket influx_metrics \
  --token setme \
  --precision s \
  "storage_usage,db=mc-tracker value=$total_usage"