use mc_api_types::{
    AsnDetailResponse, AsnListItemResponse, IpLookupResponse, ServerListItemResponse,
    ServerSearchItemResponse, ServersListResponse, ServersSearchResponse,
};
use mc_chat_types::{
    ChatAsnTimeseriesSnapshot, ChatAsnsGrowthRankResponse, ChatCompareServersResponse,
    ChatGrowthRankOrder, ChatPartialError, ChatServerTimeseriesSnapshot,
    ChatServersGrowthRankResponse, ChatServersPeriodPeakRankResponse, ChatTimeseriesSnapshot,
};
use mc_common::{effective_server_port, platform_display_label};
use serde_json::{json, Value};

pub fn compact_servers_list(response: ServersListResponse, truncated: bool) -> Value {
    json!({
        "summary": compact_players_summary(&response.summary),
        "servers": response
            .servers
            .iter()
            .map(compact_server_list_item)
            .collect::<Vec<_>>(),
        "truncated": truncated,
    })
}

pub fn compact_search(response: ServersSearchResponse) -> Value {
    json!({
        "servers": response.servers.iter().map(compact_search_item).collect::<Vec<_>>(),
    })
}

fn compact_server_list_item(server: &ServerListItemResponse) -> Value {
    json!({
        "id": server.id,
        "name": server.name,
        "host": server.host,
        "port": effective_server_port(server.port, &server.server_type),
        "platform": platform_display_label(&server.server_type),
        "playersOnline": server.players_online,
        "asn": server.asn,
        "asnOrg": server.asn_org,
    })
}

pub(crate) fn compact_server(server: &ServerListItemResponse) -> Value {
    json!({
        "id": server.id,
        "name": server.name,
        "host": server.host,
        "port": server.port,
        "platform": platform_display_label(&server.server_type),
        "playersOnline": server.players_online,
        "asn": server.asn,
        "asnOrg": server.asn_org,
        "peaks": compact_entity_peaks(&server.peaks),
    })
}

pub fn compact_asn_detail(detail: AsnDetailResponse) -> Value {
    json!({
        "asn": detail.asn,
        "asnOrg": detail.asn_org,
        "playersOnline": detail.players_online,
        "serverCount": detail.server_count,
        "summary": compact_players_summary(&detail.summary),
        "servers": detail.servers.iter().map(compact_server).collect::<Vec<_>>(),
    })
}

pub fn compact_ip_lookup(response: IpLookupResponse) -> Value {
    json!({
        "query": response.query,
        "ip": response.ip,
        "asn": response.asn,
        "asnOrg": response.asn_org,
        "cidr": response.cidr,
    })
}

pub fn compact_asns_list(response: mc_api_types::AsnsListResponse, truncated: bool) -> Value {
    json!({
        "summary": compact_asns_summary(&response.summary),
        "asns": response.asns.iter().map(compact_asn_item).collect::<Vec<_>>(),
        "truncated": truncated,
    })
}

pub fn compact_timeseries_snapshot(snapshot: &ChatTimeseriesSnapshot) -> Value {
    json!({
        "start": snapshot.start,
        "end": snapshot.end,
        "min": snapshot.min,
        "max": snapshot.max,
        "avg": snapshot.avg,
        "changePct": snapshot.change_pct,
        "trend": snapshot.trend,
        "seriesKey": snapshot.series_key,
        "points": snapshot.points.iter().map(|point| {
            json!({ "timestamp": point.timestamp, "value": point.value })
        }).collect::<Vec<_>>(),
    })
}

pub fn compact_timeseries_metrics(snapshot: &ChatTimeseriesSnapshot) -> Value {
    json!({
        "from": snapshot.from,
        "to": snapshot.to,
        "start": snapshot.start,
        "end": snapshot.end,
        "min": snapshot.min,
        "max": snapshot.max,
        "avg": snapshot.avg,
        "changePct": snapshot.change_pct,
        "trend": snapshot.trend,
    })
}

