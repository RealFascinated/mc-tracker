use std::collections::{HashMap, HashSet};

use futures::future::join_all;
use mc_api_types::ChatToolCallRecord;

use crate::error::ChatError;
use crate::llm::types::{ChatMessage, MessageRole, ToolCall, ToolDefinition};
use crate::tools::ToolRegistry;
use crate::traits::ChatToolDeps;
use tokio::sync::mpsc;

use mc_api_types::ChatStreamEvent;

#[allow(clippy::too_many_arguments)]
pub async fn execute_tool_calls(
    calls: &[ToolCall],
    messages: &mut Vec<ChatMessage>,
    tools: &ToolRegistry,
    tool_defs: &[ToolDefinition],
    deps: &ChatToolDeps,
    tx: &mpsc::Sender<Result<ChatStreamEvent, ChatError>>,
    tool_trace: &mut Vec<ChatToolCallRecord>,
    assistant: ChatMessage,
) -> Result<(), ChatError> {
    messages.push(assistant);

    struct PreparedCall {
        call: ToolCall,
        key: String,
        name: String,
        args: serde_json::Value,
    }

    let mut prepared = Vec::with_capacity(calls.len());
    for call in calls {
        let name = call.function.name.clone();
        let args: serde_json::Value =
            serde_json::from_str(&call.function.arguments).unwrap_or(serde_json::json!({}));
        validate_tool_args(tool_defs, &name, &args)?;
        prepared.push(PreparedCall {
            key: tool_call_dedupe_key(&name, &args),
            name,
            args,
            call: call.clone(),
        });
    }

    let mut unique_keys = Vec::new();
    let mut seen_keys = HashSet::new();
    for item in &prepared {
        if seen_keys.insert(item.key.clone()) {
            unique_keys.push(item.key.clone());
        }
    }

    let tools_registry = tools.clone();
    let deps_base = ChatToolDeps {
        tracker: deps.tracker.clone(),
        insights: deps.insights.clone(),
    };
    let futures = unique_keys.iter().map(|key| {
        let item = prepared
            .iter()
            .find(|p| p.key == *key)
            .expect("unique key must exist in prepared calls");
        let name = item.name.clone();
        let args = item.args.clone();
        let key = key.clone();
        let tools = tools_registry.clone();
        let deps = ChatToolDeps {
            tracker: deps_base.tracker.clone(),
            insights: deps_base.insights.clone(),
        };
        async move {
            let result = tools.execute(&name, args, &deps).await;
            Ok::<_, ChatError>((key, name, result))
        }
    });

    let mut contents = HashMap::new();
    for result in join_all(futures).await {
        let (key, _name, tool_result) = result?;
        let content = match tool_result {
            Ok(value) => serde_json::to_string(&value).unwrap_or_else(|_| value.to_string()),
            Err(err) => serde_json::json!({ "error": err.to_string() }).to_string(),
        };
        contents.insert(key, content);
    }

    let mut emitted_ui = HashSet::new();
    for item in prepared {
        let content = contents
            .get(&item.key)
            .cloned()
            .unwrap_or_else(|| serde_json::json!({ "error": "missing tool result" }).to_string());
        if emitted_ui.insert(item.key) {
            let _ = tx
                .send(Ok(ChatStreamEvent::ToolStart {
                    name: item.name.clone(),
                }))
                .await;
            tool_trace.push(ChatToolCallRecord {
                name: item.name.clone(),
            });
            let _ = tx
                .send(Ok(ChatStreamEvent::ToolDone {
                    name: item.name.clone(),
                }))
                .await;
        }
        messages.push(ChatMessage {
            role: MessageRole::Tool,
            content: Some(content),
            tool_calls: None,
            tool_call_id: Some(item.call.id),
        });
    }
    Ok(())
}

fn tool_call_dedupe_key(name: &str, args: &serde_json::Value) -> String {
    format!(
        "{name}:{}",
        serde_json::to_string(args).unwrap_or_else(|_| "{}".to_string())
    )
}

fn validate_tool_args(
    defs: &[ToolDefinition],
    name: &str,
    args: &serde_json::Value,
) -> Result<(), ChatError> {
    let Some(def) = defs.iter().find(|d| d.function.name == name) else {
        return Ok(());
    };
    let schema = jsonschema::validator_for(&def.function.parameters)
        .map_err(|err| ChatError::Tool(format!("invalid tool schema for {name}: {err}")))?;
    schema
        .validate(args)
        .map_err(|err| ChatError::Tool(format!("invalid arguments for {name}: {err}")))?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::types::{ToolDefinition, ToolFunctionSchema};

    #[test]
    fn validate_tool_args_rejects_bad_schema() {
        let defs = vec![ToolDefinition {
            tool_type: "function".into(),
            function: ToolFunctionSchema {
                name: "get_server".into(),
                description: "test".into(),
                parameters: serde_json::json!({
                    "type": "object",
                    "properties": {
                        "query": { "type": "string" }
                    },
                    "required": ["query"]
                }),
            },
        }];
        let err = validate_tool_args(&defs, "get_server", &serde_json::json!({})).unwrap_err();
        assert!(err.to_string().contains("invalid arguments"));
    }

    #[test]
    fn tool_call_dedupe_key_normalizes_json() {
        let a = tool_call_dedupe_key("get_asn", &serde_json::json!({ "query": "DonutSMP" }));
        let b = tool_call_dedupe_key(
            "get_asn",
            &serde_json::from_str(r#"{"query":"DonutSMP"}"#).unwrap(),
        );
        assert_eq!(a, b);
    }

    #[test]
    fn tool_call_dedupe_key_differs_by_name_or_args() {
        let a = tool_call_dedupe_key("get_asn", &serde_json::json!({ "query": "a" }));
        let b = tool_call_dedupe_key("get_asn", &serde_json::json!({ "query": "b" }));
        let c = tool_call_dedupe_key("get_server", &serde_json::json!({ "query": "a" }));
        assert_ne!(a, b);
        assert_ne!(a, c);
    }
}
