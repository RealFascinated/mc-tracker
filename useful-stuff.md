# Useful stuff

## Deleteing a specific server from influx

```bash
influx delete --bucket mc-tracker --start 2024-01-01T00:00:00Z --stop 2024-01-05T00:00:00Z --org homelab --token nou --predicate '_measurement="playerCount" AND "name"="Grand Theft Minecraft"'
```
