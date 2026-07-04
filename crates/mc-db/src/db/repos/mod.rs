pub mod chat_messages;
pub mod chat_sessions;
pub mod pinned_servers;
pub mod servers;
pub mod settings;
pub mod users;

use diesel_async::AsyncPgConnection;

use crate::db::DbPool;
use crate::error::DbError;

pub(crate) async fn get_conn(
    pool: &DbPool,
) -> Result<impl std::ops::DerefMut<Target = AsyncPgConnection> + Send, DbError> {
    pool.get().await.map_err(DbError::database)
}

pub(crate) fn db_err(e: impl std::fmt::Display) -> DbError {
    DbError::database(e)
}
