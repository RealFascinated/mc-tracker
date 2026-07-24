/// Simple email shape check used for sign-up and profile updates.
pub fn is_valid_email(value: &str) -> bool {
    let value = value.trim();
    let Some((local, domain)) = value.split_once('@') else {
        return false;
    };
    if local.is_empty() || domain.is_empty() {
        return false;
    }
    let Some((_, tld)) = domain.rsplit_once('.') else {
        return false;
    };
    !tld.is_empty() && !domain.starts_with('.') && !domain.ends_with('.')
}

#[cfg(test)]
mod tests {
    use super::is_valid_email;

    #[test]
    fn accepts_simple_email() {
        assert!(is_valid_email("user@example.com"));
    }

    #[test]
    fn rejects_missing_at() {
        assert!(!is_valid_email("userexample.com"));
    }

    #[test]
    fn rejects_missing_domain() {
        assert!(!is_valid_email("user@"));
    }
}
