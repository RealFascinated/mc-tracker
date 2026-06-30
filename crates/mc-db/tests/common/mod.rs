use mc_db::{DbPool, PoolSettings};
use testcontainers::ImageExt;
use testcontainers::runners::AsyncRunner;
use testcontainers_modules::postgres::Postgres;

pub async fn start_postgres() -> (testcontainers::ContainerAsync<Postgres>, String) {
    let postgres = Postgres::default()
        .with_tag("18-alpine")
        .start()
        .await
        .expect("start postgres container");
    let port = postgres.get_host_port_ipv4(5432).await.unwrap();
    let database_url = format!("postgres://postgres:postgres@127.0.0.1:{port}/postgres");
    (postgres, database_url)
}

pub async fn setup_pool(database_url: &str) -> DbPool {
    mc_db::setup_database(database_url, PoolSettings::default())
        .await
        .expect("setup database")
}
