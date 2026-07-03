pub mod bootstrap;
pub mod db;
pub mod error;
pub mod model;

pub use bootstrap::{ensure_admin_user, setup_database, BootstrapConfig};
pub use db::{create_pool, health_check, run_migrations, DbContext, DbPool, PoolSettings};
pub use error::DbError;
pub use model::{AppSettings, Platform, Server, User, UserFlags, UserRole};
