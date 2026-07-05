use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};
use std::pin::Pin;

use async_trait::async_trait;
use futures::{Stream, StreamExt};
use reqwest::Client;
use serde_json::json;

use crate::config::{AgentConfig, LlmProvider};
use crate::error::ChatError;
use crate::llm::types::{
    ChatCompletionChunk, ChatCompletionRequest, ChatCompletionResponse, ToolChoice,
};
use crate::traits::LlmClient;

pub struct OpenAiLlmClient {
    client: Client,
}

impl Default for OpenAiLlmClient {
    fn default() -> Self {
        Self::new()
    }
}

impl OpenAiLlmClient {
    pub fn new() -> Self {
        Self {
            client: Client::new(),
        }
    }

    fn url(config: &AgentConfig) -> String {
        format!("{}/v1/chat/completions", config.base_url())
    }

    fn build_body(config: &AgentConfig, request: &ChatCompletionRequest) -> serde_json::Value {
        let mut body = json!({
            "model": request.model,
            "messages": request.messages,
            "stream": request.stream,
        });
        if let Some(max_tokens) = request.options.max_tokens {
            body["max_tokens"] = json!(max_tokens);
        }
        if request.options.parse_tool_calls {
            body["parse_tool_calls"] = json!(true);
        }
        if let Some(tools) = &request.tools {
            body["tools"] = json!(tools);
            if let Some(choice) = &request.tool_choice {
                body["tool_choice"] = match choice {
                    ToolChoice::Auto => json!("auto"),
                    ToolChoice::Required => json!("required"),
                };
            }
        }
        if request.stream {
            body["stream_options"] = json!({ "include_usage": true });
        }

        apply_thinking(config, &mut body);

        match config.provider {
            LlmProvider::OpenRouter => {
                if config.llm_models.len() > 1 {
                    body["models"] = json!(config.llm_models);
                }
                if automatic_cache_control(&request.model) {
                    body["cache_control"] = json!({ "type": "ephemeral" });
                }
                if let Some(session_id) = &request.options.session_id {
                    body["session_id"] = json!(session_id);
                }
                if let Some(user_id) = &request.options.end_user_id {
                    body["user"] = json!(user_id);
                }
                if request.tools.is_some() {
                    body["provider"] = json!({ "require_parameters": true });
                }
            }
            LlmProvider::LlamaCpp => {
                body["cache_prompt"] = json!(true);
                if let Some(session_id) = &request.options.session_id {
                    if config.parallel_slots > 0 {
                        body["id_slot"] =
                            json!(slot_for_session(session_id, config.parallel_slots));
                    }
                }
            }
            LlmProvider::OpenAiCompatible => {}
        }

        body
    }

    fn apply_openrouter_headers(
        config: &AgentConfig,
        mut req: reqwest::RequestBuilder,
    ) -> reqwest::RequestBuilder {
        let origin = config.www_origin.trim();
        if !origin.is_empty() {
            req = req.header("HTTP-Referer", origin);
        }
        req.header("X-OpenRouter-Title", "mc-tracker")
    }

    fn apply_auth(
        config: &AgentConfig,
        mut req: reqwest::RequestBuilder,
    ) -> reqwest::RequestBuilder {
        if let Some(key) = config.api_key() {
            req = req.bearer_auth(key);
        }
        req
    }

    async fn send_sync(
        &self,
        config: &AgentConfig,
        request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, ChatError> {
        let body = Self::build_body(config, &request);
        let req = self
            .client
            .post(Self::url(config))
            .timeout(config.timeout)
            .json(&body);
        let req = Self::apply_auth(config, req);
        let req = if config.provider == LlmProvider::OpenRouter {
            Self::apply_openrouter_headers(config, req)
        } else {
            req
        };
        let response = req
            .send()
            .await
            .map_err(|err| ChatError::Llm(err.to_string()))?;
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ChatError::Llm(format!("{status}: {text}")));
        }
        response
            .json::<ChatCompletionResponse>()
            .await
            .map_err(|err| ChatError::Llm(err.to_string()))
    }
}

fn slot_for_session(session_id: &str, parallel_slots: u32) -> i32 {
    let mut hasher = DefaultHasher::new();
    session_id.hash(&mut hasher);
    (hasher.finish() % parallel_slots as u64) as i32
}

/// OpenRouter automatic caching via top-level `cache_control` is Anthropic-only.
fn automatic_cache_control(model: &str) -> bool {
    let model = model.strip_prefix('~').unwrap_or(model);
    model.starts_with("anthropic/")
}

