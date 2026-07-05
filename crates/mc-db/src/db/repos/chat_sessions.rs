use chrono::Utc;
use diesel::prelude::*;
use diesel::sql_types::{BigInt, Integer, Text, Timestamptz, Uuid as SqlUuid};
use diesel_async::AsyncConnection;
use diesel_async::RunQueryDsl;
use uuid::Uuid;

use crate::db::schema::{chat_sessions, chat_turns};
use crate::db::DbPool;
use crate::error::DbError;
use crate::model::chat_session::{ChatSessionSummary, ChatTurnRow};

use super::{db_err, get_conn};

const PREVIEW_MAX_LEN: usize = 80;

#[derive(Debug, Clone, Copy)]
pub struct ChatSessionUsage {
    pub tokens_used: u64,
    pub last_prompt_tokens: u32,
}

pub async fn get_usage(pool: &DbPool, session_id: Uuid) -> Result<ChatSessionUsage, DbError> {
    let mut conn = get_conn(pool).await?;
    let row: (i64, i32) = chat_sessions::table
        .filter(chat_sessions::id.eq(session_id))
        .select((
            chat_sessions::tokens_used,
            chat_sessions::last_prompt_tokens,
        ))
        .first(&mut conn)
        .await
        .map_err(db_err)?;
    Ok(ChatSessionUsage {
        tokens_used: row.0 as u64,
        last_prompt_tokens: row.1 as u32,
    })
}

pub async fn add_turn_tokens(
    pool: &DbPool,
    session_id: Uuid,
    turn_total_tokens: u32,
    last_prompt_tokens: u32,
) -> Result<u64, DbError> {
    let mut conn = get_conn(pool).await?;
    let added = turn_total_tokens as i64;
    let updated: i64 =
        diesel::update(chat_sessions::table.filter(chat_sessions::id.eq(session_id)))
            .set((
                chat_sessions::tokens_used.eq(chat_sessions::tokens_used + added),
                chat_sessions::last_prompt_tokens.eq(last_prompt_tokens as i32),
            ))
            .returning(chat_sessions::tokens_used)
            .get_result(&mut conn)
            .await
            .map_err(db_err)?;
    Ok(updated as u64)
}

pub async fn get_or_create_for_user(
    pool: &DbPool,
    user_id: Uuid,
    session_id: Uuid,
) -> Result<(), DbError> {
    let mut conn = get_conn(pool).await?;
    let now = Utc::now();
    diesel::insert_into(chat_sessions::table)
        .values((
            chat_sessions::id.eq(session_id),
            chat_sessions::user_id.eq(user_id),
            chat_sessions::created_at.eq(now),
            chat_sessions::updated_at.eq(now),
            chat_sessions::tokens_used.eq(0i64),
            chat_sessions::last_prompt_tokens.eq(0),
        ))
        .on_conflict(chat_sessions::id)
        .do_nothing()
        .execute(&mut conn)
        .await
        .map_err(db_err)?;

    let owner: Option<Uuid> = chat_sessions::table
        .filter(chat_sessions::id.eq(session_id))
        .select(chat_sessions::user_id)
        .first(&mut conn)
        .await
        .optional()
        .map_err(db_err)?;

    match owner {
        Some(owner) if owner == user_id => Ok(()),
        Some(_) => Err(DbError::NotFound("session".into())),
        None => Err(DbError::database("session not found after insert")),
    }
}

pub async fn list_turns(pool: &DbPool, session_id: Uuid) -> Result<Vec<ChatTurnRow>, DbError> {
    #[derive(Queryable, Selectable)]
    #[diesel(table_name = chat_turns)]
    struct TurnSelect {
        id: Uuid,
        session_id: Uuid,
        seq: i32,
        role: String,
        content: String,
        tool_names: Vec<String>,
        created_at: chrono::DateTime<Utc>,
    }

    let mut conn = get_conn(pool).await?;
    let rows = chat_turns::table
        .filter(chat_turns::session_id.eq(session_id))
        .order(chat_turns::seq.asc())
        .select(TurnSelect::as_select())
        .load::<TurnSelect>(&mut conn)
        .await
        .map_err(db_err)?;

    Ok(rows
        .into_iter()
        .map(|row| ChatTurnRow {
            id: row.id,
            session_id: row.session_id,
            seq: row.seq,
            role: row.role,
            content: row.content,
            tool_names: row.tool_names,
            created_at: row.created_at,
        })
        .collect())
}

