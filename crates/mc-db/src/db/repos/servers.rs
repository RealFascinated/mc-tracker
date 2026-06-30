use chrono::Utc;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use uuid::Uuid;

use crate::db::schema::servers;
use crate::db::DbPool;
use crate::error::DbError;
use crate::model::{Platform, Server};

use super::{db_err, get_conn};

type ServerRow = (
    Uuid,
    String,
    String,
    Option<i32>,
    String,
    chrono::DateTime<Utc>,
    chrono::DateTime<Utc>,
);

fn row_to_server(row: ServerRow) -> Result<Server, DbError> {
    Ok(Server {
        id: row.0,
        name: row.1,
        host: row.2,
        port: row.3,
        platform: Platform::from_db(&row.4).map_err(DbError::InvalidSettings)?,
        created_at: row.5,
        updated_at: row.6,
    })
}

pub struct NewServer<'a> {
    pub id: Option<Uuid>,
    pub name: &'a str,
    pub host: &'a str,
    pub port: Option<i32>,
    pub platform: Platform,
}

pub struct UpdateServer<'a> {
    pub name: Option<&'a str>,
    pub host: Option<&'a str>,
    pub port: Option<Option<i32>>,
    pub platform: Option<Platform>,
}

pub async fn list(pool: &DbPool) -> Result<Vec<Server>, DbError> {
    let mut conn = get_conn(pool).await?;
    let rows = servers::table
        .order(servers::name.asc())
        .select((
            servers::id,
            servers::name,
            servers::host,
            servers::port,
            servers::platform,
            servers::created_at,
            servers::updated_at,
        ))
        .load::<ServerRow>(&mut conn)
        .await
        .map_err(db_err)?;

    rows.into_iter().map(row_to_server).collect()
}

pub async fn get(pool: &DbPool, id: Uuid) -> Result<Server, DbError> {
    let mut conn = get_conn(pool).await?;
    let row = servers::table
        .filter(servers::id.eq(id))
        .select((
            servers::id,
            servers::name,
            servers::host,
            servers::port,
            servers::platform,
            servers::created_at,
            servers::updated_at,
        ))
        .first::<ServerRow>(&mut conn)
        .await
        .optional()
        .map_err(db_err)?;

    match row {
        Some(row) => row_to_server(row),
        None => Err(DbError::NotFound(format!("server {id}"))),
    }
}

pub async fn insert(pool: &DbPool, new: NewServer<'_>) -> Result<Server, DbError> {
    let mut conn = get_conn(pool).await?;
    let id = new.id.unwrap_or_else(Uuid::new_v4);
    let now = Utc::now();

    diesel::insert_into(servers::table)
        .values((
            servers::id.eq(id),
            servers::name.eq(new.name),
            servers::host.eq(new.host),
            servers::port.eq(new.port),
            servers::platform.eq(new.platform.as_str()),
            servers::created_at.eq(now),
            servers::updated_at.eq(now),
        ))
        .execute(&mut conn)
        .await
        .map_err(|e| {
            if is_unique_violation(&e) {
                DbError::Conflict(format!(
                    "server already exists for host={}, port={:?}, platform={}",
                    new.host,
                    new.port,
                    new.platform.as_str()
                ))
            } else {
                db_err(e)
            }
        })?;

    get(pool, id).await
}

pub async fn update(pool: &DbPool, id: Uuid, update: UpdateServer<'_>) -> Result<Server, DbError> {
    let existing = get(pool, id).await?;
    let mut conn = get_conn(pool).await?;
    let now = Utc::now();

    let name = update.name.unwrap_or(&existing.name);
    let host = update.host.unwrap_or(&existing.host);
    let port = update.port.unwrap_or(existing.port);
    let platform = update.platform.unwrap_or(existing.platform);

    diesel::update(servers::table.filter(servers::id.eq(id)))
        .set((
            servers::name.eq(name),
            servers::host.eq(host),
            servers::port.eq(port),
            servers::platform.eq(platform.as_str()),
            servers::updated_at.eq(now),
        ))
        .execute(&mut conn)
        .await
        .map_err(|e| {
            if is_unique_violation(&e) {
                DbError::Conflict(format!(
                    "server already exists for host={host}, port={port:?}, platform={}",
                    platform.as_str()
                ))
            } else {
                db_err(e)
            }
        })?;

    get(pool, id).await
}

pub async fn delete(pool: &DbPool, id: Uuid) -> Result<bool, DbError> {
    let mut conn = get_conn(pool).await?;
    let deleted = diesel::delete(servers::table.filter(servers::id.eq(id)))
        .execute(&mut conn)
        .await
        .map_err(db_err)?;
    Ok(deleted > 0)
}

fn is_unique_violation(err: &diesel::result::Error) -> bool {
    matches!(
        err,
        diesel::result::Error::DatabaseError(diesel::result::DatabaseErrorKind::UniqueViolation, _)
    )
}
