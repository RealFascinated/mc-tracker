use std::pin::Pin;
use std::time::Duration;

use async_trait::async_trait;
use futures::{Stream, StreamExt};
use reqwest::Client;
use serde_json::json;

use crate::error::ChatError;
use crate::llm::types::{
    ChatCompletionChunk, ChatCompletionRequest, ChatCompletionResponse, ToolChoice,
};
use crate::traits::LlmClient;

pub struct OpenAiLlmClient {
    client: Client,
    base_url: String,
    api_key: Option<String>,
    timeout: Duration,
}

impl OpenAiLlmClient {
    pub fn new(base_url: impl Into<String>, api_key: Option<String>, timeout: Duration) -> Self {
        Self {
            client: Client::new(),
            base_url: base_url.into().trim_end_matches('/').to_string(),
            api_key,
            timeout,
        }
    }

    fn url(&self) -> String {
        format!("{}/v1/chat/completions", self.base_url)
    }

    fn build_body(&self, request: &ChatCompletionRequest) -> serde_json::Value {
        let mut body = json!({
            "model": request.model,
            "messages": request.messages,
            "stream": request.stream,
            "cache_prompt": request.options.cache_prompt,
        });
        if let Some(max_tokens) = request.options.max_tokens {
            body["max_tokens"] = json!(max_tokens);
        }
        if let Some(slot) = request.options.id_slot {
            body["id_slot"] = json!(slot);
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
        body
    }

    async fn send_sync(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, ChatError> {
        let body = self.build_body(&request);
        let mut req = self
            .client
            .post(self.url())
            .timeout(self.timeout)
            .json(&body);
        if let Some(key) = &self.api_key {
            req = req.bearer_auth(key);
        }
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

#[async_trait]
impl LlmClient for OpenAiLlmClient {
    async fn chat_completion(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, ChatError> {
        self.send_sync(request).await
    }

    async fn chat_completion_stream(
        &self,
        request: ChatCompletionRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<ChatCompletionChunk, ChatError>> + Send>>, ChatError>
    {
        let body = self.build_body(&request);
        let mut req = self
            .client
            .post(self.url())
            .timeout(self.timeout)
            .json(&body);
        if let Some(key) = &self.api_key {
            req = req.bearer_auth(key);
        }
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
    use super::*;
    use crate::llm::types::LlmRequestOptions;

    #[test]
    fn streaming_request_requests_usage_chunk() {
        let client = OpenAiLlmClient::new("http://localhost", None, Duration::from_secs(1));
        let body = client.build_body(&ChatCompletionRequest {
            model: "test".into(),
            messages: vec![],
            tools: None,
            tool_choice: None,
            stream: true,
            options: LlmRequestOptions::default(),
        });
        assert_eq!(body["stream_options"]["include_usage"], true);
    }

    #[test]
    fn non_streaming_request_omits_stream_options() {
        let client = OpenAiLlmClient::new("http://localhost", None, Duration::from_secs(1));
        let body = client.build_body(&ChatCompletionRequest {
            model: "test".into(),
            messages: vec![],
            tools: None,
            tool_choice: None,
            stream: false,
            options: LlmRequestOptions::default(),
        });
        assert!(body.get("stream_options").is_none());
    }
}
