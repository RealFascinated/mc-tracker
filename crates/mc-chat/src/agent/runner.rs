use std::collections::BTreeMap;
use std::sync::Arc;
use std::time::{Duration, Instant};

use futures::StreamExt;
use mc_api_types::{ChatStreamEvent, ChatToolCallRecord};
use tokio::sync::mpsc;
use tokio_util::sync::CancellationToken;

use crate::agent::context::ContextBuilder;
use crate::agent::stream::{finalize_stream_tool_calls, merge_stream_tool_calls};
use crate::agent::tools_exec::execute_tool_calls;
use crate::config::AgentConfig;
use crate::error::ChatError;
use crate::llm::turn_usage::TurnUsageAccumulator;
use crate::llm::types::{
    ChatCompletionRequest, ChatMessage, FinishReason, LlmRequestOptions, MessageRole, ToolCall,
    ToolChoice,
};
use crate::tools::ToolRegistry;
use crate::traits::{ChatToolDeps, LlmClient};
use crate::types::AgentChatRequest;

pub async fn run_unified_agent(
    llm: Arc<dyn LlmClient>,
    tools: ToolRegistry,
    deps: ChatToolDeps,
    config: AgentConfig,
    request: AgentChatRequest,
    tx: mpsc::Sender<Result<ChatStreamEvent, ChatError>>,
    cancel: CancellationToken,
) -> Result<(), ChatError> {
    validate_request(&request)?;
    let started = Instant::now();
    let session_id = session_id_for_llm(request.session_id.as_deref());
    let end_user_id = request.end_user_id.clone();
    let tool_defs = tools.definitions();
    let (mut messages, context_truncated) =
        ContextBuilder::build_prompt_messages(&config, &request);
    let mut tool_trace = Vec::new();
    let mut turn_usage = TurnUsageAccumulator::new(request.session_tokens_used);
    let mut recovery_used = false;

    tracing::info!(
        session_id = session_id.as_deref(),
        message_count = messages.len(),
        context_max = config.context_max,
        "chat turn started"
    );

    for round in 0..config.max_tool_rounds {
        if cancel.is_cancelled() {
            return Err(ChatError::Limit("cancelled".into()));
        }
        check_timeout(started, config.timeout)?;

        let (content, streamed, tool_calls, finish_reason) = stream_with_tools(
            llm.as_ref(),
            &config,
            &messages,
            &tool_defs,
            session_id.clone(),
            end_user_id.clone(),
            started,
            config.timeout,
            &tx,
            &mut turn_usage,
            &cancel,
        )
        .await?;

        emit_usage(&tx, &turn_usage, &config).await?;

        if let Some(calls) = tool_calls {
            let assistant = ChatMessage {
                role: MessageRole::Assistant,
                content: if content.is_empty() {
                    None
                } else {
                    Some(content.clone())
                },
                tool_calls: Some(calls.clone()),
                tool_call_id: None,
            };
            execute_tool_calls(
                &calls,
                &mut messages,
                &tools,
                &tool_defs,
                &deps,
                &tx,
                &mut tool_trace,
                assistant,
            )
            .await?;
            continue;
        }

        if let Some(text) = non_empty_text(content) {
            return emit_done(
                &tx,
                text,
                streamed,
                tool_trace,
                &turn_usage,
                context_truncated,
                finish_reason,
                &config,
                session_id.as_deref(),
            )
            .await;
        }

        if round + 1 >= config.max_tool_rounds {
            break;
        }

        if !recovery_used {
            recovery_used = true;
            if let Some(calls) = recovery_tool_calls(
                llm.as_ref(),
                &config,
                &messages,
                &tool_defs,
                session_id.clone(),
                end_user_id.clone(),
                &mut turn_usage,
            )
            .await?
            {
                emit_usage(&tx, &turn_usage, &config).await?;
                let assistant = ChatMessage {
                    role: MessageRole::Assistant,
                    content: None,
                    tool_calls: Some(calls.clone()),
                    tool_call_id: None,
                };
                execute_tool_calls(
                    &calls,
                    &mut messages,
                    &tools,
                    &tool_defs,
                    &deps,
                    &tx,
                    &mut tool_trace,
                    assistant,
                )
                .await?;
                continue;
            }
        }

        break;
    }

    Err(ChatError::Limit("agent cycle limit".into()))
}

