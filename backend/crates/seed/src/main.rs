use seed::{fetch, load, parse, transform};

use anyhow::{Context, Result};
use tracing_subscriber::EnvFilter;

#[tokio::main]
async fn main() -> Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::fmt()
        .with_env_filter(
            EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")),
        )
        .init();

    tracing::info!("Starting Pokemon data seed pipeline");

    // Step 1: Fetch CSVs
    tracing::info!("Step 1/4: Fetching CSV files from PokeAPI...");
    let csvs = fetch::fetch_all_csvs().await?;
    tracing::info!("Fetched {} CSV files", csvs.len());

    // Step 2: Parse CSVs
    tracing::info!("Step 2/4: Parsing CSV data...");
    let parsed = parse::parse_all(&csvs)?;
    tracing::info!("Parsing complete");

    // Step 3: Transform
    tracing::info!("Step 3/4: Transforming data into models...");
    let transformed = transform::transform(&parsed);

    // Step 4: Load into Redis
    tracing::info!("Step 4/4: Loading data into Redis...");
    let redis_url = std::env::var("REDIS_URL")
        .unwrap_or_else(|_| "redis://127.0.0.1:6380".to_string());
    let client =
        redis::Client::open(redis_url.as_str()).context("Failed to create Redis client")?;
    load::load_to_redis(&client, &transformed).await?;

    // Summary
    tracing::info!("=== Seed Complete ===");
    tracing::info!("  Pokemon: {}", transformed.pokemon_summaries.len());
    tracing::info!("  Types:   {}", transformed.type_refs.len());
    tracing::info!("  Moves:   {}", transformed.move_summaries.len());
    tracing::info!(
        "  Type efficacy entries: {}",
        transformed.type_efficacy.len()
    );
    tracing::info!(
        "  Type->Pokemon mappings: {}",
        transformed.type_pokemon_map.len()
    );

    Ok(())
}
