use std::collections::BTreeMap;

use crate::llm::types::{StreamToolCallDelta, ToolCall};

#[derive(Debug, Default)]
pub(crate) struct PartialStreamToolCall {
    id: Option<String>,
    call_type: Option<String>,
    name: Option<String>,
    arguments: String,
}

pub fn merge_stream_tool_calls(
    acc: &mut BTreeMap<u32, PartialStreamToolCall>,
    deltas: &[StreamToolCallDelta],
) {
    for delta in deltas {
        let index = delta.index.unwrap_or(0);
        let entry = acc.entry(index).or_default();
        if let Some(id) = &delta.id {
            entry.id = Some(id.clone());
        }
        if let Some(call_type) = &delta.call_type {
            entry.call_type = Some(call_type.clone());
        }
        if let Some(function) = &delta.function {
            if let Some(name) = &function.name {
                entry.name = Some(name.clone());
            }
            if let Some(arguments) = &function.arguments {
                entry.arguments.push_str(arguments);
            }
        }
    }
}

pub fn finalize_stream_tool_calls(
    acc: BTreeMap<u32, PartialStreamToolCall>,
) -> Option<Vec<ToolCall>> {
    if acc.is_empty() {
        return None;
    }
    let calls: Vec<ToolCall> = acc
        .into_iter()
        .filter_map(|(index, partial)| {
            let name = partial.name?;
            let id = partial.id.unwrap_or_else(|| format!("stream_call_{index}"));
            Some(ToolCall {
                id,
                call_type: partial.call_type.unwrap_or_else(|| "function".into()),
                function: crate::llm::types::ToolCallFunction {
                    name,
                    arguments: partial.arguments,
                },
            })
        })
        .collect();
    if calls.is_empty() {
        None
    } else {
        Some(calls)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::llm::types::StreamToolCallFunctionDelta;

    #[test]
    fn finalize_stream_tool_calls_merges_fragments() {
        let mut acc = BTreeMap::new();
        merge_stream_tool_calls(
            &mut acc,
            &[
                StreamToolCallDelta {
                    index: Some(0),
                    id: Some("call_1".into()),
                    call_type: Some("function".into()),
                    function: Some(StreamToolCallFunctionDelta {
                        name: Some("get_server".into()),
                        arguments: Some("{\"query\":".into()),
                    }),
                },
                StreamToolCallDelta {
                    index: Some(0),
                    function: Some(StreamToolCallFunctionDelta {
                        name: None,
                        arguments: Some("\"test\"}".into()),
                    }),
                    ..Default::default()
                },
            ],
        );
        let calls = finalize_stream_tool_calls(acc).expect("tool calls");
        assert_eq!(calls.len(), 1);
        assert_eq!(calls[0].function.name, "get_server");
        assert_eq!(calls[0].function.arguments, "{\"query\":\"test\"}");
    }
}
