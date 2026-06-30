use mc_common::now_ms;
use tokio::io::AsyncWriteExt;
use tokio::net::TcpStream;
use tokio::time::{timeout, Duration};

use crate::error::PingError;
use crate::java::handshake::encode_handshake;
use crate::java::status::exchange_status_on_stream;
use crate::java::token::{
    favicon_from_token, motd_from_token, parse_status_json, players_from_token,
    version_from_token,
};
use crate::java::version::latest_protocol;
use crate::net::{map_connect_error, map_io_error};
use crate::types::Ping;

/// Ping a Java Edition server using hostname + resolved IPv4.
pub async fn ping_java(
    hostname: &str,
    ip: &str,
    port: u16,
    timeout_ms: u64,
) -> Result<Ping, PingError> {
    let timeout_duration = Duration::from_millis(timeout_ms.max(1));

    timeout(timeout_duration, ping_java_inner(hostname, ip, port))
        .await
        .map_err(|_| PingError::NoResponse(hostname.to_string()))?
}

async fn ping_java_inner(hostname: &str, ip: &str, port: u16) -> Result<Ping, PingError> {
    let mut stream = TcpStream::connect((hostname, port))
        .await
        .map_err(|e| map_connect_error(hostname, port, e))?;

    stream
        .set_nodelay(true)
        .map_err(|e| map_io_error(hostname, port, e))?;

    let handshake = encode_handshake(hostname, port, latest_protocol())?;
    stream
        .write_all(&handshake)
        .await
        .map_err(|e| map_io_error(hostname, port, e))?;
    stream
        .flush()
        .await
        .map_err(|e| map_io_error(hostname, port, e))?;

    let json = exchange_status_on_stream(&mut stream)
        .await
        .map_err(|e| map_io_error(hostname, port, std::io::Error::other(e.to_string())))?;

    let token = parse_status_json(&json).map_err(|e| {
        PingError::Protocol(format!("invalid status json from {hostname}:{port}: {e}"))
    })?;

    Ok(Ping {
        timestamp: now_ms(),
        ip: ip.to_string(),
        players: players_from_token(&token),
        motd: motd_from_token(&token),
        version: version_from_token(&token),
        favicon: favicon_from_token(&token),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::java::status::encode_status_response;
    use tokio::io::AsyncReadExt;
    use tokio::net::TcpListener;

    async fn spawn_mock_server(json: &str) -> std::net::SocketAddr {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        let response = encode_status_response(json);

        tokio::spawn(async move {
            let (mut stream, _) = listener.accept().await.unwrap();
            let mut buf = Vec::new();
            loop {
                let mut chunk = [0u8; 256];
                let n = stream.read(&mut chunk).await.unwrap();
                if n == 0 {
                    break;
                }
                buf.extend_from_slice(&chunk[..n]);
                if buf.windows(2).any(|window| window == [0x01, 0x00]) {
                    break;
                }
            }
            let _ = stream.write_all(&response).await;
            let _ = stream.flush().await;
        });

        addr
    }

    #[tokio::test]
    async fn mock_tcp_server_returns_ping() {
        let json = include_str!("../../tests/fixtures/java/status-plain.json");
        let addr = spawn_mock_server(json).await;
        let ping = ping_java("127.0.0.1", "127.0.0.1", addr.port(), 5_000)
            .await
            .unwrap();
        assert_eq!(ping.players.online, 42);
        assert_eq!(ping.players.max, Some(100));
        assert_eq!(ping.motd.as_ref().unwrap().raw, "A Minecraft Server");
        assert_eq!(ping.version.as_ref().unwrap().name, "1.21.4");
    }

    #[tokio::test]
    async fn timeout_on_slow_server() {
        let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
        let addr = listener.local_addr().unwrap();
        tokio::spawn(async move {
            let (stream, _) = listener.accept().await.unwrap();
            tokio::time::sleep(Duration::from_secs(2)).await;
            drop(stream);
        });

        let err = ping_java("127.0.0.1", "127.0.0.1", addr.port(), 100)
            .await
            .unwrap_err();
        assert!(matches!(err, PingError::NoResponse(_)));
    }
}
