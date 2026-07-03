use async_trait::async_trait;
use serde_json::json;
use uuid::Uuid;

use crate::error::ChatError;
use crate::llm::types::{ToolDefinition, ToolFunctionSchema};
use crate::tools::compact::{
    compact_asn_detail, compact_asn_search, compact_asn_timeseries_summary, compact_asns_list,
    compact_compare_servers, compact_search, compact_server_detail,
    compact_server_timeseries_summary, compact_servers_all_time_peak, compact_servers_growth_rank,
    compact_servers_list, compact_timeseries_summary,
};
use crate::traits::{ChatTool, ChatToolDeps};

const MAX_COMPARE_SERVERS: usize = 5;
const LIST_CAP: usize = 25;
const DEFAULT_RANK_LIMIT: u32 = 10;
const MAX_RANK_LIMIT: u32 = LIST_CAP as u32;
const SEARCH_CAP: u32 = LIST_CAP as u32;

fn tool_def(name: &str, description: &str, parameters: serde_json::Value) -> serde_json::Value {
    serde_json::to_value(ToolDefinition {
        tool_type: "function".into(),
        function: ToolFunctionSchema {
            name: name.into(),
            description: description.into(),
            parameters,
        },
    })
    .unwrap()
}

pub struct ListServersTool;

#[async_trait]
impl ChatTool for ListServersTool {
    fn name(&self) -> &'static str {
        "list_servers"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "list_servers",
            "List tracked servers sorted by players online.",
            json!({
                "type": "object",
                "properties": {}
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        _args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let mut response = deps.tracker.list_servers().await;
        let truncated = truncate(&mut response.servers, LIST_CAP);
        Ok(compact_servers_list(response, truncated))
    }
}

pub struct SearchServersTool;

#[async_trait]
impl ChatTool for SearchServersTool {
    fn name(&self) -> &'static str {
        "search_servers"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "search_servers",
            "Discover servers by keyword when no single server is named. Not for resolving a server the user already named — use get_server instead.",
            json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string" },
                    "limit": { "type": "integer", "description": "Max results (default 5)" }
                },
                "required": ["query"]
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let query = require_str(&args, "query")?;
        let limit = args.get("limit").and_then(|v| v.as_u64()).unwrap_or(5) as u32;
        let response = deps.tracker.search_servers(Some(query), limit).await;
        Ok(compact_search(response))
    }
}

pub struct GetServerTool;

