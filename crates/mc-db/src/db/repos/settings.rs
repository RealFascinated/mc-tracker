use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel_async::AsyncConnection;
use diesel_async::RunQueryDsl;

use crate::db::schema::settings;
use crate::db::DbPool;
use crate::error::DbError;

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

pub async fn get_row(pool: &DbPool, key: &str) -> Result<Option<(String, DateTime<Utc>)>, DbError> {
    let mut conn = get_conn(pool).await?;
    settings::table
        .filter(settings::key.eq(key))
        .select((settings::value, settings::updated_at))
        .first::<(String, DateTime<Utc>)>(&mut conn)
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