pub fn compact_server_stats(
    server: &ServerListItemResponse,
    trends: &[(&str, Result<ChatTimeseriesSnapshot, String>)],
) -> Value {
    let trend_values: Value = trends
        .iter()
        .map(|(label, result)| {
            let value = match result {
                Ok(snapshot) => compact_timeseries_metrics(snapshot),
                Err(error) => json!({ "error": error }),
            };
            (label.to_string(), value)
        })
        .collect();
    let mut value = compact_server(server);
    if let Value::Object(ref mut map) = value {
        map.insert("trends".into(), trend_values);
    }
    value
}

pub fn compact_server_timeseries_summary(response: ChatServerTimeseriesSnapshot) -> Value {
    let ChatServerTimeseriesSnapshot { id, name, snapshot } = response;
    let mut value = compact_timeseries_snapshot(&snapshot);
    if let Value::Object(ref mut map) = value {
        map.insert("id".into(), json!(id));
        map.insert("name".into(), json!(name));
    }
    value
}

pub fn compact_asn_timeseries_summary(response: ChatAsnTimeseriesSnapshot) -> Value {
    let ChatAsnTimeseriesSnapshot {
        asn,
        asn_org,
        snapshot,
    } = response;
    let mut value = compact_timeseries_snapshot(&snapshot);
    if let Value::Object(ref mut map) = value {
        map.insert("asn".into(), json!(asn));
        map.insert("asnOrg".into(), json!(asn_org));
    }
    value
}

pub fn compact_asn_search(response: &mc_api_types::AsnSearchResponse) -> Value {
    let networks = &response.matching_networks;
    let org_servers = &response.servers_with_asn_org;
    let servers_on_networks: u32 = networks.asns.iter().map(|asn| asn.server_count).sum();
    let players_on_networks: u64 = networks
        .asns
        .iter()
        .map(|asn| asn.players_online as u64)
        .sum();
    json!({
        "query": response.query,
        "matchingNetworks": {
            "networkCount": networks.asns.len(),
            "serverCount": servers_on_networks,
            "playersOnline": players_on_networks,
            "asns": networks.asns.iter().map(compact_asn_item).collect::<Vec<_>>(),
            "truncated": response.networks_truncated,
        },
        "serversWithAsnOrg": {
            "summary": compact_players_summary(&org_servers.summary),
            "servers": org_servers.servers.iter().map(compact_server).collect::<Vec<_>>(),
            "truncated": response.org_servers_truncated,
        },
    })
}

pub fn compact_compare_servers(response: ChatCompareServersResponse) -> Value {
    json!({
        "from": response.from,
        "to": response.to,
        "servers": response.servers.iter().map(|item| {
            let mut value = compact_timeseries_snapshot(&item.snapshot);
            if let Value::Object(ref mut map) = value {
                map.insert("id".into(), json!(item.id));
                map.insert("name".into(), json!(item.name));
            }
            value
        }).collect::<Vec<_>>(),
        "errors": compact_chat_partial_errors(&response.errors),
    })
}

pub fn compact_servers_all_time_peak(servers: &[ServerListItemResponse]) -> Value {
    let mut ranked: Vec<_> = servers
        .iter()
        .filter_map(|server| server.peaks.all_time.as_ref().map(|peak| (server, peak)))
        .collect();

    if ranked.is_empty() {
        return json!({ "peakPlayers": null, "servers": [] });
    }

    ranked.sort_by_key(|b| std::cmp::Reverse(b.1.players));
    let peak_players = ranked[0].1.players;
    let top: Vec<_> = ranked
        .iter()
        .filter(|(_, peak)| peak.players == peak_players)
        .map(|(server, peak)| {
            json!({
                "id": server.id,
                "name": server.name,
                "peakPlayers": peak.players,
                "peakAt": peak.timestamp,
            })
        })
        .collect();

    json!({
        "peakPlayers": peak_players,
        "servers": top,
    })
}

pub fn compact_servers_period_peak_rank(response: ChatServersPeriodPeakRankResponse) -> Value {
    json!({
        "from": response.from,
        "to": response.to,
        "servers": response.servers.iter().map(|server| {
            json!({
                "id": server.id,
                "name": server.name,
                "max": server.max,
                "avg": server.avg,
            })
        }).collect::<Vec<_>>(),
        "errors": compact_chat_partial_errors(&response.errors),
    })
}