#[async_trait]
impl ChatTool for GetServerTool {
    fn name(&self) -> &'static str {
        "get_server"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "get_server",
            "Get one server by UUID or name/query. Use for tell me about / what is questions and any single-server question.",
            json!({
                "type": "object",
                "properties": {
                    "server_id": { "type": "string", "description": "Server UUID" },
                    "query": { "type": "string", "description": "Loose search when UUID unknown" }
                }
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let id = resolve_server_id(deps, &args).await?;
        let server = deps
            .tracker
            .server_detail(id)
            .await
            .ok_or_else(|| ChatError::Tool("server not found".into()))?;
        Ok(compact_server_detail(server))
    }
}

pub struct GetAsnTool;

#[async_trait]
impl ChatTool for GetAsnTool {
    fn name(&self) -> &'static str {
        "get_asn"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "get_asn",
            "ASN/hosting network lookup by asn number or asnOrg label. Only when the user asks about hosting, provider, or network — not server names.",
            json!({
                "type": "object",
                "properties": {
                    "query": { "type": "string", "description": "Loose search, e.g. DonutSMP or OVH" },
                    "asn": { "type": "string" },
                    "asn_org": { "type": "string" }
                }
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        if let Some(query) = args.get("query").and_then(|v| v.as_str()) {
            let query = query.trim();
            if query.is_empty() {
                return Err(ChatError::Tool("query must not be empty".into()));
            }
            return compact_asn_query(deps, query).await;
        }

        let asn = require_str(&args, "asn")?;
        let asn_org = args.get("asn_org").and_then(|v| v.as_str()).unwrap_or("");
        let detail = deps
            .tracker
            .asn_detail(asn, asn_org)
            .await
            .ok_or_else(|| ChatError::Tool("asn not found".into()))?;
        Ok(compact_asn_detail(detail))
    }
}

pub struct ServerTimeseriesSummaryTool;

#[async_trait]
impl ChatTool for ServerTimeseriesSummaryTool {
    fn name(&self) -> &'static str {
        "get_server_timeseries_summary"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "get_server_timeseries_summary",
            "Player count trend summary for one server. Use relative from/to like 7d and now.",
            json!({
                "type": "object",
                "properties": {
                    "server_id": { "type": "string" },
                    "from": { "type": "string", "description": "Start bound, e.g. 7d" },
                    "to": { "type": "string", "description": "End bound, e.g. now" }
                },
                "required": ["server_id", "from", "to"]
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let id = parse_uuid(args.get("server_id"))?;
        let from = require_str(&args, "from")?;
        let to = require_str(&args, "to")?;
        let summary = deps
            .insights
            .server_timeseries_summary(id, from, to)
            .await?;
        Ok(compact_server_timeseries_summary(summary))
    }
}

pub struct RankServersByGrowthTool;

#[async_trait]
impl ChatTool for RankServersByGrowthTool {
    fn name(&self) -> &'static str {
        "rank_servers_by_growth"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "rank_servers_by_growth",
            "Rank all tracked servers by player count change over a time range. Use for which server gained or lost the most — one call, not per-server summaries.",
            json!({
                "type": "object",
                "properties": {
                    "from": { "type": "string", "description": "Start bound, e.g. 30d or 7d" },
                    "to": { "type": "string", "description": "End bound, e.g. now" },
                    "limit": {
                        "type": "integer",
                        "description": "Max servers to return (default 10)"
                    },
                    "order": {
                        "type": "string",
                        "enum": ["gainers", "losers"],
                        "description": "Rank by highest growth (gainers) or largest decline (losers). Default gainers."
                    }
                },
                "required": ["from", "to"]
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let from = require_str(&args, "from")?;
        let to = require_str(&args, "to")?;
        let limit = args
            .get("limit")
            .and_then(|v| v.as_u64())
            .unwrap_or(DEFAULT_RANK_LIMIT as u64) as u32;
        let limit = limit.clamp(1, MAX_RANK_LIMIT);
        let order = match args.get("order").and_then(|v| v.as_str()) {
            Some("losers") => mc_api_types::GrowthRankOrder::Losers,
            _ => mc_api_types::GrowthRankOrder::Gainers,
        };
        let response = deps
            .insights
            .rank_servers_by_growth(from, to, limit, order)
            .await?;
        Ok(compact_servers_growth_rank(response))
    }
}

pub struct RankServersByAllTimePeakTool;

#[async_trait]
impl ChatTool for RankServersByAllTimePeakTool {
    fn name(&self) -> &'static str {
        "rank_servers_by_all_time_peak"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "rank_servers_by_all_time_peak",
            "Find which tracked server(s) have the highest all-time player peak. Returns every server tied at the top.",
            json!({
                "type": "object",
                "properties": {}
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        _args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let response = deps.tracker.list_servers().await;
        Ok(compact_servers_all_time_peak(&response.servers))
    }
}

pub struct TotalTimeseriesSummaryTool;

#[async_trait]
impl ChatTool for TotalTimeseriesSummaryTool {
    fn name(&self) -> &'static str {
        "get_total_timeseries_summary"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "get_total_timeseries_summary",
            "Network-wide player count trend summary. Use relative from/to like 7d and now.",
            json!({
                "type": "object",
                "properties": {
                    "from": { "type": "string", "description": "Start bound, e.g. 7d" },
                    "to": { "type": "string", "description": "End bound, e.g. now" }
                },
                "required": ["from", "to"]
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let from = require_str(&args, "from")?;
        let to = require_str(&args, "to")?;
        let summary = deps.insights.total_timeseries_summary(from, to).await?;
        Ok(compact_timeseries_summary(&summary))
    }
}

pub struct ListAsnsTool;

#[async_trait]
impl ChatTool for ListAsnsTool {
    fn name(&self) -> &'static str {
        "list_asns"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "list_asns",
            "List hosting ASN networks sorted by players online.",
            json!({
                "type": "object",
                "properties": {}
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        _args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let mut response = deps.tracker.list_asns().await;
        let truncated = truncate(&mut response.asns, LIST_CAP);
        Ok(compact_asns_list(response, truncated))
    }
}

pub struct AsnTimeseriesSummaryTool;

#[async_trait]
impl ChatTool for AsnTimeseriesSummaryTool {
    fn name(&self) -> &'static str {
        "get_asn_timeseries_summary"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "get_asn_timeseries_summary",
            "Player count trend summary for an ASN. Use relative from/to like 7d and now.",
            json!({
                "type": "object",
                "properties": {
                    "asn": { "type": "string" },
                    "asn_org": { "type": "string" },
                    "from": { "type": "string", "description": "Start bound, e.g. 7d" },
                    "to": { "type": "string", "description": "End bound, e.g. now" }
                },
                "required": ["asn", "from", "to"]
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let asn = require_str(&args, "asn")?;
        let asn_org = args.get("asn_org").and_then(|v| v.as_str()).unwrap_or("");
        let from = require_str(&args, "from")?;
        let to = require_str(&args, "to")?;
        let summary = deps
            .insights
            .asn_timeseries_summary(asn, asn_org, from, to)
            .await?;
        Ok(compact_asn_timeseries_summary(summary))
    }
}

pub struct CompareServersTool;

#[async_trait]
impl ChatTool for CompareServersTool {
    fn name(&self) -> &'static str {
        "compare_servers"
    }

