use mc_common::now_ms;
use tokio::net::UdpSocket;
use tokio::time::{Duration, timeout};

use crate::bedrock::ping::encode_unconnected_ping_now;
use crate::bedrock::pong::parse_pong_datagram;
use crate::bedrock::token::{parse_token, ping_from_token};
use crate::error::PingError;
use crate::net::{map_connect_error, map_io_error, map_recv_error};
use crate::types::Ping;

/// Ping a Bedrock Edition server over UDP.
pub async fn ping_bedrock(
    hostname: &str,
    ip: &str,
    port: u16,
    timeout_ms: u64,
) -> Result<Ping, PingError> {
    let timeout_duration = Duration::from_millis(timeout_ms.max(1));

    timeout(timeout_duration, ping_bedrock_inner(hostname, ip, port))
        .await
        .map_err(|_| PingError::NoResponse(hostname.to_string()))?
}

async fn ping_bedrock_inner(hostname: &str, ip: &str, port: u16) -> Result<Ping, PingError> {
    let socket = UdpSocket::bind("0.0.0.0:0")
        .await
        .map_err(|e| map_io_error(hostname, port, e))?;

    socket
        .connect((hostname, port))
        .await
        .map_err(|e| map_connect_error(hostname, port, e))?;

    let ping_packet = encode_unconnected_ping_now();
    socket
        .send(&ping_packet)
        .await
        .map_err(|e| map_io_error(hostname, port, e))?;

    let mut buf = [0u8; 2048];
    let len = socket
        .recv(&mut buf)
        .await
        .map_err(|e| map_recv_error(hostname, port, e))?;

    let token = parse_pong_datagram(&buf[..len])?;
    let parsed = parse_token(&token)?;
    Ok(ping_from_token(&parsed, ip, now_ms()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use tokio::net::UdpSocket;

    async fn spawn_mock_bedrock_server(response: &[u8]) -> std::net::SocketAddr {
        let socket = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let addr = socket.local_addr().unwrap();
        let response = response.to_vec();

        tokio::spawn(async move {
            let mut buf = [0u8; 64];
            let (len, peer) = socket.recv_from(&mut buf).await.unwrap();
            assert_eq!(len, 33);
            assert_eq!(buf[0], 0x01);
            let _ = socket.send_to(&response, peer).await;
        });

        addr
    }

    #[tokio::test]
    async fn mock_udp_server_returns_ping() {
        let response = include_bytes!("../../tests/fixtures/bedrock/pong-sample.bin");
        let addr = spawn_mock_bedrock_server(response).await;
        let ping = ping_bedrock("127.0.0.1", "127.0.0.1", addr.port(), 5_000)
            .await
            .unwrap();
        assert_eq!(ping.players.online, 42);
        assert_eq!(ping.players.max, Some(100));
        assert_eq!(ping.motd.as_ref().unwrap().raw, "Dedicated Server\nSecond Line");
    }

    #[tokio::test]
    async fn timeout_when_no_response() {
        let socket = UdpSocket::bind("127.0.0.1:0").await.unwrap();
        let addr = socket.local_addr().unwrap();
        tokio::spawn(async move {
            let mut buf = [0u8; 64];
            let _ = socket.recv_from(&mut buf).await;
            tokio::time::sleep(Duration::from_secs(2)).await;
        });

        let err = ping_bedrock("127.0.0.1", "127.0.0.1", addr.port(), 100)
            .await
            .unwrap_err();
        assert!(matches!(err, PingError::NoResponse(_)));
    }
}
