use chrono::{DateTime, Utc};
use diesel::prelude::*;
use diesel_async::RunQueryDsl;
use uuid::Uuid;

use crate::db::schema::monitored_server_events;
use crate::db::DbPool;
use crate::error::DbError;
use crate::model::{MonitoredServerEvent, MonitoredServerEventType};

use super::{db_err, get_conn};

type EventRow = (Uuid, Uuid, String, String, DateTime<Utc>);

fn row_to_event(row: EventRow) -> Result<MonitoredServerEvent, DbError> {
    Ok(MonitoredServerEvent {
        id: row.0,
        server_id: row.1,
        server_name: row.2,
        event_type: MonitoredServerEventType::from_db(&row.3)
            .map_err(DbError::Database)?,
        occurred_at: row.4,
    })
}

pub struct NewMonitoredServerEvent<'a> {
    pub server_id: Uuid,
    pub server_name: &'a str,
    pub event_type: MonitoredServerEventType,
    pub occurred_at: Option<DateTime<Utc>>,
}

pub async fn insert(
    pool: &DbPool,
    event: NewMonitoredServerEvent<'_>,
) -> Result<MonitoredServerEvent, DbError> {
    let mut conn = get_conn(pool).await?;
    let occurred_at = event.occurred_at.unwrap_or_else(Utc::now);

    let row: EventRow = diesel::insert_into(monitored_server_events::table)
        .values((
            monitored_server_events::server_id.eq(event.server_id),
            monitored_server_events::server_name.eq(event.server_name),
            monitored_server_events::event_type.eq(event.event_type.as_str()),
            monitored_server_events::occurred_at.eq(occurred_at),
        ))
        .returning((
            monitored_server_events::id,
            monitored_server_events::server_id,
            monitored_server_events::server_name,
            monitored_server_events::event_type,
            monitored_server_events::occurred_at,
        ))
        .get_result(&mut conn)
        .await
        .map_err(db_err)?;

    row_to_event(row)
}

pub async fn list_between(
    pool: &DbPool,
    from: DateTime<Utc>,
    to: DateTime<Utc>,
) -> Result<Vec<MonitoredServerEvent>, DbError> {
    let mut conn = get_conn(pool).await?;

    let rows: Vec<EventRow> = monitored_server_events::table
        .filter(monitored_server_events::occurred_at.ge(from))
        .filter(monitored_server_events::occurred_at.le(to))
        .order(monitored_server_events::occurred_at.asc())
        .select((
            monitored_server_events::id,
            monitored_server_events::server_id,
            monitored_server_events::server_name,
            monitored_server_events::event_type,
            monitored_server_events::occurred_at,
        ))
        .load(&mut conn)
        .await
        .map_err(db_err)?;

    rows.into_iter().map(row_to_event).collect()
}
