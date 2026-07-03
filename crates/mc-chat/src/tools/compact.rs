use mc_api_types::{
    AsnDetailResponse, AsnListItemResponse, AsnTimeseriesSummaryResponse, ServerListItemResponse,
    ServerSearchItemResponse, ServerTimeseriesSummaryResponse, ServersListResponse,
    ServersSearchResponse, TimeseriesSummaryResponse,
};
use serde_json::{json, Value};

pub fn compact_servers_list(response: ServersListResponse, truncated: bool) -> Value {
    json!({
        "summary": compact_players_summary(&response.summary),
        "servers": response.servers.iter().map(compact_server).collect::<Vec<_>>(),
        "truncated": truncated,
    })
}

pub fn compact_search(response: ServersSearchResponse) -> Value {
    json!({
        "servers": response.servers.iter().map(compact_search_item).collect::<Vec<_>>(),
    })
}

pub fn compact_server_detail(server: ServerListItemResponse) -> Value {
    compact_server(&server)
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

pub fn compact_asns_list(response: mc_api_types::AsnsListResponse, truncated: bool) -> Value {
    json!({
        "summary": compact_asns_summary(&response.summary),
        "asns": response.asns.iter().map(compact_asn_item).collect::<Vec<_>>(),
        "truncated": truncated,
    })
}

pub fn compact_timeseries_summary(summary: &TimeseriesSummaryResponse) -> Value {
    json!({
        "start": summary.start,
        "end": summary.end,
        "min": summary.min,
        "max": summary.max,
        "avg": summary.avg,
        "changePct": summary.change_pct,
        "trend": summary.trend,
    })
}

pub fn compact_server_timeseries_summary(response: ServerTimeseriesSummaryResponse) -> Value {
    let ServerTimeseriesSummaryResponse { id, name, summary } = response;
    let mut value = compact_timeseries_summary(&summary);
    if let Value::Object(ref mut map) = value {
        map.insert("id".into(), json!(id));
        map.insert("name".into(), json!(name));
    }
    value
}

pub fn compact_asn_timeseries_summary(response: AsnTimeseriesSummaryResponse) -> Value {
    let AsnTimeseriesSummaryResponse {
        asn,
        asn_org,
        summary,
    } = response;
    let mut value = compact_timeseries_summary(&summary);
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

pub fn compact_compare_servers(
    rows: Vec<(String, String, TimeseriesSummaryResponse)>,
    errors: Vec<(String, String)>,
) -> Value {
    json!({
        "servers": rows.into_iter().map(|(id, name, summary)| {
            let mut value = compact_timeseries_summary(&summary);
            if let Value::Object(ref mut map) = value {
                map.insert("id".into(), json!(id));
                map.insert("name".into(), json!(name));
            }
            value
        }).collect::<Vec<_>>(),
        "errors": errors.into_iter().map(|(id, error)| json!({ "id": id, "error": error })).collect::<Vec<_>>(),
    })
}

pub fn compact_servers_all_time_peak(servers: &[ServerListItemResponse]) -> Value {
    let mut ranked: Vec<_> = servers
        .iter()
        .filter_map(|server| {
            server
                .peaks
                .all_time
                .as_ref()
                .map(|peak| (server, peak))
        })
        .collect();

    if ranked.is_empty() {
        return json!({ "peakPlayers": null, "servers": [] });
    }

    ranked.sort_by(|a, b| b.1.players.cmp(&a.1.players));
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

pub fn compact_servers_growth_rank(response: mc_api_types::ServersGrowthRankResponse) -> Value {
    let order = match response.order {
        mc_api_types::GrowthRankOrder::Gainers => "gainers",
        mc_api_types::GrowthRankOrder::Losers => "losers",
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
        "errors": response.errors.iter().map(|entry| {
            json!({ "id": entry.id, "error": entry.error })
        }).collect::<Vec<_>>(),
    })
}

fn compact_server(server: &ServerListItemResponse) -> Value {
    json!({
        "id": server.id,
        "name": server.name,
        "host": server.host,
        "port": server.port,
        "type": server.server_type,
        "playersOnline": server.players_online,
        "asn": server.asn,
        "asnOrg": server.asn_org,
        "peak24h": server.peaks.players_24h,
    })
}

fn compact_search_item(server: &ServerSearchItemResponse) -> Value {
    json!({
        "id": server.id,
        "name": server.name,
        "host": server.host,
        "port": server.port,
        "type": server.server_type,
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
        "playersPc": summary.players_pc,
        "playersPe": summary.players_pe,
        "trackedServers": summary.tracked_servers,
    })
}

fn compact_asns_summary(summary: &mc_api_types::AsnsSummaryResponse) -> Value {
    json!({
        "totalPlayers": summary.total_players,
        "trackedAsns": summary.tracked_asns,
        "trackedServers": summary.tracked_servers,
    })
}
