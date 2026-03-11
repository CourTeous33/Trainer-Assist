use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Json,
};
use redis::AsyncCommands;

use shared::models::{PokemonSummary, TypeEfficacy, TypeRef};
use shared::redis_keys;

use crate::error::AppError;
use crate::state::AppState;

pub async fn list_types(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TypeRef>>, AppError> {
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let data: String = conn.get(redis_keys::TYPE_LIST).await.map_err(|e| {
        tracing::error!("Failed to read type list from Redis: {e}");
        AppError::internal("Failed to read type data")
    })?;
    let types: Vec<TypeRef> = serde_json::from_str(&data)?;
    Ok(Json(types))
}

pub async fn get_type_efficacy(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<TypeEfficacy>>, AppError> {
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let data: String = conn.get(redis_keys::TYPE_EFFICACY).await.map_err(|e| {
        tracing::error!("Failed to read type efficacy from Redis: {e}");
        AppError::internal("Failed to read type efficacy data")
    })?;
    let efficacy: Vec<TypeEfficacy> = serde_json::from_str(&data)?;
    Ok(Json(efficacy))
}

pub async fn get_type_pokemon(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Result<Json<Vec<PokemonSummary>>, AppError> {
    let mut conn = state.redis.get_multiplexed_async_connection().await?;
    let key = redis_keys::type_pokemon(id);
    let data: Option<String> = conn.get(&key).await?;

    match data {
        Some(json_str) => {
            let pokemon: Vec<PokemonSummary> = serde_json::from_str(&json_str)?;
            Ok(Json(pokemon))
        }
        None => Err(AppError::not_found(format!(
            "No pokemon found for type id {id}"
        ))),
    }
}