pub fn compact_servers_near_peak(
    servers: &[ServerListItemResponse],
    limit: usize,
    min_utilization_pct: f64,
) -> Value {
    let mut ranked: Vec<(f64, &ServerListItemResponse, f64)> = servers
        .iter()
        .filter_map(|server| {
            let online = server.players_online? as f64;
            let reference = server
                .peaks
                .players_24h
                .filter(|peak| *peak > 0.0)
                .or_else(|| {
                    server
                        .peaks
                        .all_time
                        .as_ref()
                        .map(|peak| peak.players as f64)
                        .filter(|peak| *peak > 0.0)
                })?;
            let utilization_pct = (online / reference) * 100.0;
            if utilization_pct < min_utilization_pct {
                return None;
            }
            Some((utilization_pct, server, reference))
        })
        .collect();

    ranked.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
    ranked.truncate(limit);

    json!({
        "minUtilizationPct": min_utilization_pct,
        "servers": ranked.into_iter().map(|(utilization_pct, server, reference_peak)| {
            json!({
                "id": server.id,
                "name": server.name,
                "playersOnline": server.players_online,
                "referencePeak": reference_peak,
                "utilizationPct": (utilization_pct * 10.0).round() / 10.0,
            })
        }).collect::<Vec<_>>(),
    })
}

pub fn compact_tracker_summary(summary: &mc_api_types::ServersSummaryResponse) -> Value {
    compact_players_summary(summary)
}

pub fn compact_servers_growth_rank(response: ChatServersGrowthRankResponse) -> Value {
    let order = match response.order {
        ChatGrowthRankOrder::Gainers => "gainers",
        ChatGrowthRankOrder::Losers => "losers",
    };
    json!({
        "from": response.from,
        "to": response.to,
        "order": order,
        "servers": response.servers.iter().map(|server| {
            json!({
                "id": server.id,
                "name": server.name,
                "start": server.start,
                "end": server.end,
                "changePct": server.change_pct,
                "trend": server.trend,
            })
        }).collect::<Vec<_>>(),
        "errors": compact_chat_partial_errors(&response.errors),
    })
}

pub fn compact_asns_growth_rank(response: ChatAsnsGrowthRankResponse) -> Value {
    let order = match response.order {
        ChatGrowthRankOrder::Gainers => "gainers",
        ChatGrowthRankOrder::Losers => "losers",
    };
    json!({
        "from": response.from,
        "to": response.to,
        "order": order,
        "asns": response.asns.iter().map(|asn| {
            json!({
                "asn": asn.asn,
                "asnOrg": asn.asn_org,
                "start": asn.start,
                "end": asn.end,
                "changePct": asn.change_pct,
                "trend": asn.trend,
            })
        }).collect::<Vec<_>>(),
        "errors": compact_chat_partial_errors(&response.errors),
    })
}

fn compact_chat_partial_errors(errors: &[ChatPartialError]) -> Vec<Value> {
    errors
        .iter()
        .map(|error| {
            json!({
                "code": error.code,
                "message": error.message,
                "target": error.target,
            })
        })
        .collect()
}

fn compact_entity_peaks(peaks: &mc_api_types::EntityPeakStats) -> Value {
    let mut value = json!({
        "peak24h": peaks.players_24h,
    });
    if let Some(all_time) = &peaks.all_time {
        if let Value::Object(ref mut map) = value {
            map.insert(
                "allTime".into(),
                json!({
                    "players": all_time.players,
                    "peakAt": all_time.timestamp,
                }),
            );
        }
    }
    value
}

fn compact_search_item(server: &ServerSearchItemResponse) -> Value {
    json!({
        "id": server.id,
        "name": server.name,
        "host": server.host,
        "port": server.port,
        "platform": platform_display_label(&server.server_type),
        "playersOnline": server.players_online,
    })
}

fn compact_asn_item(asn: &AsnListItemResponse) -> Value {
    json!({
        "asn": asn.asn,
        "asnOrg": asn.asn_org,
        "playersOnline": asn.players_online,
        "serverCount": asn.server_count,
        "peak24h": asn.peaks.players_24h,
    })
}

