use anyhow::{Context, Result};
use redis::AsyncCommands;

use shared::redis_keys;

use crate::transform::TransformedData;

pub async fn load_to_redis(client: &redis::Client, data: &TransformedData) -> Result<()> {
    let mut conn = client
        .get_multiplexed_async_connection()
        .await
        .context("Failed to connect to Redis for loading")?;

    tracing::info!("Loading data into Redis...");

    // Test connectivity first
    redis::cmd("PING")
        .query_async::<String>(&mut conn)
        .await
        .context("Redis PING failed")?;
    tracing::info!("Redis connection verified");

    // pokemon:list - may be large, use cmd directly
    let pokemon_list_json =
        serde_json::to_string(&data.pokemon_summaries).context("serialize pokemon list")?;
    tracing::info!("pokemon:list JSON size: {} bytes", pokemon_list_json.len());
    redis::cmd("SET")
        .arg(redis_keys::POKEMON_LIST)
        .arg(pokemon_list_json.as_bytes())
        .query_async::<String>(&mut conn)
        .await
        .context("Failed to write pokemon:list")?;
    tracing::info!("Wrote pokemon:list");

    // pokemon:{id} for each detail
    for detail in &data.pokemon_details {
        let key = redis_keys::pokemon_detail(detail.id);
        let json = serde_json::to_string(detail)
            .with_context(|| format!("serialize pokemon {}", detail.id))?;
        redis::cmd("SET")
            .arg(&key)
            .arg(json.as_bytes())
            .query_async::<String>(&mut conn)
            .await
            .with_context(|| format!("Failed to write {}", key))?;
    }
    tracing::info!(
        "Loaded {} pokemon summaries + details",
        data.pokemon_details.len()
    );

    // type:list
    let type_list_json =
        serde_json::to_string(&data.type_refs).context("serialize type list")?;
    conn.set::<_, _, ()>(redis_keys::TYPE_LIST, &type_list_json)
        .await
        .context("Failed to write type:list")?;

    // type:efficacy
    let efficacy_json =
        serde_json::to_string(&data.type_efficacy).context("serialize type efficacy")?;
    conn.set::<_, _, ()>(redis_keys::TYPE_EFFICACY, &efficacy_json)
        .await
        .context("Failed to write type:efficacy")?;

    // type:{id}:pokemon
    for (type_id, pokemon) in &data.type_pokemon_map {
        let key = redis_keys::type_pokemon(*type_id);
        let json = serde_json::to_string(pokemon)
            .with_context(|| format!("serialize type {} pokemon", type_id))?;
        conn.set::<_, _, ()>(&key, &json)
            .await
            .with_context(|| format!("Failed to write {}", key))?;
    }

    // move:list
    let move_list_json =
        serde_json::to_string(&data.move_summaries).context("serialize move list")?;
    conn.set::<_, _, ()>(redis_keys::MOVE_LIST, &move_list_json)
        .await
        .context("Failed to write move:list")?;

    tracing::info!(
        "Loaded {} types, {} efficacy entries, {} moves",
        data.type_refs.len(),
        data.type_efficacy.len(),
        data.move_summaries.len(),
    );

    Ok(())
}
