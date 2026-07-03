use std::pin::Pin;
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures::{Stream, StreamExt};
use mc_api_types::{ChatStreamEvent, ChatToolCallRecord};
use tokio::sync::mpsc;
use tokio_stream::wrappers::ReceiverStream;

use crate::error::ChatError;
use crate::llm::types::{
    ChatCompletionRequest, ChatCompletionResponse, ChatMessage, CompletionUsage,
    LlmRequestOptions, ToolChoice, ToolDefinition,
};
use crate::prompt::SYSTEM_PROMPT;
use crate::tools::ToolRegistry;
use crate::traits::{ChatToolDeps, LlmClient};
use crate::types::{AgentChatRequest, ChatAgent};

const MAX_TOOL_ROUNDS: usize = 8;
/// Maximum number of user turns to retain in raw_history. Oldest turns are
/// dropped as whole conversation blocks so the cached prefix stays stable.
const MAX_TURNS: usize = 10;
const TOOL_MAX_TOKENS: u32 = 1024;
const FINAL_MAX_TOKENS: u32 = 1024;
const TOOL_PARSE_RETRIES: usize = 3;

pub struct AgentLoop {
    llm: Arc<dyn LlmClient>,
    tools: ToolRegistry,
    deps: ChatToolDeps,
    model: String,
    timeout: Duration,
    context_max: u32,
}

impl AgentLoop {
    pub fn new(
        llm: Arc<dyn LlmClient>,
        tools: ToolRegistry,
        deps: ChatToolDeps,
        model: String,
        timeout: Duration,
        context_max: u32,
    ) -> Self {
        Self {
            llm,
            tools,
            deps,
            model,
            timeout,
            context_max,
        }
    }
}

impl ChatAgent for AgentLoop {
    fn chat_stream(
        &self,
        request: AgentChatRequest,
    ) -> Pin<Box<dyn Stream<Item = Result<ChatStreamEvent, ChatError>> + Send>> {
        let llm = Arc::clone(&self.llm);
        let tools = self.tools.clone_registry();
        let deps = ChatToolDeps {
            tracker: Arc::clone(&self.deps.tracker),
            insights: Arc::clone(&self.deps.insights),
        };
        let model = self.model.clone();
        let timeout = self.timeout;
        let context_max = self.context_max;
        let (tx, rx) = mpsc::channel(64);
        tokio::spawn(async move {
            let result = run_agent(
                llm,
                tools,
                deps,
                model,
                timeout,
                context_max,
                request,
                tx.clone(),
            )
            .await;
            if let Err(err) = result {
                let _ = tx.send(Err(err)).await;
            }
            drop(tx);
        });
        Box::pin(ReceiverStream::new(rx))
    }
}

