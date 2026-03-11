use std::sync::Arc;

use axum::{
    extract::{Query, State},
    Json,
};
use redis::AsyncCommands;
use serde::Deserialize;

use shared::models::MoveSummary;
use shared::redis_keys;

use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct MoveListParams {
    pub search: Option<String>,
    pub type_id: Option<i32>,
    pub damage_class: Option<String>,
}

pub async fn list_moves(
    State(state): State<Arc<AppState>>,
    Query(params): Query<MoveListParams>,
) -> Result<Json<Vec<MoveSummary>>, AppError> {
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let data: String = conn.get(redis_keys::MOVE_LIST).await.map_err(|e| {
        tracing::error!("Failed to read move list from Redis: {e}");
        AppError::internal("Failed to read move data")
    })?;

    let all: Vec<MoveSummary> = serde_json::from_str(&data)?;

    let filtered: Vec<MoveSummary> = all
        .into_iter()
        .filter(|m| {
            if let Some(ref search) = params.search {
                let search_lower = search.to_lowercase();
                if !m.name.to_lowercase().contains(&search_lower) {
                    return false;
                }
            }
            if let Some(type_id) = params.type_id {
                if m.type_ref.id != type_id {
                    return false;
                }
            }
            if let Some(ref damage_class) = params.damage_class {
                let dc_lower = damage_class.to_lowercase();
                if m.damage_class.to_lowercase() != dc_lower {
                    return false;
                }
            }
            true
        })
        .collect();

    Ok(Json(filtered))
}
