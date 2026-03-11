use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    Json,
};
use redis::AsyncCommands;
use serde::{Deserialize, Serialize};

use shared::models::{PokemonDetail, PokemonSummary};
use shared::redis_keys;

use crate::error::AppError;
use crate::state::AppState;

#[derive(Debug, Deserialize)]
pub struct ListParams {
    #[serde(default)]
    pub offset: usize,
    #[serde(default = "default_limit")]
    pub limit: usize,
    #[serde(rename = "type")]
    pub type_filter: Option<String>,
    pub type2: Option<String>,
    pub search: Option<String>,
    pub generation: Option<i32>,
}

fn default_limit() -> usize {
    20
}

#[derive(Debug, Serialize)]
pub struct PaginatedResponse {
    pub items: Vec<PokemonSummary>,
    pub total: usize,
}

pub async fn list_pokemon(
    State(state): State<Arc<AppState>>,
    Query(params): Query<ListParams>,
) -> Result<Json<PaginatedResponse>, AppError> {
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let data: String = conn.get(redis_keys::POKEMON_LIST).await.map_err(|e| {
        tracing::error!("Failed to read pokemon list from Redis: {e}");
        AppError::internal("Failed to read pokemon data")
    })?;

    let all: Vec<PokemonSummary> = serde_json::from_str(&data)?;

    let search_lower = params.search.as_ref().map(|s| s.to_lowercase());

    let filtered: Vec<PokemonSummary> = all
        .into_iter()
        .filter(|p| {
            if let Some(ref q) = search_lower {
                let matched = p.names.matches_search(q)
                    || p.nicknames.as_ref().map_or(false, |n| n.to_lowercase().contains(q.as_str()));
                if !matched {
                    return false;
                }
            }
            if let Some(ref type_filter) = params.type_filter {
                let type_lower = type_filter.to_lowercase();
                if !p.types.iter().any(|t| t.name.to_lowercase() == type_lower) {
                    return false;
                }
            }
            if let Some(ref type2) = params.type2 {
                let type2_lower = type2.to_lowercase();
                if !p.types.iter().any(|t| t.name.to_lowercase() == type2_lower) {
                    return false;
                }
            }
            true
        })
        .collect();

    // For generation filtering, we need the detail data which has generation info.
    // Since PokemonSummary doesn't have generation, we skip generation filtering here
    // unless we extend the summary model. For now, generation filter is a no-op on the list.
    // A more complete implementation would store generation in PokemonSummary or use a
    // separate index.

    let total = filtered.len();
    let items: Vec<PokemonSummary> = filtered
        .into_iter()
        .skip(params.offset)
        .take(params.limit)
        .collect();

    Ok(Json(PaginatedResponse { items, total }))
}

pub async fn get_pokemon(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Result<Json<PokemonDetail>, AppError> {
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let key = redis_keys::pokemon_detail(id);
    let data: Option<String> = conn.get(&key).await?;

    match data {
        Some(json_str) => {
            let detail: PokemonDetail = serde_json::from_str(&json_str)?;
            Ok(Json(detail))
        }
        None => Err(AppError::not_found(format!("Pokemon with id {id} not found"))),
    }
}