#[allow(clippy::too_many_arguments)]
async fn run_agent(
    llm: Arc<dyn LlmClient>,
    tools: ToolRegistry,
    deps: ChatToolDeps,
    model: String,
    timeout: Duration,
    context_max: u32,
    request: AgentChatRequest,
    tx: mpsc::Sender<Result<ChatStreamEvent, ChatError>>,
) -> Result<(), ChatError> {
    validate_request(&request)?;
    let started = Instant::now();
    let session_id = session_id_for_llm(request.session_id.as_deref());
    let mut messages = build_messages(&request);
    let tool_defs = tool_definitions(&tools);
    let mut tool_trace = Vec::new();
    let mut usage = CompletionUsage::default();

    tracing::info!(
        session_id = session_id.as_deref(),
        message_count = messages.len(),
        context_max,
        "chat turn started"
    );

    for _ in 0..MAX_TOOL_ROUNDS {
        check_timeout(started, timeout)?;
        let response = tool_round_completion(
            llm.as_ref(),
            &model,
            &messages,
            &tool_defs,
            session_id.clone(),
        )
        .await?;
        if let Some(round_usage) = response.usage {
            round_usage.merge_into(&mut usage);
        }

        let choice = response
            .choices
            .into_iter()
            .next()
            .ok_or_else(|| ChatError::Llm("empty completion".into()))?;
        let assistant = choice.message;
        if let Some(calls) = assistant.tool_calls.clone() {
            if calls.is_empty() {
                break;
            }
            messages.push(assistant.clone());
            for call in calls {
                let name = call.function.name.clone();
                let _ = tx
                    .send(Ok(ChatStreamEvent::ToolStart { name: name.clone() }))
                    .await;
                let args: serde_json::Value =
                    serde_json::from_str(&call.function.arguments).unwrap_or(serde_json::json!({}));
                let result = tools.execute(&name, args, &deps).await;
                let content = match result {
                    Ok(value) => {
                        serde_json::to_string(&value).unwrap_or_else(|_| value.to_string())
                    }
                    Err(err) => json_error(&err),
                };
                tool_trace.push(ChatToolCallRecord { name: name.clone() });
                let _ = tx.send(Ok(ChatStreamEvent::ToolDone { name })).await;
                messages.push(ChatMessage {
                    role: "tool".into(),
                    content: Some(content),
                    tool_calls: None,
                    tool_call_id: Some(call.id),
                });
            }
            continue;
        }
        break;
    }

    check_timeout(started, timeout)?;

    let mut history_snapshot: Vec<serde_json::Value> = messages
        .iter()
        .filter_map(|m| serde_json::to_value(m).ok())
        .collect();

    let mut stream = llm
        .chat_completion_stream(ChatCompletionRequest {
            model,
            messages,
            tools: None,
            tool_choice: None,
            stream: true,
            options: LlmRequestOptions {
                session_id: session_id.clone(),
                max_tokens: Some(FINAL_MAX_TOKENS),
                parse_tool_calls: false,
            },
        })
        .await?;

    let mut assistant_content = String::new();
    while let Some(chunk) = stream.next().await {
        check_timeout(started, timeout)?;
        let chunk = chunk?;
        if let Some(chunk_usage) = chunk.usage {
            chunk_usage.merge_into(&mut usage);
        }
        for choice in chunk.choices {
            if let Some(content) = choice.delta.content {
                if !content.is_empty() {
                    assistant_content.push_str(&content);
                    let _ = tx.send(Ok(ChatStreamEvent::Delta { content })).await;
                }
            }
        }
    }

    if let Ok(assistant) = serde_json::to_value(ChatMessage {
        role: "assistant".into(),
        content: Some(assistant_content),
        tool_calls: None,
        tool_call_id: None,
    }) {
        history_snapshot.push(assistant);
    }

    log_context_usage(session_id.as_deref(), context_max, &usage);

    let cache_details = usage.prompt_tokens_details;
    let _ = tx
        .send(Ok(ChatStreamEvent::Done {
            tool_calls: tool_trace,
            usage: Some(mc_api_types::ChatTokenUsage {
                prompt_tokens: usage.prompt_tokens,
                completion_tokens: usage.completion_tokens,
                context_max,
                cached_tokens: cache_details.map(|d| d.cached_tokens),
                cache_write_tokens: cache_details.map(|d| d.cache_write_tokens),
            }),
            raw_history: Some(history_snapshot),
        }))
        .await;
    Ok(())
}

/// Parse opaque history echoed from the previous turn. Invalid entries are dropped
/// with a warning instead of discarding the entire history.
pub fn parse_raw_history(values: Vec<serde_json::Value>) -> Option<Vec<ChatMessage>> {
    if values.is_empty() {
        return None;
    }

    let mut messages = Vec::with_capacity(values.len());
    for (index, value) in values.into_iter().enumerate() {
        match serde_json::from_value::<ChatMessage>(value) {
            Ok(message) => messages.push(message),
            Err(err) => {
                tracing::warn!(
                    index,
                    error = %err,
                    "dropping invalid raw_history message"
                );
            }
        }
    }

    if messages.is_empty() {
        tracing::warn!("raw_history contained no valid messages");
        None
    } else {
        Some(messages)
    }
}

fn validate_request(request: &AgentChatRequest) -> Result<(), ChatError> {
    let message = request.message.trim();
    if message.is_empty() {
        return Err(ChatError::InvalidRequest("message is empty".into()));
    }
    if message.len() > 4000 {
        return Err(ChatError::InvalidRequest("message too long".into()));
    }
    if let Some(rh) = &request.raw_history {
        if rh.len() > 500 {
            return Err(ChatError::InvalidRequest("raw_history too long".into()));
        }
    }
    Ok(())
}

/// Drop oldest complete turns (user message + all following messages until the next
/// user message) until the number of user turns is within `max_turns`. Assumes
/// messages[0] is the system prompt.
fn truncate_history_turns(messages: &mut Vec<ChatMessage>, max_turns: usize) {
    loop {
        let user_indices: Vec<usize> = messages
            .iter()
            .enumerate()
            .skip(1)
            .filter(|(_, m)| m.role == "user")
            .map(|(i, _)| i)
            .collect();

        if user_indices.len() <= max_turns {
            break;
        }

        // Drop oldest turn: from user_indices[0] up to (not including) user_indices[1]
        let drop_from = user_indices[0];
        let drop_to = user_indices[1];
        messages.drain(drop_from..drop_to);
    }
}