fn compact_players_summary(summary: &mc_api_types::ServersSummaryResponse) -> Value {
    json!({
        "totalPlayers": summary.total_players,
        "playersJava": summary.players_pc,
        "playersBedrock": summary.players_pe,
        "trackedServers": summary.tracked_servers,
        "peaks": {
            "players24h": summary.peaks.players_24h,
            "players7d": summary.peaks.players_7d,
        },
    })
}

fn compact_asns_summary(summary: &mc_api_types::AsnsSummaryResponse) -> Value {
    json!({
        "totalPlayers": summary.total_players,
        "trackedAsns": summary.tracked_asns,
        "trackedServers": summary.tracked_servers,
    })
}

#[cfg(test)]
mod tests {
    use mc_chat_types::{ChatPoint, ChatTimeseriesSnapshot, ChatTrend};

    use mc_api_types::{
        EntityPeakStats, PeakPlayersRecord, ServerListItemResponse, ServersListResponse,
    };

    use super::*;

    fn sample_server(name: &str, online: u32, peak24h: f64) -> ServerListItemResponse {
        ServerListItemResponse {
            id: format!("id-{name}"),
            name: name.into(),
            server_type: "java".into(),
            host: "example.com".into(),
            port: Some(25565),
            asn: "AS1".into(),
            asn_org: "Host".into(),
            players_online: Some(online),
            favicon: None,
            peaks: EntityPeakStats {
                players_24h: Some(peak24h),
                all_time: Some(PeakPlayersRecord {
                    players: peak24h as u32,
                    timestamp: 1,
                }),
            },
        }
    }

    #[test]
    fn compact_timeseries_snapshot_includes_object_points() {
        let snapshot = ChatTimeseriesSnapshot {
            from: 1,
            to: 2,
            series_key: "playersOnline".into(),
            start: Some(10.0),
            end: Some(12.0),
            avg: Some(11.0),
            min: Some(10.0),
            max: Some(12.0),
            change_pct: Some(20.0),
            trend: ChatTrend::Growing,
            points: vec![
                ChatPoint {
                    timestamp: 1,
                    value: 10.0,
                },
                ChatPoint {
                    timestamp: 2,
                    value: 12.0,
                },
            ],
        };
        let value = compact_timeseries_snapshot(&snapshot);
        assert_eq!(value["seriesKey"], "playersOnline");
        assert_eq!(value["points"][0]["timestamp"], 1);
        assert_eq!(value["points"][0]["value"], 10.0);
    }

    #[test]
    fn compact_server_includes_all_time_peak() {
        let server = sample_server("Hypixel", 100, 1000.0);
        let value = compact_server(&server);
        assert_eq!(value["peaks"]["peak24h"], 1000.0);
        assert_eq!(value["peaks"]["allTime"]["players"], 1000);
    }

    #[test]
    fn compact_server_list_item_is_minimal_with_default_port() {
        let mut server = sample_server("Hypixel", 100, 1000.0);
        server.port = None;
        let value = compact_servers_list(
            ServersListResponse {
                summary: mc_api_types::ServersSummaryResponse {
                    total_players: 100,
                    players_pc: 100,
                    players_pe: 0,
                    tracked_servers: 1,
                    peaks: mc_api_types::PlayersPeakSummary {
                        players_24h: None,
                        players_7d: None,
                    },
                },
                servers: vec![server],
            },
            false,
        );
        let item = &value["servers"][0];
        assert_eq!(item["id"], "id-Hypixel");
        assert!(item.get("peaks").is_none());
        assert_eq!(item["port"], 25565);
        assert_eq!(item["name"], "Hypixel");
    }

    #[test]
    fn compact_servers_near_peak_ranks_by_utilization() {
        let servers = vec![
            sample_server("Low", 500, 1000.0),
            sample_server("High", 950, 1000.0),
        ];
        let value = compact_servers_near_peak(&servers, 10, 90.0);
        let ranked = value["servers"].as_array().unwrap();
        assert_eq!(ranked.len(), 1);
        assert_eq!(ranked[0]["name"], "High");
        assert_eq!(ranked[0]["utilizationPct"], 95.0);
    }
}
