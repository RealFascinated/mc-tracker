use serde::Deserialize;
use serde_json::Value;

use crate::types::{Motd, Players, ServerVersion};

#[derive(Debug, Deserialize)]
pub struct JavaServerStatusToken {
    pub version: Option<JavaVersionToken>,
    pub players: Option<PlayersToken>,
    pub description: Option<Value>,
}

#[derive(Debug, Deserialize)]
pub struct JavaVersionToken {
    pub name: String,
    pub protocol: i32,
}

#[derive(Debug, Deserialize)]
pub struct PlayersToken {
    pub online: i32,
    pub max: Option<i32>,
}

pub fn parse_status_json(json: &str) -> Result<JavaServerStatusToken, serde_json::Error> {
    serde_json::from_str(json)
}

pub fn motd_from_description(description: &Value) -> String {
    match description {
        Value::String(text) => text.clone(),
        Value::Object(obj) => {
            let mut parts = Vec::new();
            if let Some(text) = obj.get("text").and_then(Value::as_str) {
                parts.push(text.to_string());
            }
            if let Some(extra) = obj.get("extra").and_then(Value::as_array) {
                for item in extra {
                    parts.push(motd_from_description(item));
                }
            }
            parts.join("")
        }
        _ => String::new(),
    }
}

pub fn players_from_token(token: &JavaServerStatusToken) -> Players {
    let online = token
        .players
        .as_ref()
        .map(|p| p.online.max(0) as u32)
        .unwrap_or(0);
    let max = token
        .players
        .as_ref()
        .and_then(|p| p.max)
        .map(|m| m.max(0) as u32);
    Players { online, max }
}

pub fn motd_from_token(token: &JavaServerStatusToken) -> Option<Motd> {
    token.description.as_ref().map(|desc| Motd {
        raw: motd_from_description(desc),
    })
}

pub fn version_from_token(token: &JavaServerStatusToken) -> Option<ServerVersion> {
    token.version.as_ref().map(|v| ServerVersion {
        name: v.name.clone(),
        protocol: Some(v.protocol.max(0) as u32),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_plain_status() {
        let json = include_str!("../../tests/fixtures/java/status-plain.json");
        let token = parse_status_json(json).unwrap();
        let players = players_from_token(&token);
        assert_eq!(players.online, 42);
        assert_eq!(players.max, Some(100));
        let motd = motd_from_token(&token).unwrap();
        assert_eq!(motd.raw, "A Minecraft Server");
        let version = version_from_token(&token).unwrap();
        assert_eq!(version.name, "1.21.4");
        assert_eq!(version.protocol, Some(769));
    }

    #[test]
    fn parse_chat_component_motd() {
        let json = include_str!("../../tests/fixtures/java/status-chat.json");
        let token = parse_status_json(json).unwrap();
        let motd = motd_from_token(&token).unwrap();
        assert_eq!(motd.raw, "Hello World");
    }
}
