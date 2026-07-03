use bitflags::bitflags;

use super::UserRole;

// Bit positions must stay in sync with www/src/lib/user-flags.ts
bitflags! {
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub struct UserFlags: i64 {
        const UNLIMITED_CHAT = 1 << 0;
    }
}

impl UserFlags {
    pub fn from_db(value: i64) -> Self {
        Self::from_bits_truncate(value)
    }

    pub fn to_db(self) -> i64 {
        self.bits()
    }
}

pub fn chat_quota_exempt(role: UserRole, flags: UserFlags) -> bool {
    role == UserRole::Admin || flags.contains(UserFlags::UNLIMITED_CHAT)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn round_trip_db_bits() {
        let flags = UserFlags::UNLIMITED_CHAT;
        assert_eq!(UserFlags::from_db(flags.to_db()), flags);
    }

    #[test]
    fn chat_quota_exempt_for_admin() {
        assert!(chat_quota_exempt(UserRole::Admin, UserFlags::empty()));
    }

    #[test]
    fn chat_quota_exempt_for_flagged_user() {
        assert!(chat_quota_exempt(
            UserRole::User,
            UserFlags::UNLIMITED_CHAT
        ));
    }

    #[test]
    fn chat_quota_not_exempt_for_regular_user() {
        assert!(!chat_quota_exempt(UserRole::User, UserFlags::empty()));
    }
}