fn user_message_content(request: &AgentChatRequest) -> String {
    let Some(ctx) = &request.context_server else {
        return request.message.clone();
    };
    format!(
        "[Viewing server: {} ({}). Use this server_id for get_server or compare_servers — do not call list_servers or search_servers for this server.]\n\n{}",
        ctx.server_name, ctx.server_id, request.message
    )
}

fn push_user_message(messages: &mut Vec<ChatMessage>, request: &AgentChatRequest) {
    messages.push(ChatMessage {
        role: "user".into(),
        content: Some(user_message_content(request)),
        tool_calls: None,
        tool_call_id: None,
    });
}

fn initial_messages() -> Vec<ChatMessage> {
    vec![ChatMessage {
        role: "system".into(),
        content: Some(SYSTEM_PROMPT.into()),
        tool_calls: None,
        tool_call_id: None,
    }]
}

fn build_messages(request: &AgentChatRequest) -> Vec<ChatMessage> {
    let mut messages = match &request.raw_history {
        Some(raw) if !raw.is_empty() => {
            let mut history = raw.clone();
            truncate_history_turns(&mut history, MAX_TURNS);
            history
        }
        _ => initial_messages(),
    };
    push_user_message(&mut messages, request);
    messages
}

fn tool_definitions(tools: &ToolRegistry) -> Vec<ToolDefinition> {
    tools
        .definitions()
        .into_iter()
        .filter_map(|value| serde_json::from_value(value).ok())
        .collect()
}

async fn tool_round_completion(
    llm: &dyn LlmClient,
    model: &str,
    messages: &[ChatMessage],
    tool_defs: &[ToolDefinition],
    session_id: Option<String>,
) -> Result<ChatCompletionResponse, ChatError> {
    let mut last_err = None;
    for attempt in 0..TOOL_PARSE_RETRIES {
        let max_tokens = TOOL_MAX_TOKENS.saturating_mul(attempt as u32 + 1);
        match llm
            .chat_completion(ChatCompletionRequest {
                model: model.to_string(),
                messages: messages.to_vec(),
                tools: Some(tool_defs.to_vec()),
                tool_choice: Some(ToolChoice::Auto),
                stream: false,
                options: LlmRequestOptions {
                    session_id: session_id.clone(),
                    max_tokens: Some(max_tokens),
                    parse_tool_calls: true,
                },
            })
            .await
        {
            Ok(response) => return Ok(response),
            Err(err) if is_tool_parse_error(&err) && attempt + 1 < TOOL_PARSE_RETRIES => {
                last_err = Some(err);
            }
            Err(err) => return Err(err),
        }
    }
    Err(last_err.unwrap_or_else(|| ChatError::Llm("tool call parse failed".into())))
}

fn is_tool_parse_error(err: &ChatError) -> bool {
    let ChatError::Llm(message) = err else {
        return false;
    };
    let lower = message.to_ascii_lowercase();
    lower.contains("parse tool call")
        || lower.contains("parse_error")
        || lower.contains("syntax error while parsing value")
}

const MAX_SESSION_ID_LEN: usize = 256;

fn session_id_for_llm(session_id: Option<&str>) -> Option<String> {
    let id = session_id?.trim();
    if id.is_empty() {
        return None;
    }
    Some(if id.len() <= MAX_SESSION_ID_LEN {
        id.to_string()
    } else {
        id[..MAX_SESSION_ID_LEN].to_string()
    })
}

fn log_context_usage(
    session_id: Option<&str>,
    context_max: u32,
    usage: &CompletionUsage,
) {
    let prompt = usage.prompt_tokens;
    let pct = if context_max > 0 {
        (f64::from(prompt) / f64::from(context_max)) * 100.0
    } else {
        0.0
    };
    let (cached_tokens, cache_write_tokens) = usage
        .prompt_tokens_details
        .map(|d| (d.cached_tokens, d.cache_write_tokens))
        .unwrap_or((0, 0));

    tracing::info!(
        session_id,
        prompt_tokens = prompt,
        completion_tokens = usage.completion_tokens,
        context_max,
        context_used_pct = format!("{pct:.1}%"),
        cached_tokens,
        cache_write_tokens,
        "chat context usage"
    );
}

fn check_timeout(started: Instant, timeout: Duration) -> Result<(), ChatError> {
    if started.elapsed() > timeout {
        return Err(ChatError::Limit("timeout".into()));
    }
    Ok(())
}

fn json_error(err: &ChatError) -> String {
    serde_json::json!({ "error": err.to_string() }).to_string()
}