    fn definition(&self) -> serde_json::Value {
        tool_def(
            "compare_servers",
            "Compare player count trends for 2–5 servers. Pass server_ids for a specific set, or server_id/query + peer_count to compare one server against the current top peers.",
            json!({
                "type": "object",
                "properties": {
                    "server_ids": {
                        "type": "array",
                        "items": { "type": "string" },
                        "description": "Specific server UUIDs to compare (2–5)"
                    },
                    "server_id": { "type": "string", "description": "Base server UUID" },
                    "query": { "type": "string", "description": "Base server name when UUID unknown" },
                    "peer_count": {
                        "type": "integer",
                        "description": "With server_id/query: how many top servers to compare against (default 4)"
                    },
                    "from": { "type": "string", "description": "Start bound, e.g. 7d" },
                    "to": { "type": "string", "description": "End bound, e.g. now" }
                },
                "required": ["from", "to"]
            }),
        )
    }

    async fn execute(
        &self,
        deps: &ChatToolDeps,
        args: serde_json::Value,
    ) -> Result<serde_json::Value, ChatError> {
        let from = require_str(&args, "from")?;
        let to = require_str(&args, "to")?;

        let ids = if let Some(ids_raw) = args.get("server_ids").and_then(|v| v.as_array()) {
            ids_raw
                .iter()
                .take(MAX_COMPARE_SERVERS)
                .map(|v| parse_uuid(Some(v)))
                .collect::<Result<Vec<_>, _>>()?
        } else {
            let base_id = resolve_server_id(deps, &args).await?;
            let peer_count = args.get("peer_count").and_then(|v| v.as_u64()).unwrap_or(4) as usize;
            let list = deps.tracker.list_servers().await;
            compare_peer_ids(base_id, &list.servers, peer_count)
        };

        if ids.len() < 2 {
            return Err(ChatError::Tool("need at least 2 servers to compare".into()));
        }

        let mut rows = Vec::with_capacity(ids.len());
        let mut errors = Vec::new();
        for id in ids {
            match deps.insights.server_timeseries_summary(id, from, to).await {
                Ok(summary) => {
                    rows.push((summary.id.clone(), summary.name.clone(), summary.summary))
                }
                Err(err) => errors.push((id.to_string(), err.to_string())),
            }
        }

        Ok(compact_compare_servers(rows, errors))
    }
}

fn compare_peer_ids(
    base_id: Uuid,
    servers: &[mc_api_types::ServerListItemResponse],
    peer_count: usize,
) -> Vec<Uuid> {
    let max_peers = peer_count.min(MAX_COMPARE_SERVERS.saturating_sub(1));
    let mut ids = vec![base_id];
    for server in servers {
        if ids.len() > max_peers {
            break;
        }
        if let Ok(id) = Uuid::parse_str(&server.id) {
            if id != base_id {
                ids.push(id);
            }
        }
    }
    ids.truncate(MAX_COMPARE_SERVERS);
    ids
}

fn truncate<T>(items: &mut Vec<T>, cap: usize) -> bool {
    let truncated = items.len() > cap;
    if truncated {
        items.truncate(cap);
    }
    truncated
}

async fn resolve_server_id(
    deps: &ChatToolDeps,
    args: &serde_json::Value,
) -> Result<Uuid, ChatError> {
    if let Some(id) = args.get("server_id").and_then(|v| v.as_str()) {
        return Uuid::parse_str(id).map_err(|_| ChatError::Tool("invalid server_id".into()));
    }
    let query = args
        .get("query")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ChatError::Tool("server_id or query required".into()))?;
    let results = deps.tracker.search_servers(Some(query), 1).await;
    let server = results
        .servers
        .first()
        .ok_or_else(|| ChatError::Tool("server not found".into()))?;
    Uuid::parse_str(&server.id).map_err(|_| ChatError::Tool("invalid server_id".into()))
}

async fn compact_asn_query(
    deps: &ChatToolDeps,
    query: &str,
) -> Result<serde_json::Value, ChatError> {
    let response = deps.tracker.search_asns(query, SEARCH_CAP).await;
    let no_networks = response.matching_networks.asns.is_empty();
    let no_org_servers = response.servers_with_asn_org.servers.is_empty();
    if no_networks && no_org_servers {
        let servers = deps.tracker.search_servers(Some(query), 1).await;
        if !servers.servers.is_empty() {
            return Err(ChatError::Tool(
                "no ASN/network match; use get_server for this query".into(),
            ));
        }
    }
    if response.matching_networks.asns.len() == 1 {
        let item = &response.matching_networks.asns[0];
        if let Some(detail) = deps.tracker.asn_detail(&item.asn, &item.asn_org).await {
            let mut value = compact_asn_search(&response);
            if let serde_json::Value::Object(ref mut map) = value {
                map.insert("network".into(), compact_asn_detail(detail));
            }
            return Ok(value);
        }
    }
    Ok(compact_asn_search(&response))
}

fn parse_uuid(value: Option<&serde_json::Value>) -> Result<Uuid, ChatError> {
    let text = value
        .and_then(|v| v.as_str())
        .ok_or_else(|| ChatError::Tool("server_id required".into()))?;
    Uuid::parse_str(text).map_err(|_| ChatError::Tool("invalid server_id".into()))
}

fn require_str<'a>(args: &'a serde_json::Value, key: &str) -> Result<&'a str, ChatError> {
    args.get(key)
        .and_then(|v| v.as_str())
        .ok_or_else(|| ChatError::Tool(format!("{key} required")))
}