pub async fn append_turn_pair(
    pool: &DbPool,
    user_id: Uuid,
    session_id: Uuid,
    user_content: &str,
    assistant_content: &str,
    tool_names: &[String],
) -> Result<(), DbError> {
    let mut conn = get_conn(pool).await?;
    conn.transaction::<(), DbError, _>(async |conn| {
        let owner: Uuid = chat_sessions::table
            .filter(chat_sessions::id.eq(session_id))
            .for_update()
            .select(chat_sessions::user_id)
            .first(conn)
            .await
            .map_err(db_err)?;
        if owner != user_id {
            return Err(DbError::NotFound("session".into()));
        }

        let max_seq: Option<i32> = chat_turns::table
            .filter(chat_turns::session_id.eq(session_id))
            .select(diesel::dsl::max(chat_turns::seq))
            .first(conn)
            .await
            .map_err(db_err)?;
        let user_seq = max_seq.unwrap_or(0) + 1;
        let assistant_seq = user_seq + 1;
        let now = Utc::now();

        diesel::insert_into(chat_turns::table)
            .values((
                chat_turns::id.eq(Uuid::new_v4()),
                chat_turns::session_id.eq(session_id),
                chat_turns::seq.eq(user_seq),
                chat_turns::role.eq("user"),
                chat_turns::content.eq(user_content),
                chat_turns::tool_names.eq::<Vec<String>>(vec![]),
                chat_turns::created_at.eq(now),
            ))
            .execute(conn)
            .await
            .map_err(db_err)?;

        diesel::insert_into(chat_turns::table)
            .values((
                chat_turns::id.eq(Uuid::new_v4()),
                chat_turns::session_id.eq(session_id),
                chat_turns::seq.eq(assistant_seq),
                chat_turns::role.eq("assistant"),
                chat_turns::content.eq(assistant_content),
                chat_turns::tool_names.eq(tool_names.to_vec()),
                chat_turns::created_at.eq(now),
            ))
            .execute(conn)
            .await
            .map_err(db_err)?;

        diesel::update(chat_sessions::table.filter(chat_sessions::id.eq(session_id)))
            .set(chat_sessions::updated_at.eq(now))
            .execute(conn)
            .await
            .map_err(db_err)?;
        Ok(())
    })
    .await
    .map_err(db_err)
}

pub async fn list_sessions_for_user(
    pool: &DbPool,
    user_id: Uuid,
    limit: i64,
    offset: i64,
) -> Result<Vec<ChatSessionSummary>, DbError> {
    let mut conn = get_conn(pool).await?;
    #[derive(QueryableByName)]
    struct Row {
        #[diesel(sql_type = SqlUuid)]
        id: Uuid,
        #[diesel(sql_type = Timestamptz)]
        updated_at: chrono::DateTime<Utc>,
        #[diesel(sql_type = Text)]
        preview: String,
        #[diesel(sql_type = BigInt)]
        turn_count: i64,
    }

    let rows: Vec<Row> = diesel::sql_query(
        r#"
        SELECT
            s.id,
            s.updated_at,
            COALESCE(
                LEFT(
                    (SELECT t.content FROM chat_turns t
                     WHERE t.session_id = s.id AND t.role = 'user'
                     ORDER BY t.seq ASC LIMIT 1),
                    $3
                ),
                'New conversation'
            ) AS preview,
            (SELECT COUNT(*) FROM chat_turns t WHERE t.session_id = s.id) AS turn_count
        FROM chat_sessions s
        WHERE s.user_id = $1
        ORDER BY s.updated_at DESC
        LIMIT $2 OFFSET $4
        "#,
    )
    .bind::<SqlUuid, _>(user_id)
    .bind::<BigInt, _>(limit)
    .bind::<Integer, _>(PREVIEW_MAX_LEN as i32)
    .bind::<BigInt, _>(offset)
    .load(&mut *conn)
    .await
    .map_err(db_err)?;

    Ok(rows
        .into_iter()
        .map(|row| ChatSessionSummary {
            id: row.id,
            updated_at: row.updated_at,
            preview: row.preview,
            turn_count: row.turn_count,
        })
        .collect())
}

pub async fn delete_session(pool: &DbPool, user_id: Uuid, session_id: Uuid) -> Result<(), DbError> {
    let mut conn = get_conn(pool).await?;
    let deleted = diesel::delete(
        chat_sessions::table
            .filter(chat_sessions::id.eq(session_id))
            .filter(chat_sessions::user_id.eq(user_id)),
    )
    .execute(&mut conn)
    .await
    .map_err(db_err)?;
    if deleted == 0 {
        return Err(DbError::NotFound("session".into()));
    }
    Ok(())
}

pub async fn session_owned_by(
    pool: &DbPool,
    user_id: Uuid,
    session_id: Uuid,
) -> Result<bool, DbError> {
    let mut conn = get_conn(pool).await?;
    let owner: Option<Uuid> = chat_sessions::table
        .filter(chat_sessions::id.eq(session_id))
        .select(chat_sessions::user_id)
        .first(&mut conn)
        .await
        .optional()
        .map_err(db_err)?;
    Ok(owner == Some(user_id))
}
