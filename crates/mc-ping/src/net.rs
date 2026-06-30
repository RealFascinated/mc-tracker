use std::io::ErrorKind;

use crate::error::PingError;

pub fn map_connect_error(hostname: &str, port: u16, err: std::io::Error) -> PingError {
    match err.kind() {
        ErrorKind::NotFound => PingError::UnknownHost(hostname.to_string()),
        ErrorKind::TimedOut | ErrorKind::ConnectionRefused | ErrorKind::ConnectionReset => {
            PingError::NoResponse(hostname.to_string())
        }
        _ => map_io_error(hostname, port, err),
    }
}

pub fn map_recv_error(hostname: &str, port: u16, err: std::io::Error) -> PingError {
    match err.kind() {
        ErrorKind::TimedOut | ErrorKind::WouldBlock => PingError::NoResponse(hostname.to_string()),
        _ => map_io_error(hostname, port, err),
    }
}

pub fn map_io_error(hostname: &str, port: u16, err: std::io::Error) -> PingError {
    PingError::Io {
        host: hostname.to_string(),
        port,
        message: err.to_string(),
    }
}
