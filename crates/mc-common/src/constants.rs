pub mod limits {
    /// Default cap for list/search/rank endpoints and chat tool results.
    pub const DEFAULT_LIST_LIMIT: u32 = 25;
    /// Max servers in a compare request (chat + HTTP).
    pub const MAX_COMPARE_SERVERS: usize = 5;
}

pub mod time {
    pub const SECONDS_PER_DAY: i64 = 86_400;
    pub const SECONDS_PER_DAY_U64: u64 = 86_400;
}
