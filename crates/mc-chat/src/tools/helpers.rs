use uuid::Uuid;

use crate::error::ChatError;
use crate::llm::types::{ToolDefinition, ToolFunctionSchema};
use crate::tools::compact::{compact_asn_detail, compact_asn_search};
use crate::tools::constants::{MAX_COMPARE_SERVERS, SEARCH_CAP};
use crate::traits::ChatToolDeps;

pub fn tool_def(name: &str, description: &str, parameters: serde_json::Value) -> serde_json::Value {
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

pub fn truncate<T>(items: &mut Vec<T>, cap: usize) -> bool {
    let truncated = items.len() > cap;
    if truncated {
        items.truncate(cap);
    }
    truncated
}

pub async fn resolve_server_id(
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

pub fn compare_peer_ids(
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

pub async fn compact_asn_query(
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

pub fn parse_uuid(value: Option<&serde_json::Value>) -> Result<Uuid, ChatError> {
    let text = value
        .and_then(|v| v.as_str())
        .ok_or_else(|| ChatError::Tool("server_id required".into()))?;
    Uuid::parse_str(text).map_err(|_| ChatError::Tool("invalid server_id".into()))
}

pub fn require_str<'a>(args: &'a serde_json::Value, key: &str) -> Result<&'a str, ChatError> {
    args.get(key)
        .and_then(|v| v.as_str())
        .ok_or_else(|| ChatError::Tool(format!("{key} required")))
}

pub fn optional_search(args: &serde_json::Value) -> Option<&str> {
    args.get("search")
        .or_else(|| args.get("query"))
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
}

pub async fn resolve_asn(
    deps: &ChatToolDeps,
    args: &serde_json::Value,
) -> Result<(String, String), ChatError> {
    if let Some(asn) = args.get("asn").and_then(|v| v.as_str()) {
        let asn_org = args.get("asn_org").and_then(|v| v.as_str()).unwrap_or("");
        return Ok((asn.to_string(), asn_org.to_string()));
    }
    let query = args
        .get("query")
        .and_then(|v| v.as_str())
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .ok_or_else(|| ChatError::Tool("asn or query required".into()))?;
    let response = deps.tracker.search_asns(query, 1).await;
    let item = response
        .matching_networks
        .asns
        .first()
        .ok_or_else(|| ChatError::Tool("asn not found".into()))?;
    Ok((item.asn.clone(), item.asn_org.clone()))
}
