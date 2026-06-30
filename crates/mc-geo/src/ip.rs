use std::net::IpAddr;

/// Returns true for loopback, private, link-local, multicast, and unspecified addresses.
pub fn is_non_public(ip: IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                || v4.is_multicast()
                || v4.is_unspecified()
                || v4.is_broadcast()
                || v4.octets()[0] == 0
        }
        IpAddr::V6(v6) => {
            v6.is_loopback()
                || v6.is_unspecified()
                || v6.is_multicast()
                || v6.is_unique_local()
                || is_ipv6_ula_or_link_local(&v6)
        }
    }
}

fn is_ipv6_ula_or_link_local(addr: &std::net::Ipv6Addr) -> bool {
    let segments = addr.segments();
    segments[0] & 0xfe00 == 0xfc00 || segments[0] & 0xffc0 == 0xfe80
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn private_and_loopback_are_non_public() {
        assert!(is_non_public("127.0.0.1".parse().unwrap()));
        assert!(is_non_public("10.0.0.1".parse().unwrap()));
        assert!(is_non_public("192.168.1.1".parse().unwrap()));
        assert!(is_non_public("::1".parse().unwrap()));
    }

    #[test]
    fn public_ips_are_not_non_public() {
        assert!(!is_non_public("1.128.0.0".parse().unwrap()));
        assert!(!is_non_public("8.8.8.8".parse().unwrap()));
    }
}
