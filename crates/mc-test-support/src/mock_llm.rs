//! Scripted `LlmClient` for integration and agent tests.

use std::pin::Pin;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;

use async_trait::async_trait;
use futures::Stream;
use mc_chat::config::{AgentConfig, LlmProvider};
use mc_chat::error::ChatError;
use mc_chat::llm::types::{
    ChatCompletionChunk, ChatCompletionChunkChoice, ChatCompletionDelta, ChatCompletionRequest,
    ChatCompletionResponse, ChatMessage, FinishReason,
};
use mc_chat::traits::LlmClient;

#[derive(Debug, Clone)]
pub struct MockLlmScript {
    pub stream_chunks: Vec<Vec<ChatCompletionChunk>>,
    pub completion: Option<ChatCompletionResponse>,
}

impl Default for MockLlmScript {
    fn default() -> Self {
        Self {
            stream_chunks: vec![vec![text_chunk("Hello", Some(FinishReason::Stop))]],
            completion: None,
        }
    }
}

pub struct MockLlmClient {
    script: MockLlmScript,
    stream_calls: AtomicUsize,
}

impl MockLlmClient {
    pub fn new(script: MockLlmScript) -> Arc<Self> {
        Arc::new(Self {
            script,
            stream_calls: AtomicUsize::new(0),
        })
    }

    pub fn stream_call_count(&self) -> usize {
        self.stream_calls.load(Ordering::SeqCst)
    }
}

#[async_trait]
impl LlmClient for MockLlmClient {
    fn provider(&self, _config: &AgentConfig) -> LlmProvider {
        LlmProvider::OpenAiCompatible
    }

    async fn count_tokens(
        &self,
        _config: &AgentConfig,
        _model: &str,
        text: &str,
    ) -> Result<u32, ChatError> {
        Ok((text.len() / 3).max(1) as u32)
    }

    async fn count_messages_tokens(
        &self,
        config: &AgentConfig,
        model: &str,
        messages: &[ChatMessage],
    ) -> Result<u32, ChatError> {
        let mut total = 0u32;
        for message in messages {
            if let Some(content) = &message.content {
                total += self.count_tokens(config, model, content).await?;
            }
        }
        Ok(total)
    }

    async fn chat_completion(
        &self,
        _config: &AgentConfig,
        _request: ChatCompletionRequest,
    ) -> Result<ChatCompletionResponse, ChatError> {
        self.script
            .completion
            .clone()
            .ok_or_else(|| ChatError::Llm("no mock completion configured".into()))
    }

    async fn chat_completion_stream(
        &self,
        _config: &AgentConfig,
        _request: ChatCompletionRequest,
    ) -> Result<Pin<Box<dyn Stream<Item = Result<ChatCompletionChunk, ChatError>> + Send>>, ChatError>
    {
        let idx = self.stream_calls.fetch_add(1, Ordering::SeqCst);
        let chunks = self
            .script
            .stream_chunks
            .get(idx)
            .cloned()
            .unwrap_or_default();
        Ok(Box::pin(futures::stream::iter(chunks.into_iter().map(Ok))))
    }
}

pub fn text_chunk(content: &str, finish: Option<FinishReason>) -> ChatCompletionChunk {
    ChatCompletionChunk {
        choices: vec![ChatCompletionChunkChoice {
            delta: ChatCompletionDelta {
                content: Some(content.into()),
                ..Default::default()
            },
            finish_reason: finish,
        }],
        usage: None,
    }
}

pub fn length_finish_chunk() -> ChatCompletionChunk {
    ChatCompletionChunk {
        choices: vec![ChatCompletionChunkChoice {
            delta: ChatCompletionDelta::default(),
            finish_reason: Some(FinishReason::Length),
        }],
        usage: None,
    }
}
