use chrono::Utc;
use diesel::prelude::*;
use diesel_async::AsyncConnection;
use diesel_async::RunQueryDsl;
use std::collections::HashMap;

use crate::db::schema::settings;
use crate::db::DbPool;
use crate::error::DbError;
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
            "pinger_timeout_ms",
            &settings.pinger_timeout_ms.to_string(),
        )
        .await?;
        upsert(
            conn,
            "pinger_retry_attempts",
            &settings.pinger_retry_attempts.to_string(),
        )
        .await?;
        upsert(
            conn,
            "pinger_retry_delay_ms",
            &settings.pinger_retry_delay_ms.to_string(),
        )
        .await?;
        upsert(
            conn,
            "dns_cache_enabled",
            if settings.dns_cache_enabled {
                "true"
            } else {
                "false"
            },
        )
        .await?;
        upsert(
            conn,
            "dns_cache_ttl_minutes",
            &settings.dns_cache_ttl_minutes.to_string(),
        )
        .await?;
        upsert(conn, "victoriametrics_url", &settings.victoriametrics_url).await?;
        upsert(
            conn,
            "metrics_push_interval_seconds",
            &settings.metrics_push_interval_seconds.to_string(),
        )
        .await?;
        upsert(
            conn,
            "sign_up_enabled",
            if settings.sign_up_enabled {
                "true"
            } else {
                "false"
            },
        )
        .await?;
        upsert(conn, "www_origin", &settings.www_origin).await?;
        Ok(())
    })
    .await
    .map_err(db_err)
}
