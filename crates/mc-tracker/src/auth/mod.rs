mod handlers;
mod middleware;
mod rate_limit;
mod session;

pub use handlers::router;
pub use middleware::{require_admin, require_manage_servers, AuthUser};
pub use rate_limit::LoginRateLimiter;
pub use session::SessionManager;

use std::sync::Arc;

#[derive(Clone)]
pub struct AuthContext {
    pub sessions: Arc<SessionManager>,
    pub rate_limiter: Arc<LoginRateLimiter>,
}
