use chrono::Utc;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use uuid::Uuid;

use crate::db::schema::server_suggestions;
use crate::db::DbPool;
use crate::error::DbError;
use crate::model::{Platform, ServerSuggestion, ServerSuggestionStatus};

use super::{db_err, get_conn};

type ServerSuggestionRow = (
    Uuid,
    Uuid,
    String,
    String,
    Option<i32>,
    String,
    String,
    chrono::DateTime<Utc>,
    chrono::DateTime<Utc>,
);

fn row_to_suggestion(row: ServerSuggestionRow) -> Result<ServerSuggestion, DbError> {
    Ok(ServerSuggestion {
        id: row.0,
        user_id: row.1,
        name: row.2,
        host: row.3,
        port: row.4,
        platform: Platform::from_db(&row.5).map_err(DbError::InvalidSettings)?,
        status: ServerSuggestionStatus::from_db(&row.6).map_err(DbError::InvalidSettings)?,
        created_at: row.7,
        updated_at: row.8,
    })
}

const SERVER_SUGGESTION_COLUMNS: (
    server_suggestions::id,
    server_suggestions::user_id,
    server_suggestions::name,
    server_suggestions::host,
    server_suggestions::port,
    server_suggestions::platform,
    server_suggestions::status,
    server_suggestions::created_at,
    server_suggestions::updated_at,
) = (
    server_suggestions::id,
    server_suggestions::user_id,
    server_suggestions::name,
    server_suggestions::host,
    server_suggestions::port,
    server_suggestions::platform,
    server_suggestions::status,
    server_suggestions::created_at,
    server_suggestions::updated_at,
);

pub struct NewServerSuggestion<'a> {
    pub user_id: Uuid,
    pub name: &'a str,
    pub host: &'a str,
    pub port: Option<i32>,
    pub platform: Platform,
}

pub struct UpdateServerSuggestion<'a> {
    pub name: Option<&'a str>,
    pub host: Option<&'a str>,
    pub port: Option<Option<i32>>,
    pub platform: Option<Platform>,
    pub status: Option<ServerSuggestionStatus>,
}

fn is_unique_violation(err: &diesel::result::Error) -> bool {
    matches!(
        err,
        diesel::result::Error::DatabaseError(diesel::result::DatabaseErrorKind::UniqueViolation, _)
    )
}

pub async fn insert(
    pool: &DbPool,
    new: NewServerSuggestion<'_>,
) -> Result<ServerSuggestion, DbError> {
    let mut conn = get_conn(pool).await?;
    let id = Uuid::new_v4();
    let now = Utc::now();

    diesel::insert_into(server_suggestions::table)
        .values((
            server_suggestions::id.eq(id),
            server_suggestions::user_id.eq(new.user_id),
            server_suggestions::name.eq(new.name),
            server_suggestions::host.eq(new.host),
            server_suggestions::port.eq(new.port),
            server_suggestions::platform.eq(new.platform.as_str()),
            server_suggestions::status.eq(ServerSuggestionStatus::Pending.as_str()),
            server_suggestions::created_at.eq(now),
            server_suggestions::updated_at.eq(now),
        ))
        .execute(&mut conn)
        .await
        .map_err(|err| {
            if is_unique_violation(&err) {
                DbError::Conflict(format!(
                    "server is already suggested for host={}, port={:?}, platform={}",
                    new.host,
                    new.port,
                    new.platform.as_str()
                ))
            } else {
                db_err(err)
            }
        })?;

    get(pool, id).await
}

pub async fn get(pool: &DbPool, id: Uuid) -> Result<ServerSuggestion, DbError> {
    let mut conn = get_conn(pool).await?;
    let row = server_suggestions::table
        .filter(server_suggestions::id.eq(id))
        .select(SERVER_SUGGESTION_COLUMNS)
        .first::<ServerSuggestionRow>(&mut conn)
        .await
        .optional()
        .map_err(db_err)?;

    match row {
        Some(row) => row_to_suggestion(row),
        None => Err(DbError::NotFound(format!("server suggestion {id}"))),
    }
}

pub async fn list_by_status(
    pool: &DbPool,
    status: ServerSuggestionStatus,
) -> Result<Vec<ServerSuggestion>, DbError> {
    let mut conn = get_conn(pool).await?;
    let rows = server_suggestions::table
        .filter(server_suggestions::status.eq(status.as_str()))
        .order(server_suggestions::created_at.desc())
        .select(SERVER_SUGGESTION_COLUMNS)
        .load::<ServerSuggestionRow>(&mut conn)
        .await
        .map_err(db_err)?;

    rows.into_iter().map(row_to_suggestion).collect()
}

pub async fn list_by_user(pool: &DbPool, user_id: Uuid) -> Result<Vec<ServerSuggestion>, DbError> {
    let mut conn = get_conn(pool).await?;
    let rows = server_suggestions::table
        .filter(server_suggestions::user_id.eq(user_id))
        .order(server_suggestions::created_at.desc())
        .select(SERVER_SUGGESTION_COLUMNS)
        .load::<ServerSuggestionRow>(&mut conn)
        .await
        .map_err(db_err)?;

    rows.into_iter().map(row_to_suggestion).collect()
}

pub async fn update(
    pool: &DbPool,
    id: Uuid,
    update: UpdateServerSuggestion<'_>,
) -> Result<ServerSuggestion, DbError> {
    let existing = get(pool, id).await?;
    let mut conn = get_conn(pool).await?;
    let now = Utc::now();

    let name = update.name.unwrap_or(&existing.name);
    let host = update.host.unwrap_or(&existing.host);
    let port = update.port.unwrap_or(existing.port);
    let platform = update.platform.unwrap_or(existing.platform);
    let status = update.status.unwrap_or(existing.status);

    diesel::update(server_suggestions::table.filter(server_suggestions::id.eq(id)))
        .set((
            server_suggestions::name.eq(name),
            server_suggestions::host.eq(host),
            server_suggestions::port.eq(port),
            server_suggestions::platform.eq(platform.as_str()),
            server_suggestions::status.eq(status.as_str()),
            server_suggestions::updated_at.eq(now),
        ))
        .execute(&mut conn)
        .await
        .map_err(|err| {
            if is_unique_violation(&err) {
                DbError::Conflict(format!(
                    "server is already suggested for host={host}, port={port:?}, platform={}",
                    platform.as_str()
                ))
            } else {
                db_err(err)
            }
        })?;

    get(pool, id).await
}

pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, DbError> {
    let mut conn = get_conn(pool).await?;
    let deleted = diesel::delete(server_suggestions::table.filter(server_suggestions::id.eq(id)))
        .execute(&mut conn)
        .await
        .map_err(db_err)?;
    Ok(deleted > 0)
}
