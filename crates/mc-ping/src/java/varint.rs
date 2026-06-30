use std::io::{self, Read, Write};

use crate::error::PingError;

/// Maximum bytes a VarInt may occupy on the wire.
pub const MAX_VARINT_BYTES: usize = 5;

/// Encode a Minecraft VarInt to any `Write` target.
pub fn write_varint(mut value: u32, output: &mut impl Write) -> io::Result<()> {
    loop {
        if (value & !0x7F) == 0 {
            output.write_all(&[value as u8])?;
            return Ok(());
        }
        output.write_all(&[((value & 0x7F) | 0x80) as u8])?;
        value >>= 7;
    }
}

/// Decode a Minecraft VarInt from any `Read` target.
pub fn read_varint(input: &mut impl Read) -> Result<u32, PingError> {
    let mut value = 0u32;
    for i in 0..MAX_VARINT_BYTES {
        let mut byte = [0u8; 1];
        input.read_exact(&mut byte).map_err(|e| {
            PingError::Protocol(format!("failed reading VarInt byte: {e}"))
        })?;
        let b = byte[0];
        value |= ((b & 0x7F) as u32) << (i * 7);
        if (b & 0x80) == 0 {
            return Ok(value);
        }
    }
    Err(PingError::Protocol("VarInt was too big".into()))
}

/// Encode a VarInt into a fresh buffer.
pub fn encode_varint(value: u32) -> Vec<u8> {
    let mut buf = Vec::new();
    write_varint(value, &mut buf).expect("Vec write cannot fail");
    buf
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    #[test]
    fn round_trip_edge_values() {
        for value in [0u32, 127, 128, 255, 16_383, 16_384, 2_097_151, 2_097_152] {
            let encoded = encode_varint(value);
            let decoded = read_varint(&mut Cursor::new(encoded)).unwrap();
            assert_eq!(decoded, value, "value {value}");
        }
    }

    #[test]
    fn max_varint_round_trip() {
        let value = 1u32 << 28;
        let encoded = encode_varint(value);
        assert_eq!(encoded.len(), 5);
        let decoded = read_varint(&mut Cursor::new(encoded)).unwrap();
        assert_eq!(decoded, value);
    }

    #[test]
    fn oversized_varint_errors() {
        let bytes = [0x80, 0x80, 0x80, 0x80, 0x80, 0x01];
        let err = read_varint(&mut Cursor::new(bytes)).unwrap_err();
        assert!(matches!(err, PingError::Protocol(_)));
    }

    #[test]
    fn truncated_varint_errors() {
        let err = read_varint(&mut Cursor::new([0x80])).unwrap_err();
        assert!(matches!(err, PingError::Protocol(_)));
    }

    #[test]
    fn encode_774_matches_fixture() {
        assert_eq!(encode_varint(774), vec![0x86, 0x06]);
    }
}
