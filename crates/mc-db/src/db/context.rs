use std::sync::Arc;

use super::DbPool;

#[derive(Clone)]
pub struct DbContext {
    pool: Arc<DbPool>,
}

impl DbContext {
    pub fn new(pool: Arc<DbPool>) -> Self {
        Self { pool }
    }

    pub fn pool(&self) -> &DbPool {
        &self.pool
    }

    pub fn pool_arc(&self) -> Arc<DbPool> {
        Arc::clone(&self.pool)
    }
}
