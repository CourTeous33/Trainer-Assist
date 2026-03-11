pub mod moves;
pub mod pokemon;
pub mod teams;
pub mod types;

use std::sync::Arc;

use axum::{routing::get, Json, Router};
use serde_json::{json, Value};

use crate::state::AppState;

async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

pub fn build_router(state: Arc<AppState>) -> Router {
    let api_v1 = Router::new()
        .route("/health", get(health))
        // Pokemon routes
        .route("/pokemon", get(pokemon::list_pokemon))
        .route("/pokemon/{id}", get(pokemon::get_pokemon))
        // Type routes
        .route("/types", get(types::list_types))
        .route("/types/efficacy", get(types::get_type_efficacy))
        .route("/types/{id}/pokemon", get(types::get_type_pokemon))
        // Move routes
        .route("/moves", get(moves::list_moves))
        .with_state(state);

    Router::new().nest("/api/v1", api_v1)
}
