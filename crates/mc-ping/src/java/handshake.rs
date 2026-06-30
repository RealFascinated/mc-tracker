use crate::error::PingError;
use crate::java::varint::write_varint;

const PACKET_ID: u8 = 0x00;
const STATUS_HANDSHAKE: u32 = 1;

/// Build the handshake packet bytes (length prefix + payload).
pub fn encode_handshake(
    hostname: &str,
    port: u16,
    protocol_version: u32,
) -> Result<Vec<u8>, PingError> {
    let host_bytes = hostname.as_bytes();
    let host_len = host_bytes.len();
    if host_len > u32::MAX as usize {
        return Err(PingError::Protocol("hostname too long".into()));
    }

    let mut payload = Vec::new();
    payload.push(PACKET_ID);
    write_varint(protocol_version, &mut payload).map_err(map_io)?;
    write_varint(host_len as u32, &mut payload).map_err(map_io)?;
    payload.extend_from_slice(host_bytes);
    payload.extend_from_slice(&port.to_be_bytes());
    write_varint(STATUS_HANDSHAKE, &mut payload).map_err(map_io)?;

    let mut packet = Vec::new();
    write_varint(payload.len() as u32, &mut packet).map_err(map_io)?;
    packet.extend_from_slice(&payload);
    Ok(packet)
}

fn map_io(err: std::io::Error) -> PingError {
    PingError::Protocol(format!("handshake encode failed: {err}"))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::java::version::latest_protocol;

    #[test]
    fn handshake_localhost_25565_matches_fixture() {
        let packet = encode_handshake("localhost", 25565, latest_protocol()).unwrap();
        let expected = include_bytes!("../../tests/fixtures/java/handshake-localhost-25565.bin");
        assert_eq!(packet, expected);
    }

    #[test]
    fn handshake_mc_example_com_length_prefix() {
        let packet = encode_handshake("mc.example.com", 25565, 774).unwrap();
        assert_eq!(packet[0], 21);
        assert_eq!(packet.len(), 22);
    }
}
