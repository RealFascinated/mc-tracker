use argon2::{password_hash::SaltString, Argon2, PasswordHash, PasswordHasher, PasswordVerifier};
use chrono::Utc;
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use rand::rngs::OsRng;
use uuid::Uuid;

use crate::db::schema::users;
use crate::db::DbPool;
use crate::error::DbError;
use crate::model::{User, UserFlags, UserRole};

use super::{db_err, get_conn};

type UserRow = (
    Uuid,
    String,
    String,
    String,
    i64,
    chrono::DateTime<Utc>,
    chrono::DateTime<Utc>,
);

const USER_COLUMNS: (
    users::id,
    users::username,
    users::password_hash,
    users::role,
    users::flags,
    users::created_at,
    users::updated_at,
) = (
    users::id,
    users::username,
    users::password_hash,
    users::role,
    users::flags,
    users::created_at,
    users::updated_at,
);

fn row_to_user(row: UserRow) -> Result<User, DbError> {
    Ok(User {
        id: row.0,
        username: row.1,
        password_hash: row.2,
        role: UserRole::from_db(&row.3).map_err(DbError::InvalidSettings)?,
        flags: UserFlags::from_db(row.4),
        created_at: row.5,
        updated_at: row.6,
    })
}

pub fn hash_password(password: &str) -> Result<String, DbError> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|hash| hash.to_string())
        .map_err(DbError::database)
}

pub fn verify_password(password: &str, password_hash: &str) -> Result<bool, DbError> {
    let parsed = PasswordHash::new(password_hash).map_err(DbError::database)?;
    Ok(Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .is_ok())
}

pub async fn count(pool: &DbPool) -> Result<i64, DbError> {
    let mut conn = get_conn(pool).await?;
    users::table
        .count()
        .get_result(&mut conn)
        .await
        .map_err(db_err)
}

pub async fn list(pool: &DbPool) -> Result<Vec<User>, DbError> {
    let mut conn = get_conn(pool).await?;
    let rows = users::table
        .select(USER_COLUMNS)
        .order(users::username.asc())
        .load::<UserRow>(&mut conn)
        .await
        .map_err(db_err)?;

    rows.into_iter().map(row_to_user).collect()
}

pub async fn get_by_id(pool: &DbPool, id: Uuid) -> Result<User, DbError> {
    let mut conn = get_conn(pool).await?;
    let row = users::table
        .filter(users::id.eq(id))
        .select(USER_COLUMNS)
        .first::<UserRow>(&mut conn)
        .await
        .optional()
        .map_err(db_err)?;

    match row {
        Some(row) => row_to_user(row),
        None => Err(DbError::NotFound(format!("user {id}"))),
    }
}

pub async fn get_by_username(pool: &DbPool, username: &str) -> Result<User, DbError> {
    let mut conn = get_conn(pool).await?;
    let row = users::table
        .filter(users::username.eq(username))
        .select(USER_COLUMNS)
        .first::<UserRow>(&mut conn)
        .await
        .optional()
        .map_err(db_err)?;

    match row {
        Some(row) => row_to_user(row),
        None => Err(DbError::NotFound(format!("user {username}"))),
    }
}

pub async fn create(
    pool: &DbPool,
    username: &str,
    password: &str,
    role: UserRole,
) -> Result<User, DbError> {
    let mut conn = get_conn(pool).await?;
    let id = Uuid::new_v4();
    let now = Utc::now();
    let password_hash = hash_password(password)?;

    diesel::insert_into(users::table)
        .values((
            users::id.eq(id),
            users::username.eq(username),
            users::password_hash.eq(&password_hash),
            users::role.eq(role.as_str()),
            users::flags.eq(0_i64),
            users::created_at.eq(now),
            users::updated_at.eq(now),
        ))
        .execute(&mut conn)
        .await
        .map_err(|e| {
            if matches!(
                &e,
                diesel::result::Error::DatabaseError(
                    diesel::result::DatabaseErrorKind::UniqueViolation,
                    _
                )
            ) {
                DbError::Conflict(format!("username already exists: {username}"))
            } else {
                db_err(e)
            }
        })?;

    get_by_username(pool, username).await
}

pub async fn update_password(pool: &DbPool, id: Uuid, new_password: &str) -> Result<(), DbError> {
    let mut conn = get_conn(pool).await?;
    let password_hash = hash_password(new_password)?;
    let now = Utc::now();

    let updated = diesel::update(users::table.filter(users::id.eq(id)))
        .set((
            users::password_hash.eq(password_hash),
            users::updated_at.eq(now),
        ))
        .execute(&mut conn)
        .await
        .map_err(db_err)?;

    if updated == 0 {
        return Err(DbError::NotFound(format!("user {id}")));
    }
    Ok(())
}

pub async fn update_role(pool: &DbPool, id: Uuid, role: UserRole) -> Result<(), DbError> {
    let mut conn = get_conn(pool).await?;
    let now = Utc::now();

    let updated = diesel::update(users::table.filter(users::id.eq(id)))
        .set((users::role.eq(role.as_str()), users::updated_at.eq(now)))
        .execute(&mut conn)
        .await
        .map_err(db_err)?;

    if updated == 0 {
        return Err(DbError::NotFound(format!("user {id}")));
    }
    Ok(())
}

pub async fn update_flags(pool: &DbPool, id: Uuid, flags: UserFlags) -> Result<(), DbError> {
    let mut conn = get_conn(pool).await?;
    let now = Utc::now();

    let updated = diesel::update(users::table.filter(users::id.eq(id)))
        .set((users::flags.eq(flags.to_db()), users::updated_at.eq(now)))
        .execute(&mut conn)
        .await
        .map_err(db_err)?;

    if updated == 0 {
        return Err(DbError::NotFound(format!("user {id}")));
    }
    Ok(())
}