fn apply_thinking(config: &AgentConfig, body: &mut serde_json::Value) {
    match config.provider {
        LlmProvider::OpenRouter => {
            body["reasoning"] = if config.thinking_enabled {
                json!({ "enabled": true })
            } else {
                json!({ "effort": "none" })
            };
        }
        LlmProvider::LlamaCpp => {
            body["chat_template_kwargs"] = json!({
                "enable_thinking": config.thinking_enabled
            });
        }
        LlmProvider::OpenAiCompatible => {}
    }
}

#[async_trait]
impl LlmClient for OpenAiLlmClient {
    fn provider(&self, config: &AgentConfig) -> LlmProvider {
        config.provider
    }

    async fn chat_completion(
        &self,
        config: &AgentConfig,
        request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, ChatError> {
        self.send_sync(config, request).await
    }

    async fn chat_completion_stream(
        &self,
        config: &AgentConfig,
        request: ChatCompletionRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<ChatCompletionChunk, ChatError>> + Send>>, ChatError>
    {
        let body = Self::build_body(config, &request);
        let req = self
            .client
            .post(Self::url(config))
            .timeout(config.timeout)
            .json(&body);
        let req = Self::apply_auth(config, req);
        let req = if config.provider == LlmProvider::OpenRouter {
            Self::apply_openrouter_headers(config, req)
        } else {
            req
        };
        let response = req
            .send()
            .await
            .map_err(|err| ChatError::Llm(err.to_string()))?;
        if !response.status().is_success() {
            let status = response.status();
            let text = response.text().await.unwrap_or_default();
            return Err(ChatError::Llm(format!("{status}: {text}")));
        }
        let byte_stream = response.bytes_stream();
        let parsed = byte_stream
            .map(|chunk| chunk.map_err(|err| ChatError::Llm(err.to_string())))
            .scan(SseBuffer::default(), |buf, item| {
                futures::future::ready(match item {
                    Ok(bytes) => {
                        let events = buf.push(&bytes);
                        Some(Ok(events))
                    }
                    Err(err) => Some(Err(err)),
                })
            })
            .map(|result| {
                let items: Vec<Result<ChatCompletionChunk, ChatError>> = match result {
                    Ok(events) => events.into_iter().map(Ok).collect(),
                    Err(err) => vec![Err(err)],
                };
                futures::stream::iter(items)
            })
            .flatten();
        Ok(Box::pin(parsed))
    }
}

#[derive(Default)]
struct SseBuffer {
    pending: String,
}

impl SseBuffer {
    fn push(&mut self, bytes: &[u8]) -> Vec<ChatCompletionChunk> {
        self.pending.push_str(&String::from_utf8_lossy(bytes));
        let mut out = Vec::new();
        while let Some(pos) = self.pending.find("\n\n") {
            let frame = self.pending.drain(..pos + 2).collect::<String>();
            if let Some(chunk) = parse_sse_frame(&frame) {
                out.push(chunk);
            }
        }
        out
    }
}

fn parse_sse_frame(frame: &str) -> Option<ChatCompletionChunk> {
    let line = frame.lines().find(|line| line.starts_with("data: "))?;
    let data = line.strip_prefix("data: ")?.trim();
    if data == "[DONE]" {
        return None;
    }
    serde_json::from_str(data).ok()
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use super::*;
    use crate::llm::types::LlmRequestOptions;

    fn test_config(provider: LlmProvider, base_url: &str) -> AgentConfig {
        AgentConfig {
            llm_base_url: base_url.into(),
            llm_models: vec!["test".into()],
            max_tool_rounds: 8,
            context_max_turns: 10,
            tool_max_tokens: 1024,
            final_max_tokens: 2048,
            context_max: 16384,
            context_reserve: 2048,
            timeout: Duration::from_secs(1),
            provider,
            parallel_slots: 2,
            api_key: None,
            www_origin: String::new(),
            thinking_enabled: true,
        }
    }

    #[test]
    fn streaming_request_requests_usage_chunk() {
        let config = test_config(LlmProvider::LlamaCpp, "http://localhost");
        let body = OpenAiLlmClient::build_body(
            &config,
            &ChatCompletionRequest {
                model: "test".into(),
                messages: vec![],
                tools: None,
                tool_choice: None,
                stream: true,
                options: LlmRequestOptions::default(),
            },
        );
        assert_eq!(body["stream_options"]["include_usage"], true);
    }

    #[test]
    fn openrouter_request_includes_models_fallback_list() {
        let mut config = test_config(LlmProvider::OpenRouter, "https://openrouter.ai/api");
        config.llm_models = vec![
            "openrouter/free".into(),
            "deepseek/deepseek-v4-flash".into(),
        ];
        let body = OpenAiLlmClient::build_body(
            &config,
            &ChatCompletionRequest {
                model: "openrouter/free".into(),
                messages: vec![],
                tools: None,
                tool_choice: None,
                stream: false,
                options: LlmRequestOptions::default(),
            },
        );
        assert_eq!(body["model"], "openrouter/free");
        assert_eq!(
            body["models"],
            json!(["openrouter/free", "deepseek/deepseek-v4-flash"])
        );
    }

    #[test]
    fn openrouter_anthropic_request_includes_cache_control() {
        let config = test_config(LlmProvider::OpenRouter, "https://openrouter.ai/api");
        let body = OpenAiLlmClient::build_body(
            &config,
            &ChatCompletionRequest {
                model: "anthropic/claude-sonnet-4".into(),
                messages: vec![],
                tools: None,
                tool_choice: None,
                stream: false,
                options: LlmRequestOptions {
                    session_id: Some("session-abc".into()),
                    ..Default::default()
                },
            },
        );
        assert_eq!(body["cache_control"]["type"], "ephemeral");
        assert_eq!(body["session_id"], "session-abc");
        assert!(body.get("cache_prompt").is_none());
    }

    #[test]
    fn llama_request_includes_cache_prompt_and_slot() {
        let config = test_config(LlmProvider::LlamaCpp, "http://localhost:8080");
        let body = OpenAiLlmClient::build_body(
            &config,
            &ChatCompletionRequest {
                model: "default".into(),
                messages: vec![],
                tools: None,
                tool_choice: None,
                stream: false,
                options: LlmRequestOptions {
                    session_id: Some("session-abc".into()),
                    ..Default::default()
                },
            },
        );
        assert_eq!(body["cache_prompt"], true);
        assert!(body["id_slot"].is_number());
        assert!(body.get("cache_control").is_none());
    }

    #[test]
    fn openrouter_request_includes_user_and_provider_require_parameters() {
        let config = test_config(LlmProvider::OpenRouter, "https://openrouter.ai/api");
        let body = OpenAiLlmClient::build_body(
            &config,
            &ChatCompletionRequest {
                model: "openrouter/free".into(),
                messages: vec![],
                tools: Some(vec![]),
                tool_choice: None,
                stream: false,
                options: LlmRequestOptions {
                    end_user_id: Some("user-123".into()),
                    ..Default::default()
                },
            },
        );
        assert_eq!(body["user"], "user-123");
        assert_eq!(body["provider"]["require_parameters"], true);
    }

    #[test]
    fn openrouter_thinking_disabled_sends_effort_none() {
        let mut config = test_config(LlmProvider::OpenRouter, "https://openrouter.ai/api");
        config.thinking_enabled = false;
        let body = OpenAiLlmClient::build_body(
            &config,
            &ChatCompletionRequest {
                model: "openrouter/free".into(),
                messages: vec![],
                tools: None,
                tool_choice: None,
                stream: false,
                options: LlmRequestOptions::default(),
            },
        );
        assert_eq!(body["reasoning"]["effort"], "none");
    }

    #[test]
    fn llama_thinking_enabled_sets_template_kwargs() {
        let mut config = test_config(LlmProvider::LlamaCpp, "http://localhost:8080");
        config.thinking_enabled = true;
        let body = OpenAiLlmClient::build_body(
            &config,
            &ChatCompletionRequest {
                model: "default".into(),
                messages: vec![],
                tools: None,
                tool_choice: None,
                stream: false,
                options: LlmRequestOptions::default(),
            },
        );
        assert_eq!(body["chat_template_kwargs"]["enable_thinking"], true);
    }

    #[test]
    fn openrouter_headers_include_referer_and_title() {
        let mut config = test_config(LlmProvider::OpenRouter, "https://openrouter.ai/api");
        config.www_origin = "https://tracker.example.com".into();
        let req = OpenAiLlmClient::apply_openrouter_headers(
            &config,
            Client::new().post("https://openrouter.ai/api/v1/chat/completions"),
        );
        let built = req.build().unwrap();
        assert_eq!(
            built.headers().get("HTTP-Referer").unwrap(),
            "https://tracker.example.com"
        );
        assert_eq!(
            built.headers().get("X-OpenRouter-Title").unwrap(),
            "mc-tracker"
        );
    }
}