#[cfg(test)]
mod tests {
    use std::sync::{Arc, Mutex};

    use async_trait::async_trait;
    use futures::StreamExt;
    use mc_api_types::{
        PlayersPeakSummary, ServersListResponse, ServersSearchResponse, ServersSummaryResponse,
    };
    use uuid::Uuid;

    use super::*;
    use crate::llm::types::{
        ChatCompletionChoice, ChatCompletionChunk, ChatCompletionChunkChoice, ChatCompletionDelta,
        ChatCompletionResponse,
    };
    use crate::traits::{InsightsRead, TrackerRead};

    struct MockLlm {
        stream_requests: Mutex<Vec<ChatCompletionRequest>>,
    }

    #[async_trait]
    impl LlmClient for MockLlm {
        async fn chat_completion(
            &self,
            request: ChatCompletionRequest,
        ) -> Result<ChatCompletionResponse, ChatError> {
            assert!(request.tools.is_some());
            Ok(ChatCompletionResponse {
                choices: vec![ChatCompletionChoice {
                    message: ChatMessage {
                        role: "assistant".into(),
                        content: Some("ok".into()),
                        tool_calls: None,
                        tool_call_id: None,
                    },
                }],
                usage: None,
            })
        }

        async fn chat_completion_stream(
            &self,
            request: ChatCompletionRequest,
        ) -> Result<
            Pin<Box<dyn Stream<Item = Result<ChatCompletionChunk, ChatError>> + Send>>,
            ChatError,
        > {
            self.stream_requests.lock().unwrap().push(request);
            let chunks = vec![
                ChatCompletionChunk {
                    choices: vec![ChatCompletionChunkChoice {
                        delta: ChatCompletionDelta {
                            content: Some("Hello".into()),
                        },
                    }],
                    usage: None,
                },
                ChatCompletionChunk {
                    choices: vec![ChatCompletionChunkChoice {
                        delta: ChatCompletionDelta {
                            content: Some(" world".into()),
                        },
                    }],
                    usage: None,
                },
            ];
            Ok(Box::pin(futures::stream::iter(
                chunks.into_iter().map(Ok::<_, ChatError>),
            )))
        }
    }

    struct MockTracker;

    #[async_trait]
    impl TrackerRead for MockTracker {
        async fn list_servers(&self) -> ServersListResponse {
            ServersListResponse {
                summary: ServersSummaryResponse {
                    total_players: 0,
                    players_pc: 0,
                    players_pe: 0,
                    tracked_servers: 0,
                    peaks: PlayersPeakSummary {
                        players_24h: None,
                        players_7d: None,
                    },
                },
                servers: vec![],
            }
        }

        async fn search_servers(&self, _: Option<&str>, _: u32) -> ServersSearchResponse {
            ServersSearchResponse { servers: vec![] }
        }

        async fn server_detail(&self, _: Uuid) -> Option<mc_api_types::ServerListItemResponse> {
            None
        }

        async fn asn_detail(&self, _: &str, _: &str) -> Option<mc_api_types::AsnDetailResponse> {
            None
        }

        async fn list_asns(&self) -> mc_api_types::AsnsListResponse {
            mc_api_types::AsnsListResponse {
                summary: mc_api_types::AsnsSummaryResponse {
                    total_players: 0,
                    players_pc: 0,
                    players_pe: 0,
                    tracked_asns: 0,
                    tracked_servers: 0,
                    peaks: PlayersPeakSummary {
                        players_24h: None,
                        players_7d: None,
                    },
                },
                asns: vec![],
            }
        }

        async fn search_asns(&self, _: &str, _: u32) -> mc_api_types::AsnSearchResponse {
            mc_api_types::AsnSearchResponse {
                query: String::new(),
                matching_networks: mc_api_types::AsnsListResponse {
                    summary: mc_api_types::AsnsSummaryResponse {
                        total_players: 0,
                        players_pc: 0,
                        players_pe: 0,
                        tracked_asns: 0,
                        tracked_servers: 0,
                        peaks: PlayersPeakSummary {
                            players_24h: None,
                            players_7d: None,
                        },
                    },
                    asns: vec![],
                },
                networks_truncated: false,
                servers_with_asn_org: ServersListResponse {
                    summary: ServersSummaryResponse {
                        total_players: 0,
                        players_pc: 0,
                        players_pe: 0,
                        tracked_servers: 0,
                        peaks: PlayersPeakSummary {
                            players_24h: None,
                            players_7d: None,
                        },
                    },
                    servers: vec![],
                },
                org_servers_truncated: false,
            }
        }
    }