#[allow(clippy::too_many_arguments)]
async fn stream_with_tools(
    llm: &dyn LlmClient,
    config: &AgentConfig,
    messages: &[ChatMessage],
    tool_defs: &[crate::llm::types::ToolDefinition],
    session_id: Option<String>,
    end_user_id: Option<String>,
    started: Instant,
    timeout: Duration,
    tx: &mpsc::Sender<Result<ChatStreamEvent, ChatError>>,
    turn_usage: &mut TurnUsageAccumulator,
    cancel: &CancellationToken,
) -> Result<(String, bool, Option<Vec<ToolCall>>, Option<FinishReason>), ChatError> {
    let mut stream = llm
        .chat_completion_stream(
            config,
            ChatCompletionRequest {
                model: config.primary_model().to_string(),
                messages: messages.to_vec(),
                tools: Some(tool_defs.to_vec()),
                tool_choice: Some(ToolChoice::Auto),
                stream: true,
                options: LlmRequestOptions {
                    session_id,
                    end_user_id,
                    max_tokens: Some(config.final_max_tokens),
                    parse_tool_calls: false,
                },
            },
        )
        .await?;

    let mut content = String::new();
    let mut reasoning = String::new();
    let mut tool_acc: BTreeMap<u32, crate::agent::stream::PartialStreamToolCall> = BTreeMap::new();
    let mut finish_reason = None;
    let mut streamed_content = false;
    let mut streamed_reasoning = false;

    while let Some(chunk) = stream.next().await {
        if cancel.is_cancelled() {
            return Err(ChatError::Limit("cancelled".into()));
        }
        check_timeout(started, timeout)?;
        let chunk = chunk?;
        turn_usage.merge_chunk(&chunk);
        for choice in chunk.choices {
            if let Some(reason) = choice.finish_reason {
                finish_reason = Some(reason);
            }
            if let Some(piece) = choice.delta.content.as_ref() {
                if !piece.is_empty() {
                    content.push_str(piece);
                    streamed_content = true;
                    let _ = tx
                        .send(Ok(ChatStreamEvent::Delta {
                            content: piece.clone(),
                        }))
                        .await;
                }
            }
            if let Some(piece) = reasoning_delta_piece(&choice.delta) {
                if config.thinking_enabled {
                    reasoning.push_str(&piece);
                    streamed_reasoning = true;
                    let _ = tx
                        .send(Ok(ChatStreamEvent::ReasoningDelta { content: piece }))
                        .await;
                }
            }
            if let Some(deltas) = choice.delta.tool_calls {
                merge_stream_tool_calls(&mut tool_acc, &deltas);
            }
        }
    }

    let tool_calls = finalize_stream_tool_calls(tool_acc);
    if tool_calls.is_some() {
        let streamed = streamed_content || streamed_reasoning;
        return Ok((content, streamed, tool_calls, finish_reason));
    }

    let text = if !content.trim().is_empty() {
        content
    } else {
        reasoning
    };
    let streamed = streamed_content || streamed_reasoning;
    Ok((text, streamed, None, finish_reason))
}

fn reasoning_delta_piece(delta: &crate::llm::types::ChatCompletionDelta) -> Option<String> {
    if let Some(piece) = &delta.reasoning {
        if !piece.is_empty() {
            return Some(piece.clone());
        }
    }
    if let Some(piece) = &delta.reasoning_content {
        if !piece.is_empty() {
            return Some(piece.clone());
        }
    }
    None
}

async fn recovery_tool_calls(
    llm: &dyn LlmClient,
    config: &AgentConfig,
    messages: &[ChatMessage],
    tool_defs: &[crate::llm::types::ToolDefinition],
    session_id: Option<String>,
    end_user_id: Option<String>,
    usage: &mut TurnUsageAccumulator,
) -> Result<Option<Vec<ToolCall>>, ChatError> {
    let response = llm
        .chat_completion(
            config,
            ChatCompletionRequest {
                model: config.primary_model().to_string(),
                messages: messages.to_vec(),
                tools: Some(tool_defs.to_vec()),
                tool_choice: Some(ToolChoice::Auto),
                stream: false,
                options: LlmRequestOptions {
                    session_id,
                    end_user_id,
                    max_tokens: Some(config.tool_max_tokens),
                    parse_tool_calls: true,
                },
            },
        )
        .await?;
    if let Some(round_usage) = response.usage {
        usage.merge_round(&round_usage);
    }
    let choice = response.choices.into_iter().next();
    let Some(choice) = choice else {
        return Ok(None);
    };
    Ok(choice.message.tool_calls.filter(|calls| !calls.is_empty()))
}

