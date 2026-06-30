use mc_common::unix_now_ms;

pub const PACKET_ID: u8 = 0x01;

/// RakNet unconnected ping magic bytes.
pub const MAGIC: [u8; 16] = [
    0x00, 0xFF, 0xFF, 0x00, 0xFE, 0xFE, 0xFE, 0xFE, 0xFD, 0xFD, 0xFD, 0xFD, 0x12, 0x34, 0x56,
    0x78,
];

/// Build the 33-byte little-endian unconnected ping packet.
pub fn encode_unconnected_ping(timestamp_ms: u64) -> [u8; 33] {
    let mut packet = [0u8; 33];
    packet[0] = PACKET_ID;
    packet[1..9].copy_from_slice(&timestamp_ms.to_le_bytes());
    packet[9..25].copy_from_slice(&MAGIC);
    // client GUID = 0 (bytes 25..33 already zero)
    packet
}

pub fn encode_unconnected_ping_now() -> [u8; 33] {
    encode_unconnected_ping(unix_now_ms())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn ping_packet_is_33_bytes_with_magic() {
        let packet = encode_unconnected_ping(1_700_000_000_123);
        assert_eq!(packet.len(), 33);
        assert_eq!(packet[0], PACKET_ID);
        assert_eq!(u64::from_le_bytes(packet[1..9].try_into().unwrap()), 1_700_000_000_123);
        assert_eq!(&packet[9..25], &MAGIC);
        assert_eq!(u64::from_le_bytes(packet[25..33].try_into().unwrap()), 0);
    }

    #[test]
    fn ping_packet_matches_fixture() {
        let packet = encode_unconnected_ping(1_700_000_000_123);
        let expected = include_bytes!("../../tests/fixtures/bedrock/ping-1700000000123.bin");
        assert_eq!(packet.as_slice(), expected.as_slice());
    }
}