    struct MockInsights;

    #[async_trait]
    impl InsightsRead for MockInsights {
        async fn server_timeseries_summary(
            &self,
            _: Uuid,
            _: &str,
            _: &str,
        ) -> Result<mc_api_types::ServerTimeseriesSummaryResponse, mc_insights::InsightsError>
        {
            Err(mc_insights::InsightsError::NoData)
        }

        async fn total_timeseries_summary(
            &self,
            _: &str,
            _: &str,
        ) -> Result<mc_api_types::TimeseriesSummaryResponse, mc_insights::InsightsError> {
            Err(mc_insights::InsightsError::NoData)
        }

        async fn asn_timeseries_summary(
            &self,
            _: &str,
            _: &str,
            _: &str,
            _: &str,
        ) -> Result<mc_api_types::AsnTimeseriesSummaryResponse, mc_insights::InsightsError>
        {
            Err(mc_insights::InsightsError::NoData)
        }

        async fn rank_servers_by_growth(
            &self,
            _: &str,
            _: &str,
            _: u32,
            _: mc_api_types::GrowthRankOrder,
        ) -> Result<mc_api_types::ServersGrowthRankResponse, mc_insights::InsightsError> {
            Err(mc_insights::InsightsError::NoData)
        }

        async fn rank_servers_by_period_peak(
            &self,
            _: &str,
            _: &str,
            _: u32,
        ) -> Result<mc_api_types::ServersPeriodPeakRankResponse, mc_insights::InsightsError> {
            Err(mc_insights::InsightsError::NoData)
        }
    }

    #[tokio::test]
    async fn agent_stream_emits_deltas_then_done() {
        let llm = Arc::new(MockLlm {
            stream_requests: Mutex::new(Vec::new()),
        });
        let agent = AgentLoop::new(
            llm.clone(),
            ToolRegistry::default_tools(),
            ChatToolDeps {
                tracker: Arc::new(MockTracker),
                insights: Arc::new(MockInsights),
            },
            "test-model".into(),
            Duration::from_secs(60),
            16_384,
        );

        let mut stream = agent.chat_stream(AgentChatRequest {
            message: "hi".into(),
            session_id: Some("session-1".into()),
            raw_history: None,
            context_server: None,
        });

        let mut events = Vec::new();
        while let Some(item) = stream.next().await {
            events.push(item.unwrap());
        }

        assert_eq!(events.len(), 3);
        assert!(matches!(events[0], ChatStreamEvent::Delta { ref content } if content == "Hello"));
        assert!(matches!(events[1], ChatStreamEvent::Delta { ref content } if content == " world"));
        assert!(matches!(events[2], ChatStreamEvent::Done { .. }));

        let final_request = llm.stream_requests.lock().unwrap().pop().unwrap();
        assert!(final_request.tools.is_none());
        assert_eq!(
            final_request.options.session_id.as_deref(),
            Some("session-1")
        );
    }

    #[test]
    fn session_id_for_llm_truncates_long_values() {
        let long = "x".repeat(300);
        let trimmed = session_id_for_llm(Some(&long)).unwrap();
        assert_eq!(trimmed.len(), 256);
    }

    #[test]
    fn parse_raw_history_keeps_valid_messages_when_one_entry_is_invalid() {
        let values = vec![
            serde_json::json!({"role": "system", "content": "prompt"}),
            serde_json::json!({"role": "user", "content": "hi"}),
            serde_json::json!({"role": "assistant", "content": 123}),
        ];
        let parsed = parse_raw_history(values).expect("partial history");
        assert_eq!(parsed.len(), 2);
        assert_eq!(parsed[0].role, "system");
        assert_eq!(parsed[1].role, "user");
    }

    #[test]
    fn build_messages_extends_restored_history_with_new_user_turn() {
        let history = vec![
            ChatMessage {
                role: "system".into(),
                content: Some("prompt".into()),
                tool_calls: None,
                tool_call_id: None,
            },
            ChatMessage {
                role: "user".into(),
                content: Some("first".into()),
                tool_calls: None,
                tool_call_id: None,
            },
            ChatMessage {
                role: "assistant".into(),
                content: Some("reply".into()),
                tool_calls: None,
                tool_call_id: None,
            },
        ];
        let messages = build_messages(&AgentChatRequest {
            message: "second".into(),
            session_id: None,
            raw_history: Some(history),
            context_server: None,
        });
        assert_eq!(messages.len(), 4);
        assert_eq!(messages[3].content.as_deref(), Some("second"));
    }
}
