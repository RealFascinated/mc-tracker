use mc_test_support::{setup_pool, start_postgres};

#[tokio::test]
async fn migrations_apply_idempotently() {
    let (_postgres, database_url) = start_postgres().await;

    mc_db::run_migrations(&database_url).await.unwrap();
    mc_db::run_migrations(&database_url).await.unwrap();
}

#[tokio::test]
async fn health_check_succeeds() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;

    assert!(mc_db::health_check(&pool).await);
}

#[tokio::test]
async fn settings_seed_loads_from_db() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;

    let timeout = mc_db::db::repos::settings::get(&pool, "pinger_timeout_ms")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(timeout, "5000");

    let signup = mc_db::db::repos::settings::get(&pool, "sign_up_enabled")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(signup, "false");
}

#[tokio::test]
async fn settings_get_set_round_trip() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;

    mc_db::db::repos::settings::set(&pool, "pinger_timeout_ms", "6000")
        .await
        .unwrap();
    let value = mc_db::db::repos::settings::get(&pool, "pinger_timeout_ms")
        .await
        .unwrap()
        .unwrap();
    assert_eq!(value, "6000");
}

#[tokio::test]
async fn servers_crud() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;

    let created = mc_db::db::repos::servers::insert(
        &pool,
        mc_db::db::repos::servers::NewServer {
            id: None,
            name: "Hypixel",
            host: "mc.hypixel.net",
            port: None,
            platform: mc_db::Platform::Pc,
        },
    )
    .await
    .unwrap();

    let listed = mc_db::db::repos::servers::list(&pool).await.unwrap();
    assert_eq!(listed.len(), 1);
    assert_eq!(listed[0].id, created.id);

    let fetched = mc_db::db::repos::servers::get(&pool, created.id)
        .await
        .unwrap();
    assert_eq!(fetched.name, "Hypixel");

    mc_db::db::repos::servers::update(
        &pool,
        created.id,
        mc_db::db::repos::servers::UpdateServer {
            name: Some("Hypixel Updated"),
            host: None,
            port: None,
            platform: None,
            paused: None,
        },
    )
    .await
    .unwrap();

    let updated = mc_db::db::repos::servers::get(&pool, created.id)
        .await
        .unwrap();
    assert_eq!(updated.name, "Hypixel Updated");

    assert!(mc_db::db::repos::servers::delete(&pool, created.id)
        .await
        .unwrap());
    assert!(mc_db::db::repos::servers::list(&pool)
        .await
        .unwrap()
        .is_empty());
}

#[tokio::test]
async fn servers_unique_host_port_platform_violation() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;

    let new = mc_db::db::repos::servers::NewServer {
        id: None,
        name: "A",
        host: "example.com",
        port: Some(25565),
        platform: mc_db::Platform::Pc,
    };
    mc_db::db::repos::servers::insert(&pool, new).await.unwrap();

    let err = mc_db::db::repos::servers::insert(
        &pool,
        mc_db::db::repos::servers::NewServer {
            id: None,
            name: "B",
            host: "example.com",
            port: Some(25565),
            platform: mc_db::Platform::Pc,
        },
    )
    .await
    .unwrap_err();

    assert!(matches!(err, mc_db::DbError::Conflict(_)));
}

#[tokio::test]
async fn users_create_and_get() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;

    let user =
        mc_db::db::repos::users::create(&pool, "alice", "password123", mc_db::UserRole::User, None)
            .await
            .unwrap();
    assert_eq!(user.username, "alice");

    let fetched = mc_db::db::repos::users::get_by_username(&pool, "alice")
        .await
        .unwrap();
    assert_eq!(fetched.id, user.id);

    assert!(
        mc_db::db::repos::users::verify_password("password123", &fetched.password_hash).unwrap()
    );

    mc_db::db::repos::users::update_password(&pool, user.id, "newpass")
        .await
        .unwrap();
    let updated = mc_db::db::repos::users::get_by_username(&pool, "alice")
        .await
        .unwrap();
    assert!(mc_db::db::repos::users::verify_password("newpass", &updated.password_hash).unwrap());
}

#[tokio::test]
async fn users_wrong_password_fails_verify() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;

    let user =
        mc_db::db::repos::users::create(&pool, "carol", "correcthorse", mc_db::UserRole::User, None)
            .await
            .unwrap();

    assert!(!mc_db::db::repos::users::verify_password("wrong", &user.password_hash).unwrap());
}

#[tokio::test]
async fn users_hash_password_round_trip() {
    let hash = mc_db::db::repos::users::hash_password("secret").unwrap();
    assert!(mc_db::db::repos::users::verify_password("secret", &hash).unwrap());
    assert!(!mc_db::db::repos::users::verify_password("other", &hash).unwrap());
}

#[tokio::test]
async fn users_duplicate_username_fails() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;

    mc_db::db::repos::users::create(&pool, "bob", "pass", mc_db::UserRole::User, None)
        .await
        .unwrap();
    let err = mc_db::db::repos::users::create(&pool, "bob", "pass2", mc_db::UserRole::User, None)
        .await
        .unwrap_err();
    assert!(matches!(err, mc_db::DbError::Conflict(_)));
}

#[tokio::test]
async fn bootstrap_creates_admin_when_empty() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;

    mc_db::ensure_admin_user(
        &pool,
        &mc_db::BootstrapConfig {
            admin_username: "admin".into(),
            admin_password: "adminpass".into(),
        },
    )
    .await
    .unwrap();

    let admin = mc_db::db::repos::users::get_by_username(&pool, "admin")
        .await
        .unwrap();
    assert_eq!(admin.role, mc_db::UserRole::Admin);
}

#[tokio::test]
async fn bootstrap_ignored_when_users_exist() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;

    mc_db::db::repos::users::create(&pool, "existing", "pass", mc_db::UserRole::User, None)
        .await
        .unwrap();

    mc_db::ensure_admin_user(
        &pool,
        &mc_db::BootstrapConfig {
            admin_username: "admin".into(),
            admin_password: "adminpass".into(),
        },
    )
    .await
    .unwrap();

    let err = mc_db::db::repos::users::get_by_username(&pool, "admin")
        .await
        .unwrap_err();
    assert!(matches!(err, mc_db::DbError::NotFound(_)));
}

#[tokio::test]
async fn bootstrap_fails_without_credentials() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;

    let err = mc_db::ensure_admin_user(
        &pool,
        &mc_db::BootstrapConfig {
            admin_username: String::new(),
            admin_password: String::new(),
        },
    )
    .await
    .unwrap_err();
    assert!(matches!(err, mc_db::DbError::Bootstrap(_)));
}

#[tokio::test]
async fn users_delete_by_id_removes_user() {
    let (_postgres, database_url) = start_postgres().await;
    let pool = setup_pool(&database_url).await;

    let user =
        mc_db::db::repos::users::create(&pool, "delete-me", "pass", mc_db::UserRole::User, None)
            .await
            .unwrap();

    mc_db::db::repos::users::delete_by_id(&pool, user.id)
        .await
        .unwrap();

    let err = mc_db::db::repos::users::get_by_id(&pool, user.id)
        .await
        .unwrap_err();
    assert!(matches!(err, mc_db::DbError::NotFound(_)));
}

