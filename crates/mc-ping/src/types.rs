use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Ping {
    pub timestamp: i64,
    pub ip: String,
    pub players: Players,
    pub motd: Option<Motd>,
    pub version: Option<ServerVersion>,
    pub favicon: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Players {
    pub online: u32,
    pub max: Option<u32>,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct Motd {
    pub raw: String,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ServerVersion {
    pub name: String,
    pub protocol: Option<u32>,
}
