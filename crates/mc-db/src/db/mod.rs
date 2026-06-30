pub mod context;
pub mod repos;
pub mod schema;

pub use context::DbContext;

use diesel::connection::CacheSize;
use diesel_async::async_connection_wrapper::AsyncConnectionWrapper;
use diesel_async::pooled_connection::deadpool::Pool;
use diesel_async::pooled_connection::{AsyncDieselConnectionManager, ManagerConfig};
use diesel_async::{AsyncConnection, AsyncPgConnection, RunQueryDsl};
use diesel_migrations::{embed_migrations, EmbeddedMigrations, MigrationHarness};
use futures::FutureExt;

pub const MIGRATIONS: EmbeddedMigrations = embed_migrations!("src/db/migrations");

pub type DbPool = Pool<AsyncPgConnection>;

#[derive(Debug, Clone, Copy)]
pub struct PoolSettings {
    pub max_size: u32,
    pub prepared_statement_cache: bool,
}

impl Default for PoolSettings {
    fn default() -> Self {
        Self {
            max_size: 16,
            prepared_statement_cache: true,
        }
    }
}

pub async fn create_pool(
    database_url: &str,
    settings: PoolSettings,
) -> Result<DbPool, anyhow::Error> {
    let cache_size = if settings.prepared_statement_cache {
        CacheSize::Unbounded
    } else {
        CacheSize::Disabled
    };

    let mut manager_config = ManagerConfig::<AsyncPgConnection>::default();
    manager_config.custom_setup = Box::new(move |url| {
        async move {
            let mut conn = AsyncPgConnection::establish(url).await?;
            conn.set_prepared_statement_cache_size(cache_size);
            Ok(conn)
        }
        .boxed()
    });

    let config = AsyncDieselConnectionManager::<AsyncPgConnection>::new_with_config(
        database_url,
        manager_config,
    );
    let pool = Pool::builder(config)
        .max_size(settings.max_size as usize)
        .build()?;
    Ok(pool)
}

pub async fn run_migrations(database_url: &str) -> Result<(), anyhow::Error> {
    let conn = AsyncPgConnection::establish(database_url).await?;
    tokio::task::spawn_blocking(move || {
        let mut wrapper: AsyncConnectionWrapper<AsyncPgConnection> =
            AsyncConnectionWrapper::from(conn);
        wrapper
            .run_pending_migrations(MIGRATIONS)
            .map(|_| ())
            .map_err(|e| anyhow::anyhow!("migration failed: {e}"))
    })
    .await??;
    Ok(())
}

pub async fn health_check(pool: &DbPool) -> bool {
    use diesel::sql_query;

    let Ok(mut conn) = pool.get().await else {
        return false;
    };
    RunQueryDsl::execute(sql_query("SELECT 1"), &mut conn)
        .await
        .is_ok()
}
