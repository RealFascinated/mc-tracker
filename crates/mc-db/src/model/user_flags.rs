use bitflags::bitflags;

use super::UserRole;

// Bit positions must stay in sync with www/src/lib/user-flags.ts
bitflags! {
    #[derive(Debug, Clone, Copy, PartialEq, Eq)]
    pub struct UserFlags: i64 {
        const UNLIMITED_CHAT = 1 << 0;
        const MANAGE_SERVERS = 1 << 1;
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

pub fn effective_flags(role: UserRole, flags: UserFlags) -> UserFlags {
    if role == UserRole::Admin {
        UserFlags::all()
    } else {
        flags
    }
}

pub fn chat_quota_exempt(flags: UserFlags) -> bool {
    flags.contains(UserFlags::UNLIMITED_CHAT)
}

pub fn can_manage_servers(flags: UserFlags) -> bool {
    flags.contains(UserFlags::MANAGE_SERVERS)
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
    fn effective_flags_grants_all_for_admin() {
        assert_eq!(
            effective_flags(UserRole::Admin, UserFlags::empty()),
            UserFlags::all()
        );
    }

    #[test]
    fn effective_flags_preserves_user_flags() {
        let flags = UserFlags::MANAGE_SERVERS;
        assert_eq!(effective_flags(UserRole::User, flags), flags);
    }

    #[test]
    fn chat_quota_exempt_for_flagged_user() {
        assert!(chat_quota_exempt(UserFlags::UNLIMITED_CHAT));
    }

    #[test]
    fn chat_quota_not_exempt_without_flag() {
        assert!(!chat_quota_exempt(UserFlags::empty()));
    }

    #[test]
    fn can_manage_servers_for_flagged_user() {
        assert!(can_manage_servers(UserFlags::MANAGE_SERVERS));
    }

    #[test]
    fn cannot_manage_servers_without_flag() {
        assert!(!can_manage_servers(UserFlags::empty()));
    }

    #[test]
    fn admin_effective_flags_include_all_permissions() {
        let flags = effective_flags(UserRole::Admin, UserFlags::empty());
        assert!(chat_quota_exempt(flags));
        assert!(can_manage_servers(flags));
    }
}