async fn emit_usage(
    tx: &mpsc::Sender<Result<ChatStreamEvent, ChatError>>,
    turn_usage: &TurnUsageAccumulator,
    config: &AgentConfig,
) -> Result<(), ChatError> {
    let _ = tx
        .send(Ok(ChatStreamEvent::Usage {
            usage: turn_usage.to_chat_token_usage(config),
        }))
        .await;
    Ok(())
}

#[allow(clippy::too_many_arguments)]
async fn emit_done(
    tx: &mpsc::Sender<Result<ChatStreamEvent, ChatError>>,
    assistant_content: String,
    content_already_streamed: bool,
    tool_trace: Vec<ChatToolCallRecord>,
    turn_usage: &TurnUsageAccumulator,
    context_truncated: bool,
    finish_reason: Option<FinishReason>,
    config: &AgentConfig,
    session_id: Option<&str>,
) -> Result<(), ChatError> {
    if !content_already_streamed {
        let _ = tx
            .send(Ok(ChatStreamEvent::Delta {
                content: assistant_content.clone(),
            }))
            .await;
    }

    let usage = turn_usage.to_chat_token_usage(config);
    log_context_usage(session_id, config.context_max, &usage);

    let truncated = context_truncated || finish_reason == Some(FinishReason::Length);

    let _ = tx
        .send(Ok(ChatStreamEvent::Done {
            tool_calls: tool_trace,
            usage: Some(usage),
            truncated,
            finish_reason: finish_reason.map(|r| r.as_str().to_string()),
            quota_used: None,
        }))
        .await;

    Ok(())
}

