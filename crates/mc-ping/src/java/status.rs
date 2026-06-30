use std::io::{Read, Write};

use tokio::io::{AsyncRead, AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpStream;

use crate::error::PingError;
use crate::java::varint::{read_varint, write_varint, MAX_VARINT_BYTES};

const PACKET_ID: u8 = 0x00;

/// Send a status request and read the JSON response body (blocking).
pub fn exchange_status(stream: &mut (impl Read + Write)) -> Result<String, PingError> {
    stream
        .write_all(&[0x01, PACKET_ID])
        .map_err(|e| PingError::Protocol(format!("status request write failed: {e}")))?;
    stream
        .flush()
        .map_err(|e| PingError::Protocol(format!("status request flush failed: {e}")))?;

    read_status_response(stream)
}

/// Send a status request and read the JSON response body on one TCP stream.
pub async fn exchange_status_on_stream(stream: &mut TcpStream) -> Result<String, PingError> {
    stream
        .write_all(&[0x01, PACKET_ID])
        .await
        .map_err(|e| PingError::Protocol(format!("status request write failed: {e}")))?;
    stream
        .flush()
        .await
        .map_err(|e| PingError::Protocol(format!("status request flush failed: {e}")))?;

    read_status_response_async(stream).await
}

/// Read a status response packet from the stream (blocking).
pub fn read_status_response(stream: &mut impl Read) -> Result<String, PingError> {
    let _packet_length = read_varint(stream)?;
    let packet_id = read_varint(stream)?;
    validate_status_packet(packet_id)?;

    let length = read_varint(stream)?;
    validate_status_length(length)?;

    read_json_body(stream, length)
}

/// Read a status response packet from the stream (async).
pub async fn read_status_response_async(
    stream: &mut (impl AsyncRead + Unpin),
) -> Result<String, PingError> {
    let _packet_length = read_varint_async(stream).await?;
    let packet_id = read_varint_async(stream).await?;
    validate_status_packet(packet_id)?;

    let length = read_varint_async(stream).await?;
    validate_status_length(length)?;

    read_json_body_async(stream, length).await
}

fn validate_status_packet(packet_id: u32) -> Result<(), PingError> {
    if packet_id == u32::MAX {
        return Err(PingError::Protocol(
            "server stream was prematurely ended".into(),
        ));
    }
    if packet_id != PACKET_ID as u32 {
        return Err(PingError::Protocol(
            "server returned invalid packet ID".into(),
        ));
    }
    Ok(())
}

fn validate_status_length(length: u32) -> Result<(), PingError> {
    if length == u32::MAX {
        return Err(PingError::Protocol(
            "server stream was prematurely ended".into(),
        ));
    }
    if length == 0 {
        return Err(PingError::Protocol(
            "server returned unexpected value".into(),
        ));
    }
    Ok(())
}

fn read_json_body(stream: &mut impl Read, length: u32) -> Result<String, PingError> {
    let mut data = vec![0u8; length as usize];
    stream
        .read_exact(&mut data)
        .map_err(|e| PingError::Protocol(format!("failed reading status json: {e}")))?;
    String::from_utf8(data).map_err(|e| PingError::Protocol(format!("invalid status utf-8: {e}")))
}

async fn read_json_body_async(
    stream: &mut (impl AsyncRead + Unpin),
    length: u32,
) -> Result<String, PingError> {
    let mut data = vec![0u8; length as usize];
    stream
        .read_exact(&mut data)
        .await
        .map_err(|e| PingError::Protocol(format!("failed reading status json: {e}")))?;
    String::from_utf8(data).map_err(|e| PingError::Protocol(format!("invalid status utf-8: {e}")))
}

async fn read_varint_async(stream: &mut (impl AsyncRead + Unpin)) -> Result<u32, PingError> {
    let mut value = 0u32;
    for i in 0..MAX_VARINT_BYTES {
        let b = stream
            .read_u8()
            .await
            .map_err(|e| PingError::Protocol(format!("failed reading VarInt byte: {e}")))?;
        value |= ((b & 0x7F) as u32) << (i * 7);
        if (b & 0x80) == 0 {
            return Ok(value);
        }
    }
    Err(PingError::Protocol("VarInt was too big".into()))
}

/// Build a status response packet for mock servers.
pub fn encode_status_response(json: &str) -> Vec<u8> {
    let json_bytes = json.as_bytes();
    let mut payload = Vec::new();
    payload.push(PACKET_ID);
    write_varint(json_bytes.len() as u32, &mut payload).unwrap();
    payload.extend_from_slice(json_bytes);

    let mut packet = Vec::new();
    write_varint(payload.len() as u32, &mut packet).unwrap();
    packet.extend_from_slice(&payload);
    packet
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Cursor;

    const PLAIN_JSON: &str = include_str!("../../tests/fixtures/java/status-plain.json");

    #[test]
    fn parse_plain_status_json() {
        let packet = encode_status_response(PLAIN_JSON);
        let json = read_status_response(&mut Cursor::new(packet)).unwrap();
        assert_eq!(json, PLAIN_JSON);
    }

    #[test]
    fn invalid_packet_id_errors() {
        let mut payload = Vec::new();
        payload.push(0x01);
        write_varint(2, &mut payload).unwrap();
        payload.extend_from_slice(b"{}");

        let mut packet = Vec::new();
        write_varint(payload.len() as u32, &mut packet).unwrap();
        packet.extend_from_slice(&payload);

        let err = read_status_response(&mut Cursor::new(packet)).unwrap_err();
        assert!(matches!(err, PingError::Protocol(_)));
    }
}
