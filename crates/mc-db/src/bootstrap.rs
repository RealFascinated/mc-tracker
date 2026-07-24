use crate::db::repos::users;
use crate::db::{DbPool, PoolSettings};
use crate::error::DbError;
use crate::model::UserRole;

#[derive(Debug, Clone)]
pub struct BootstrapConfig {
    pub admin_username: String,
    pub admin_password: String,
}

pub async fn ensure_admin_user(pool: &DbPool, config: &BootstrapConfig) -> Result<(), DbError> {
    let count = users::count(pool).await?;
    if count > 0 {
        return Ok(());
    }

    if config.admin_username.trim().is_empty() {
        return Err(DbError::Bootstrap(
            "MC_TRACKER_ADMIN_USERNAME is required when users table is empty".into(),
        ));
    }
    if config.admin_password.is_empty() {
        return Err(DbError::Bootstrap(
            "MC_TRACKER_ADMIN_PASSWORD is required when users table is empty".into(),
        ));
    }

    users::create(
        pool,
        &config.admin_username,
        &config.admin_password,
        UserRole::Admin,
        None,
    )
    .await?;
    Ok(())
}

pub async fn setup_database(
    database_url: &str,
    pool_settings: PoolSettings,
) -> Result<DbPool, DbError> {
    crate::run_migrations(database_url)
        .await
        .map_err(DbError::database)?;
    crate::create_pool(database_url, pool_settings)
        .await
        .map_err(DbError::database)
}
