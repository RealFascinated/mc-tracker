use crate::error::PingError;

pub const PACKET_ID: u8 = 0x1C;

const EDITIONS: &[&str] = &["MCPE", "MCEE"];

/// Strip the binary RakNet prefix by locating the edition name.
pub fn strip_edition_prefix(response: &str) -> Option<String> {
    for edition in EDITIONS {
        if let Some(start) = response.find(edition) {
            return Some(response[start..].to_string());
        }
    }
    None
}

/// Parse a raw unconnected pong datagram into the semicolon-delimited MOTD token.
pub fn parse_pong_datagram(data: &[u8]) -> Result<String, PingError> {
    if data.is_empty() {
        return Err(PingError::Protocol("empty bedrock pong datagram".into()));
    }
    if data[0] != PACKET_ID {
        return Err(PingError::Protocol(format!(
            "invalid bedrock pong packet id: 0x{:02X}",
            data[0]
        )));
    }

    let response = String::from_utf8_lossy(data).trim().to_string();
    strip_edition_prefix(&response).ok_or_else(|| {
        PingError::Protocol("bedrock pong missing edition prefix (MCPE/MCEE)".into())
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn sample_token() -> &'static str {
        "MCPE;Dedicated Server;589;1.20.81;42;100;1234567890;Second Line;Survival;1;"
    }

    #[test]
    fn parse_fixture_pong() {
        let data = include_bytes!("../../tests/fixtures/bedrock/pong-sample.bin");
        let token = parse_pong_datagram(data).unwrap();
        assert!(token.starts_with("MCPE;"));
        assert_eq!(token, sample_token());
    }

    #[test]
    fn strip_prefix_from_utf8_with_binary_leading_bytes() {
        let mut data = vec![0x1C, 0x00, 0xFF, 0xAA];
        data.extend_from_slice(sample_token().as_bytes());
        let token = parse_pong_datagram(&data).unwrap();
        assert_eq!(token, sample_token());
    }

    #[test]
    fn mcee_edition_detected() {
        let token = strip_edition_prefix("\x00\x01MCEE;School Server;1;1.0;5;20;1;Line2;")
            .unwrap();
        assert!(token.starts_with("MCEE;"));
    }

    #[test]
    fn invalid_packet_id_errors() {
        let err = parse_pong_datagram(&[0x01, 0x00]).unwrap_err();
        assert!(matches!(err, PingError::Protocol(_)));
    }
}
