use chrono::Utc;
use diesel::prelude::*;
use diesel_async::AsyncConnection;
use diesel_async::RunQueryDsl;
use std::collections::HashMap;

use crate::db::schema::settings;
use crate::db::DbPool;
use crate::error::DbError;
use crate::model::settings_constants::{
    KEY_DNS_CACHE_ENABLED, KEY_DNS_CACHE_TTL_MINUTES, KEY_LLM_API_KEY, KEY_LLM_BASE_URL,
    KEY_LLM_CONTEXT_MAX, KEY_LLM_CONTEXT_MAX_TURNS, KEY_LLM_CONTEXT_RESERVE,
    KEY_LLM_FINAL_MAX_TOKENS, KEY_LLM_MAX_TOOL_ROUNDS, KEY_LLM_MODEL, KEY_LLM_PARALLEL_SLOTS,
    KEY_LLM_PROVIDER, KEY_LLM_TIMEOUT_SECS, KEY_LLM_TOOL_MAX_TOKENS, KEY_METRICS_PUSH_CRON,
    KEY_PINGER_RETRY_ATTEMPTS, KEY_PINGER_RETRY_DELAY_MS, KEY_PINGER_TIMEOUT_MS,
    KEY_SIGN_UP_ENABLED, KEY_VICTORIAMETRICS_URL, KEY_WWW_ORIGIN,
};
use crate::model::AppSettings;

use super::{db_err, get_conn};

pub async fn get(pool: &DbPool, key: &str) -> Result<Option<String>, DbError> {
    let mut conn = get_conn(pool).await?;
    settings::table
        .filter(settings::key.eq(key))
        .select(settings::value)
        .first::<String>(&mut conn)
        .await
        .optional()
        .map_err(db_err)
}

pub async fn set(pool: &DbPool, key: &str, value: &str) -> Result<(), DbError> {
    let mut conn = get_conn(pool).await?;
    upsert(&mut conn, key, value).await
}

async fn upsert(
    conn: &mut impl AsyncConnection<Backend = diesel::pg::Pg>,
    key: &str,
    value: &str,
) -> Result<(), DbError> {
    let now = Utc::now();

    diesel::insert_into(settings::table)
        .values((
            settings::key.eq(key),
            settings::value.eq(value),
            settings::updated_at.eq(now),
        ))
        .on_conflict(settings::key)
        .do_update()
        .set((settings::value.eq(value), settings::updated_at.eq(now)))
        .execute(conn)
        .await
        .map_err(db_err)?;
    Ok(())
}

pub async fn load_all(pool: &DbPool) -> Result<AppSettings, DbError> {
    let mut conn = get_conn(pool).await?;
    let rows = settings::table
        .select((settings::key, settings::value))
        .load::<(String, String)>(&mut conn)
        .await
        .map_err(db_err)?;

    let map: HashMap<String, String> = rows.into_iter().collect();
    AppSettings::from_map(&map).map_err(DbError::InvalidSettings)
}

pub async fn save(pool: &DbPool, settings: &AppSettings) -> Result<(), DbError> {
    let settings = settings.clone();
    let mut conn = get_conn(pool).await?;
    conn.transaction::<(), DbError, _>(async |conn| {
        upsert(
            conn,
            KEY_PINGER_TIMEOUT_MS,
            &settings.pinger_timeout_ms.to_string(),
        )
        .await?;
        upsert(
            conn,
            KEY_PINGER_RETRY_ATTEMPTS,
            &settings.pinger_retry_attempts.to_string(),
        )
        .await?;
        upsert(
            conn,
            KEY_PINGER_RETRY_DELAY_MS,
            &settings.pinger_retry_delay_ms.to_string(),
        )
        .await?;
        upsert(
            conn,
            KEY_DNS_CACHE_ENABLED,
            if settings.dns_cache_enabled {
                "true"
            } else {
                "false"
            },
        )
        .await?;
        upsert(
            conn,
            KEY_DNS_CACHE_TTL_MINUTES,
            &settings.dns_cache_ttl_minutes.to_string(),
        )
        .await?;
        upsert(conn, KEY_VICTORIAMETRICS_URL, &settings.victoriametrics_url).await?;
        upsert(conn, KEY_METRICS_PUSH_CRON, &settings.metrics_push_cron).await?;
        upsert(
            conn,
            KEY_SIGN_UP_ENABLED,
            if settings.sign_up_enabled {
                "true"
            } else {
                "false"
            },
        )
        .await?;
        upsert(conn, KEY_WWW_ORIGIN, &settings.www_origin).await?;
        upsert(conn, KEY_LLM_BASE_URL, &settings.llm_base_url).await?;
        upsert(conn, KEY_LLM_MODEL, &settings.llm_model).await?;
        upsert(
            conn,
            KEY_LLM_MAX_TOOL_ROUNDS,
            &settings.llm_max_tool_rounds.to_string(),
        )
        .await?;
        upsert(
            conn,
            KEY_LLM_CONTEXT_MAX_TURNS,
            &settings.llm_context_max_turns.to_string(),
        )
        .await?;
        upsert(
            conn,
            KEY_LLM_TOOL_MAX_TOKENS,
            &settings.llm_tool_max_tokens.to_string(),
        )
        .await?;
        upsert(
            conn,
            KEY_LLM_FINAL_MAX_TOKENS,
            &settings.llm_final_max_tokens.to_string(),
        )
        .await?;
        upsert(
            conn,
            KEY_LLM_CONTEXT_MAX,
            &settings.llm_context_max.to_string(),
        )
        .await?;
        upsert(
            conn,
            KEY_LLM_CONTEXT_RESERVE,
            &settings.llm_context_reserve.to_string(),
        )
        .await?;
        upsert(
            conn,
            KEY_LLM_TIMEOUT_SECS,
            &settings.llm_timeout_secs.to_string(),
        )
        .await?;
        upsert(conn, KEY_LLM_PROVIDER, &settings.llm_provider).await?;
        upsert(
            conn,
            KEY_LLM_PARALLEL_SLOTS,
            &settings.llm_parallel_slots.to_string(),
        )
        .await?;
        upsert(conn, KEY_LLM_API_KEY, &settings.llm_api_key).await?;
        Ok(())
    })
    .await
    .map_err(db_err)
}
