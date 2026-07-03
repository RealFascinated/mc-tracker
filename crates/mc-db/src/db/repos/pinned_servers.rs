use diesel::prelude::*;
use diesel_async::AsyncConnection;
use diesel_async::RunQueryDsl;
use uuid::Uuid;

use crate::db::schema::pinned_servers;
use crate::db::DbPool;
use crate::error::DbError;
use crate::model::PinnedServer;

use super::{db_err, get_conn};

type PinnedServerRow = (Uuid, Uuid, Uuid, i32);

fn row_to_pinned_server(row: PinnedServerRow) -> PinnedServer {
    PinnedServer {
        id: row.0,
        user_id: row.1,
        server_id: row.2,
        position: row.3,
    }
}

const PINNED_SERVER_COLUMNS: (
    pinned_servers::id,
    pinned_servers::user_id,
    pinned_servers::server_id,
    pinned_servers::position,
) = (
    pinned_servers::id,
    pinned_servers::user_id,
    pinned_servers::server_id,
    pinned_servers::position,
);

fn is_unique_violation(err: &diesel::result::Error) -> bool {
    matches!(
        err,
        diesel::result::Error::DatabaseError(diesel::result::DatabaseErrorKind::UniqueViolation, _,)
    )
}

pub async fn list_by_user(pool: &DbPool, user_id: Uuid) -> Result<Vec<PinnedServer>, DbError> {
    let mut conn = get_conn(pool).await?;
    let rows = pinned_servers::table
        .filter(pinned_servers::user_id.eq(user_id))
        .order(pinned_servers::position.asc())
        .select(PINNED_SERVER_COLUMNS)
        .load::<PinnedServerRow>(&mut conn)
        .await
        .map_err(db_err)?;

    Ok(rows.into_iter().map(row_to_pinned_server).collect())
}

pub async fn insert(
    pool: &DbPool,
    user_id: Uuid,
    server_id: Uuid,
) -> Result<PinnedServer, DbError> {
    let mut conn = get_conn(pool).await?;
    let next_position = pinned_servers::table
        .filter(pinned_servers::user_id.eq(user_id))
        .select(diesel::dsl::max(pinned_servers::position))
        .first::<Option<i32>>(&mut conn)
        .await
        .map_err(db_err)?
        .map(|position| position + 1)
        .unwrap_or(0);

    let id = Uuid::new_v4();
    diesel::insert_into(pinned_servers::table)
        .values((
            pinned_servers::id.eq(id),
            pinned_servers::user_id.eq(user_id),
            pinned_servers::server_id.eq(server_id),
            pinned_servers::position.eq(next_position),
        ))
        .execute(&mut conn)
        .await
        .map_err(|err| {
            if is_unique_violation(&err) {
                DbError::Conflict("server is already pinned".into())
            } else {
                db_err(err)
            }
        })?;

    Ok(PinnedServer {
        id,
        user_id,
        server_id,
        position: next_position,
    })
}

pub async fn delete(pool: &DbPool, user_id: Uuid, server_id: Uuid) -> Result<(), DbError> {
    let mut conn = get_conn(pool).await?;
    let deleted = diesel::delete(
        pinned_servers::table
            .filter(pinned_servers::user_id.eq(user_id))
            .filter(pinned_servers::server_id.eq(server_id)),
    )
    .execute(&mut conn)
    .await
    .map_err(db_err)?;

    if deleted == 0 {
        return Err(DbError::NotFound(format!("pinned server {server_id}")));
    }

    compact_positions(&mut conn, user_id).await
}

async fn compact_positions(
    conn: &mut impl diesel_async::AsyncConnection<Backend = diesel::pg::Pg>,
    user_id: Uuid,
) -> Result<(), DbError> {
    let rows = pinned_servers::table
        .filter(pinned_servers::user_id.eq(user_id))
        .order(pinned_servers::position.asc())
        .select((pinned_servers::id, pinned_servers::position))
        .load::<(Uuid, i32)>(conn)
        .await
        .map_err(db_err)?;

    for (index, (id, _)) in rows.into_iter().enumerate() {
        diesel::update(pinned_servers::table.filter(pinned_servers::id.eq(id)))
            .set(pinned_servers::position.eq(index as i32))
            .execute(conn)
            .await
            .map_err(db_err)?;
    }

    Ok(())
}

pub async fn reorder(pool: &DbPool, user_id: Uuid, server_ids: &[Uuid]) -> Result<(), DbError> {
    let mut conn = get_conn(pool).await?;
    conn.transaction::<(), DbError, _>(async |conn| {
        let existing = pinned_servers::table
            .filter(pinned_servers::user_id.eq(user_id))
            .order(pinned_servers::position.asc())
            .select(pinned_servers::server_id)
            .load::<Uuid>(conn)
            .await
            .map_err(db_err)?;

        if existing.len() != server_ids.len() {
            return Err(DbError::InvalidSettings(
                "reorder must include every pinned server".into(),
            ));
        }

        let existing_set: std::collections::HashSet<_> = existing.into_iter().collect();
        for server_id in server_ids {
            if !existing_set.contains(server_id) {
                return Err(DbError::InvalidSettings(format!(
                    "unknown pinned server {server_id}"
                )));
            }
        }

        for (position, server_id) in server_ids.iter().enumerate() {
            diesel::update(
                pinned_servers::table
                    .filter(pinned_servers::user_id.eq(user_id))
                    .filter(pinned_servers::server_id.eq(server_id)),
            )
            .set(pinned_servers::position.eq(position as i32))
            .execute(conn)
            .await
            .map_err(db_err)?;
        }

        Ok(())
    })
    .await
}
