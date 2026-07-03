use chrono::{DateTime, Datelike, Duration, Utc};
use mc_api_types::ChatQuota;
use mc_db::db::repos::chat_messages;
use mc_db::db::DbPool;
use uuid::Uuid;

pub const WEEKLY_MESSAGE_LIMIT: u32 = 20;

pub fn calendar_week_start_utc(now: DateTime<Utc>) -> DateTime<Utc> {
    let days = now.weekday().num_days_from_monday();
    (now.date_naive() - Duration::days(days as i64))
        .and_hms_opt(0, 0, 0)
        .unwrap()
        .and_utc()
}

pub fn calendar_week_reset_utc(now: DateTime<Utc>) -> DateTime<Utc> {
    calendar_week_start_utc(now) + Duration::days(7)
}

pub async fn quota_for_user(pool: &DbPool, user_id: Uuid) -> Result<ChatQuota, mc_db::DbError> {
    let now = Utc::now();
    let since = calendar_week_start_utc(now);
    let used = chat_messages::count_since(pool, user_id, since).await? as u32;
    Ok(ChatQuota {
        used,
        limit: WEEKLY_MESSAGE_LIMIT,
        resets_at: calendar_week_reset_utc(now).to_rfc3339(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn week_start_is_monday_midnight_utc() {
        // Wednesday 2026-07-01 15:30 UTC -> Monday 2026-06-29 00:00 UTC
        let now = Utc.with_ymd_and_hms(2026, 7, 1, 15, 30, 0).unwrap();
        let start = calendar_week_start_utc(now);
        assert_eq!(start, Utc.with_ymd_and_hms(2026, 6, 29, 0, 0, 0).unwrap());
    }

    #[test]
    fn week_reset_is_next_monday() {
        let now = Utc.with_ymd_and_hms(2026, 7, 1, 15, 30, 0).unwrap();
        let reset = calendar_week_reset_utc(now);
        assert_eq!(reset, Utc.with_ymd_and_hms(2026, 7, 6, 0, 0, 0).unwrap());
    }
}
