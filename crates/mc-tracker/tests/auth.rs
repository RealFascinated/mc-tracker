use mc_test_support as common;

use axum::body::Body;
use axum::http::{Request, StatusCode};
use tower::ServiceExt;

#[tokio::test]
async fn login_me_logout_flow() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool, manager).await;
    let cookie = common::login_admin(&app).await;

    let me = app
        .clone()
        .oneshot(
            Request::builder()
                .uri("/auth/me")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(me.status(), StatusCode::OK);
    let body: serde_json::Value = serde_json::from_slice(
        &axum::body::to_bytes(me.into_body(), usize::MAX)
            .await
            .unwrap(),
    )
    .unwrap();
    assert_eq!(body["email"], "admin");
    assert_eq!(body["role"], "admin");

    let logout = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/logout")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(logout.status(), StatusCode::NO_CONTENT);

    let me_after = app
        .oneshot(
            Request::builder()
                .uri("/auth/me")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(me_after.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn admin_routes_require_auth() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool, manager).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/admin/servers")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn public_servers_stay_public() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool, manager).await;

    let response = app
        .oneshot(
            Request::builder()
                .uri("/servers?sort=players&order=desc")
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);
}

#[tokio::test]
async fn login_sets_secure_session_cookie_flags() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool, manager).await;

    let body = serde_json::json!({ "username": "admin", "password": "adminpass" });
    let response = app
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(body.to_string()))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::OK);

    let cookie = response
        .headers()
        .get("set-cookie")
        .unwrap()
        .to_str()
        .unwrap();
    assert!(cookie.contains("HttpOnly"));
    assert!(cookie.contains("SameSite=Strict"));
    assert!(cookie.contains("mc_tracker_session="));
}

#[tokio::test]
async fn change_password_rejects_wrong_current_password() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool.clone(), manager).await;
    let cookie = common::login_admin(&app).await;

    let response = app
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/auth/password")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"currentPassword":"wrong","newPassword":"newadminpass"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn change_password_updates_credentials() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool, manager).await;
    let cookie = common::login_admin(&app).await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("PATCH")
                .uri("/auth/password")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(
                    r#"{"currentPassword":"adminpass","newPassword":"rotatedpass"}"#,
                ))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let old_login = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/login")
                .header("content-type", "application/json")
                .body(Body::from(r#"{"username":"admin","password":"adminpass"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(old_login.status(), StatusCode::UNAUTHORIZED);

    let new_cookie = common::login_as(&app, "admin", "rotatedpass").await;
    let me = app
        .oneshot(
            Request::builder()
                .uri("/auth/me")
                .header("cookie", new_cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(me.status(), StatusCode::OK);
}

#[tokio::test]
async fn revoked_session_rejected_after_logout() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool, manager).await;
    let cookie = common::login_admin(&app).await;

    let logout = app
        .clone()
        .oneshot(
            Request::builder()
                .method("POST")
                .uri("/auth/logout")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(logout.status(), StatusCode::NO_CONTENT);

    let me = app
        .oneshot(
            Request::builder()
                .uri("/auth/me")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(me.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn delete_account_removes_user_and_clears_session() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;
    common::create_user(&pool, "user@example.com", "userpass", mc_db::UserRole::User).await;

    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool.clone(), manager).await;
    let cookie = common::login_as(&app, "user@example.com", "userpass").await;

    let response = app
        .clone()
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/auth/account")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"password":"userpass"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::NO_CONTENT);

    let me = app
        .oneshot(
            Request::builder()
                .uri("/auth/me")
                .header("cookie", &cookie)
                .body(Body::empty())
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(me.status(), StatusCode::UNAUTHORIZED);

    let err = mc_db::db::repos::users::get_by_username(&pool, "user@example.com")
        .await
        .unwrap_err();
    assert!(matches!(err, mc_db::DbError::NotFound(_)));
}

#[tokio::test]
async fn delete_account_rejects_wrong_password() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;
    common::create_user(&pool, "user@example.com", "userpass", mc_db::UserRole::User).await;

    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool, manager).await;
    let cookie = common::login_as(&app, "user@example.com", "userpass").await;

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/auth/account")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"password":"wrong"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::UNAUTHORIZED);
}

#[tokio::test]
async fn delete_account_forbids_only_admin() {
    let (_postgres, database_url) = common::start_postgres().await;
    let pool = common::setup_pool(&database_url).await;
    common::bootstrap_admin(&pool).await;

    let manager = common::manager_from_pool(&pool, "development").await;
    let app = common::build_app(pool.clone(), manager).await;
    let cookie = common::login_admin(&app).await;

    let response = app
        .oneshot(
            Request::builder()
                .method("DELETE")
                .uri("/auth/account")
                .header("cookie", &cookie)
                .header("content-type", "application/json")
                .body(Body::from(r#"{"password":"adminpass"}"#))
                .unwrap(),
        )
        .await
        .unwrap();
    assert_eq!(response.status(), StatusCode::FORBIDDEN);

    let admin = mc_db::db::repos::users::get_by_username(&pool, "admin")
        .await
        .unwrap();
    assert_eq!(admin.username, "admin");
}

