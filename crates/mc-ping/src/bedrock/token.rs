use crate::error::PingError;
use crate::types::{Motd, Ping, Players, ServerVersion};

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct BedrockToken {
    pub edition: String,
    pub motd_line1: String,
    pub protocol: u32,
    pub version_name: String,
    pub players_online: u32,
    pub players_max: u32,
    pub server_guid: String,
    pub motd_line2: String,
}

/// Parse the semicolon-delimited pong token.
pub fn parse_token(token: &str) -> Result<BedrockToken, PingError> {
    let fields: Vec<&str> = token.split(';').collect();
    if fields.len() < 8 {
        return Err(PingError::Protocol(format!(
            "bedrock token too short ({} fields, need at least 8)",
            fields.len()
        )));
    }

    Ok(BedrockToken {
        edition: fields[0].to_string(),
        motd_line1: fields[1].to_string(),
        protocol: parse_u32(fields[2], "protocol")?,
        version_name: fields[3].to_string(),
        players_online: parse_u32(fields[4], "players.online")?,
        players_max: parse_u32(fields[5], "players.max")?,
        server_guid: fields[6].to_string(),
        motd_line2: fields[7].to_string(),
    })
}

pub fn ping_from_token(token: &BedrockToken, ip: &str, timestamp_ms: i64) -> Ping {
    Ping {
        timestamp: timestamp_ms,
        ip: ip.to_string(),
        players: Players {
            online: token.players_online,
            max: Some(token.players_max),
        },
        motd: Some(Motd {
            raw: format!("{}\n{}", token.motd_line1, token.motd_line2),
        }),
        version: Some(ServerVersion {
            name: token.version_name.clone(),
            protocol: Some(token.protocol),
        }),
    }
}

fn parse_u32(value: &str, field: &str) -> Result<u32, PingError> {
    value
        .parse::<u32>()
        .map_err(|_| PingError::Protocol(format!("invalid bedrock token field {field}: {value}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    const SAMPLE: &str =
        "MCPE;Dedicated Server;589;1.20.81;42;100;1234567890;Second Line;Survival;1;";

    #[test]
    fn parse_sample_token_fields() {
        let token = parse_token(SAMPLE).unwrap();
        assert_eq!(token.edition, "MCPE");
        assert_eq!(token.players_online, 42);
        assert_eq!(token.players_max, 100);
        assert_eq!(token.version_name, "1.20.81");
        assert_eq!(token.protocol, 589);
    }

    #[test]
    fn ping_from_token_populates_struct() {
        let token = parse_token(SAMPLE).unwrap();
        let ping = ping_from_token(&token, "198.51.100.2", 1);
        assert_eq!(ping.players.online, 42);
        assert_eq!(ping.players.max, Some(100));
        assert_eq!(
            ping.motd.as_ref().unwrap().raw,
            "Dedicated Server\nSecond Line"
        );
        assert_eq!(ping.version.as_ref().unwrap().name, "1.20.81");
    }

    #[test]
    fn short_token_errors() {
        let err = parse_token("MCPE;only;two").unwrap_err();
        assert!(matches!(err, PingError::Protocol(_)));
    }

    #[test]
    fn invalid_player_count_errors() {
        let err = parse_token("MCPE;Name;1;1.0;not-a-number;10;1;Line2;").unwrap_err();
        assert!(matches!(err, PingError::Protocol(_)));
    }
}
