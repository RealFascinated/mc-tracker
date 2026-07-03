use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use uuid::Uuid;

use crate::db::schema::chat_messages;
use crate::db::DbPool;
use crate::error::DbError;

use super::{db_err, get_conn};

pub async fn count_since(
    pool: &DbPool,
    user_id: Uuid,
    since: DateTime<Utc>,
) -> Result<i64, DbError> {
    let mut conn = get_conn(pool).await?;
    chat_messages::table
        .filter(chat_messages::user_id.eq(user_id))
        .filter(chat_messages::created_at.ge(since))
        .count()
        .get_result(&mut conn)
        .await
        .map_err(db_err)
}

pub async fn record(pool: &DbPool, user_id: Uuid) -> Result<(), DbError> {
    let mut conn = get_conn(pool).await?;
    diesel::insert_into(chat_messages::table)
        .values((
            chat_messages::id.eq(Uuid::new_v4()),
            chat_messages::user_id.eq(user_id),
            chat_messages::created_at.eq(Utc::now()),
        ))
        .execute(&mut conn)
        .await
        .map_err(db_err)?;
    Ok(())
}