fn validate_request(request: &AgentChatRequest) -> Result<(), ChatError> {
    let message = request.message.trim();
    if message.is_empty() {
        return Err(ChatError::InvalidRequest("message is empty".into()));
    }
    if message.len() > 4000 {
        return Err(ChatError::InvalidRequest("message too long".into()));
    }
    Ok(())
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

fn non_empty_text(content: String) -> Option<String> {
    if content.trim().is_empty() {
        None
    } else {
        Some(content)
    }
}

fn check_timeout(started: Instant, timeout: Duration) -> Result<(), ChatError> {
    if started.elapsed() > timeout {
        return Err(ChatError::Limit("timeout".into()));
    }
    Ok(())
}

fn log_context_usage(
    session_id: Option<&str>,
    context_max: u32,
    usage: &mc_api_types::ChatTokenUsage,
) {
    let prompt = usage.prompt_tokens;
    let pct = if context_max > 0 {
        (f64::from(prompt) / f64::from(context_max)) * 100.0
    } else {
        0.0
    };
    tracing::info!(
        session_id,
        prompt_tokens = prompt,
        completion_tokens = usage.completion_tokens,
        turn_total_tokens = usage.turn_total_tokens,
        session_total_tokens = usage.session_total_tokens,
        cached_tokens = usage.cached_tokens,
        cache_write_tokens = usage.cache_write_tokens,
        reasoning_tokens = usage.reasoning_tokens,
        context_max,
        context_used_pct = format!("{pct:.1}%"),
        "chat context usage"
    );
}

#[cfg(test)]
mod tests {
    use std::pin::Pin;
    use std::sync::atomic::{AtomicUsize, Ordering};
    use std::sync::Arc;

    use async_trait::async_trait;
    use futures::Stream;
    use mc_api_types::{
        AsnDetailResponse, AsnSearchResponse, AsnTimeseriesSummaryResponse, AsnsGrowthRankResponse,
        AsnsListResponse, GrowthRankOrder, IpLookupResponse, ServerListItemResponse,
        ServerTimeseriesSummaryResponse, ServersCompareResponse, ServersGrowthRankResponse,
        ServersListResponse, ServersSearchResponse, ServersSummaryResponse,
        TimeseriesSummaryResponse,
    };
    use tokio::sync::mpsc;
    use uuid::Uuid;

    use super::*;
    use crate::config::{AgentConfig, LlmProvider};
    use crate::llm::types::{
        ChatCompletionChunk, ChatCompletionChunkChoice, ChatCompletionDelta, ChatCompletionRequest,
        ChatCompletionResponse,
    };
    use crate::tools::ToolRegistry;
    use crate::traits::{ChatToolDeps, InsightsRead, LlmClient, TrackerRead};

    struct StubTracker;

    #[async_trait]
    impl TrackerRead for StubTracker {
        async fn tracker_summary(&self) -> ServersSummaryResponse {
            panic!("unexpected tracker call")
        }
        async fn list_servers(&self, _search: Option<&str>) -> ServersListResponse {
            panic!("unexpected tracker call")
        }
        async fn search_servers(
            &self,
            _search: Option<&str>,
            _limit: u32,
        ) -> ServersSearchResponse {
            panic!("unexpected tracker call")
        }
        async fn server_detail(&self, _id: Uuid) -> Option<ServerListItemResponse> {
            panic!("unexpected tracker call")
        }
        async fn asn_detail(&self, _asn: &str, _asn_org: &str) -> Option<AsnDetailResponse> {
            panic!("unexpected tracker call")
        }
        async fn list_asns(&self, _search: Option<&str>) -> AsnsListResponse {
            panic!("unexpected tracker call")
        }
        async fn search_asns(&self, _query: &str, _limit: u32) -> AsnSearchResponse {
            panic!("unexpected tracker call")
        }
        async fn lookup_ip(&self, _query: &str) -> Result<IpLookupResponse, ChatError> {
            panic!("unexpected tracker call")
        }
    }

    struct StubInsights;

    #[async_trait]
    impl InsightsRead for StubInsights {
        async fn server_timeseries_summary(
            &self,
            _id: Uuid,
            _from: &str,
            _to: &str,
        ) -> Result<ServerTimeseriesSummaryResponse, mc_insights::InsightsError> {
            panic!("unexpected insights call")
        }
        async fn total_timeseries_summary(
            &self,
            _from: &str,
            _to: &str,
        ) -> Result<TimeseriesSummaryResponse, mc_insights::InsightsError> {
            panic!("unexpected insights call")
        }
        async fn asn_timeseries_summary(
            &self,
            _asn: &str,
            _asn_org: &str,
            _from: &str,
            _to: &str,
        ) -> Result<AsnTimeseriesSummaryResponse, mc_insights::InsightsError> {
            panic!("unexpected insights call")
        }
        async fn rank_servers_by_growth(
            &self,
            _from: &str,
            _to: &str,
            _limit: u32,
            _order: GrowthRankOrder,
        ) -> Result<ServersGrowthRankResponse, mc_insights::InsightsError> {
            panic!("unexpected insights call")
        }
        async fn rank_servers_by_period_peak(
            &self,
            _from: &str,
            _to: &str,
            _limit: u32,
        ) -> Result<mc_api_types::ServersPeriodPeakRankResponse, mc_insights::InsightsError>
        {
            panic!("unexpected insights call")
        }
        async fn rank_asns_by_growth(
            &self,
            _from: &str,
            _to: &str,
            _limit: u32,
            _order: GrowthRankOrder,
        ) -> Result<AsnsGrowthRankResponse, mc_insights::InsightsError> {
            panic!("unexpected insights call")
        }
        async fn compare_servers(
            &self,
            _ids: &[Uuid],
            _from: &str,
            _to: &str,
            _max_points: usize,
        ) -> Result<ServersCompareResponse, mc_insights::InsightsError> {
            panic!("unexpected insights call")
        }
    }

    struct ScriptLlm {
        streams: Vec<Vec<ChatCompletionChunk>>,
        calls: AtomicUsize,
    }

    #[async_trait]
    impl LlmClient for ScriptLlm {
        fn provider(&self, _config: &AgentConfig) -> LlmProvider {
            LlmProvider::OpenAiCompatible
        }

        async fn chat_completion(
            &self,
            _config: &AgentConfig,
            _request: ChatCompletionRequest,
        ) -> Result<ChatCompletionResponse, ChatError> {
            Err(ChatError::Llm("no mock completion".into()))
        }

        async fn chat_completion_stream(
            &self,
            _config: &AgentConfig,
            _request: ChatCompletionRequest,
        ) -> Result<
            Pin<Box<dyn Stream<Item = Result<ChatCompletionChunk, ChatError>> + Send>>,
            ChatError,
        > {
            let idx = self.calls.fetch_add(1, Ordering::SeqCst);
            let chunks = self.streams.get(idx).cloned().unwrap_or_default();
            Ok(Box::pin(futures::stream::iter(chunks.into_iter().map(Ok))))
        }
    }

    fn chunk(content: &str, finish: Option<FinishReason>) -> ChatCompletionChunk {
        ChatCompletionChunk {
            choices: vec![ChatCompletionChunkChoice {
                delta: ChatCompletionDelta {
                    content: Some(content.into()),
                    ..Default::default()
                },
                finish_reason: finish,
            }],
            usage: None,
            timings: None,
        }
    }

    fn test_config() -> AgentConfig {
        AgentConfig {
            llm_base_url: "http://localhost".into(),
            llm_models: vec!["test".into()],
            max_tool_rounds: 4,
            context_max_turns: 10,
            tool_max_tokens: 256,
            final_max_tokens: 256,
            context_max: 4096,
            context_reserve: 512,
            timeout: Duration::from_secs(30),
            provider: LlmProvider::OpenAiCompatible,
            parallel_slots: 1,
            api_key: None,
            www_origin: String::new(),
            thinking_enabled: true,
        }
    }

    fn test_deps() -> ChatToolDeps {
        ChatToolDeps {
            tracker: Arc::new(StubTracker),
            insights: Arc::new(StubInsights),
        }
    }

    async fn collect_events(
        rx: &mut mpsc::Receiver<Result<ChatStreamEvent, ChatError>>,
    ) -> Vec<ChatStreamEvent> {
        let mut events = Vec::new();
        while let Some(result) = rx.recv().await {
            match result {
                Ok(event) => events.push(event),
                Err(_) => break,
            }
        }
        events
    }

    #[tokio::test]
    async fn stream_text_emits_done() {
        let llm = Arc::new(ScriptLlm {
            streams: vec![vec![chunk("Hello", Some(FinishReason::Stop))]],
            calls: AtomicUsize::new(0),
        });
        let (tx, mut rx) = mpsc::channel(16);
        let request = AgentChatRequest {
            message: "hi".into(),
            session_id: None,
            end_user_id: None,
            history: vec![],
            context_server: None,
            session_tokens_used: 0,
            last_turn_prompt_tokens: None,
        };
        run_unified_agent(
            llm,
            ToolRegistry::default_tools(),
            test_deps(),
            test_config(),
            request,
            tx,
            CancellationToken::new(),
        )
        .await
        .unwrap();

        let events = collect_events(&mut rx).await;
        assert!(events
            .iter()
            .any(|e| matches!(e, ChatStreamEvent::Delta { .. })));
        let done = events
            .iter()
            .find_map(|e| match e {
                ChatStreamEvent::Done { truncated, .. } => Some(*truncated),
                _ => None,
            })
            .expect("done event");
        assert!(!done);
        assert!(events
            .iter()
            .any(|e| matches!(e, ChatStreamEvent::Usage { .. })));
    }

    #[tokio::test]
    async fn length_finish_sets_truncated() {
        let llm = Arc::new(ScriptLlm {
            streams: vec![vec![
                chunk("partial", None),
                ChatCompletionChunk {
                    choices: vec![ChatCompletionChunkChoice {
                        delta: ChatCompletionDelta::default(),
                        finish_reason: Some(FinishReason::Length),
                    }],
                    usage: None,
                    timings: None,
                },
            ]],
            calls: AtomicUsize::new(0),
        });
        let (tx, mut rx) = mpsc::channel(16);
        let request = AgentChatRequest {
            message: "hi".into(),
            session_id: None,
            end_user_id: None,
            history: vec![],
            context_server: None,
            session_tokens_used: 0,
            last_turn_prompt_tokens: None,
        };
        run_unified_agent(
            llm,
            ToolRegistry::default_tools(),
            test_deps(),
            test_config(),
            request,
            tx,
            CancellationToken::new(),
        )
        .await
        .unwrap();

        let events = collect_events(&mut rx).await;
        let truncated = events
            .iter()
            .find_map(|e| match e {
                ChatStreamEvent::Done { truncated, .. } => Some(*truncated),
                _ => None,
            })
            .expect("done");
        assert!(truncated);
    }

    #[tokio::test]
    async fn cancelled_before_run_emits_no_done() {
        let llm = Arc::new(ScriptLlm {
            streams: vec![vec![chunk("nope", Some(FinishReason::Stop))]],
            calls: AtomicUsize::new(0),
        });
        let (tx, mut rx) = mpsc::channel(16);
        let cancel = CancellationToken::new();
        cancel.cancel();
        let request = AgentChatRequest {
            message: "hi".into(),
            session_id: None,
            end_user_id: None,
            history: vec![],
            context_server: None,
            session_tokens_used: 0,
            last_turn_prompt_tokens: None,
        };
        let result = run_unified_agent(
            llm,
            ToolRegistry::default_tools(),
            test_deps(),
            test_config(),
            request,
            tx,
            cancel,
        )
        .await;
        assert!(matches!(result, Err(ChatError::Limit(_))));

        let events = collect_events(&mut rx).await;
        assert!(!events
            .iter()
            .any(|e| matches!(e, ChatStreamEvent::Done { .. })));
    }
}
