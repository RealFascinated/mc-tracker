use std::sync::Arc;

use clap::Parser;
use mc_db::{
    db::repos::{servers, settings},
    ensure_admin_user, setup_database, BootstrapConfig, DbContext, PoolSettings,
};
use mc_geo::{GeoConfig, GeoService};
use mc_tracker::auth::{AuthContext, LoginRateLimiter, SessionManager};
use mc_tracker::api::{router, AppState};
use mc_tracker::manager::{spawn_push_loop, ServerManager};
use tokio::signal;
use tokio::sync::RwLock;
use tracing::info;

#[derive(Parser, Debug)]
#[command(name = "mc-tracker", about = "Minecraft server tracker")]
struct Config {
    /// PostgreSQL connection URL
    #[arg(long, env = "DATABASE_URL")]
    database_url: String,

    /// Connection pool size
    #[arg(long, env = "MC_TRACKER_DB_POOL_SIZE", default_value = "16")]
    db_pool_size: u32,

    /// Bootstrap admin username (only when users table is empty)
    #[arg(long, env = "MC_TRACKER_ADMIN_USERNAME")]
    admin_username: Option<String>,

    /// Bootstrap admin password (only when users table is empty)
    #[arg(long, env = "MC_TRACKER_ADMIN_PASSWORD")]
    admin_password: Option<String>,

    /// MaxMind license key for GeoLite2-ASN downloads
    #[arg(long, env = "MAXMIND_LICENSE_KEY")]
    maxmind_license_key: String,

    /// MaxMind GeoLite2-ASN database directory
    #[arg(long, env = "MAXMIND_DATABASE_DIR", default_value = "databases")]
    maxmind_database_dir: String,

    /// Optional Bearer token for VictoriaMetrics push and query
    #[arg(long, env = "VICTORIAMETRICS_AUTH_TOKEN")]
    victoriametrics_auth_token: Option<String>,

    /// VictoriaMetrics / Prometheus `environment` label (metrics push + queries).
    #[arg(long, env = "ENVIRONMENT", default_value = "production")]
    environment: String,

    /// HMAC secret for signing session cookies
    #[arg(long, env = "SESSION_SECRET")]
    session_secret: String,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info".into()),
        )
        .init();

    let config = Config::parse();
    let pool = setup_database(
        &config.database_url,
        PoolSettings {
            max_size: config.db_pool_size,
            ..PoolSettings::default()
        },
    )
    .await?;

    ensure_admin_user(
        &pool,
        &BootstrapConfig {
            admin_username: config.admin_username.unwrap_or_default(),
            admin_password: config.admin_password.unwrap_or_default(),
        },
    )
    .await?;

    let _db = DbContext::new(Arc::new(pool.clone()));
    let app_settings = settings::load_all(&pool).await?;
    let server_list = servers::list(&pool).await?;

    let geo = GeoService::initialize(GeoConfig {
        license_key: config.maxmind_license_key,
        database_dir: config.maxmind_database_dir.clone(),
    })
    .await?;
    geo.spawn_refresh_scheduler();

    let settings = Arc::new(RwLock::new(app_settings.clone()));
    let server_count = server_list.len();
    let manager = Arc::new(ServerManager::new(
        server_list,
        Arc::clone(&settings),
        Arc::clone(&geo),
        config.victoriametrics_auth_token.clone(),
        &app_settings,
        &config.environment,
    ));

    let push_loop = spawn_push_loop(Arc::clone(&manager));

    let bind_addr = app_settings
        .api_socket_addr()
        .map_err(anyhow::Error::msg)?;
    let secure_cookies = config.environment != "development";
    let sessions = Arc::new(SessionManager::new(
        config.session_secret.as_bytes(),
        secure_cookies,
    ));
    let auth = AuthContext {
        sessions,
        rate_limiter: LoginRateLimiter::new(),
    };

    let app = router(
        AppState {
            pool: pool.clone(),
            manager,
            geo,
            auth,
        },
        &app_settings,
        &config.environment,
    )
    .map_err(anyhow::Error::msg)?;

    info!(
        bind = %bind_addr,
        environment = %config.environment,
        servers = server_count,
        maxmind_ready = true,
        "mc-tracker started"
    );

    let listener = tokio::net::TcpListener::bind(bind_addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;

    info!("http server stopped, draining push cycle");
    push_loop.drain().await;
    info!("shutdown complete");

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        signal::ctrl_c()
            .await
            .expect("failed to install Ctrl+C handler");
    };

    #[cfg(unix)]
    let terminate = async {
        signal::unix::signal(signal::unix::SignalKind::terminate())
            .expect("failed to install SIGTERM handler")
            .recv()
            .await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        _ = ctrl_c => info!("received SIGINT"),
        _ = terminate => info!("received SIGTERM"),
    }
}
