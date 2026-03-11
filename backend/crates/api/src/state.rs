use std::sync::Arc;

use anyhow::Context;
use sqlx::postgres::PgPoolOptions;
use sqlx::PgPool;

use crate::config::Config;

#[derive(Clone)]
pub struct AppState {
    pub redis: redis::Client,
    pub db: PgPool,
}

impl AppState {
    pub async fn new(config: &Config) -> anyhow::Result<Arc<Self>> {
        let redis = redis::Client::open(config.redis_url.as_str())
            .context("Failed to create Redis client")?;

        // Test Redis connection
        let mut conn = redis.get_multiplexed_async_connection().await
            .context("Failed to connect to Redis")?;
        redis::cmd("PING")
            .query_async::<String>(&mut conn)
            .await
            .context("Failed to ping Redis")?;
        tracing::info!("Connected to Redis at {}", config.redis_url);

        let db = PgPoolOptions::new()
            .max_connections(5)
            .connect(&config.database_url)
            .await
            .context("Failed to connect to Postgres")?;
        tracing::info!("Connected to Postgres at {}", config.database_url);

        Ok(Arc::new(Self { redis, db }))
    }
}
