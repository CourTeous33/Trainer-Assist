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
    let mut transformed = transform::transform(&parsed);

    // Step 3b: Load nicknames
    let nicknames_path = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .parent().unwrap().parent().unwrap().parent().unwrap()
        .join("data/nicknames.json");
    match std::fs::read_to_string(&nicknames_path) {
        Ok(nicknames_json) => {
            let nicknames: serde_json::Value = serde_json::from_str(&nicknames_json)?;
            if let Some(pokemon_nicks) = nicknames.get("pokemon").and_then(|v| v.as_object()) {
                let mut count = 0;
                for summary in &mut transformed.pokemon_summaries {
                    let key = summary.species_id.to_string();
                    if let Some(entry) = pokemon_nicks.get(&key) {
                        let mut all_nicks: Vec<String> = Vec::new();
                        for lang in &["en", "zh", "ja"] {
                            if let Some(arr) = entry.get(*lang).and_then(|v| v.as_array()) {
                                for nick in arr {
                                    if let Some(s) = nick.as_str() {
                                        if !s.is_empty() {
                                            all_nicks.push(s.to_string());
                                        }
                                    }
                                }
                            }
                        }
                        if !all_nicks.is_empty() {
                            summary.nicknames = Some(all_nicks.join(" "));
                            count += 1;
                        }
                    }
                }
                tracing::info!("Loaded nicknames for {} Pokemon", count);
            }
        }
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => {
            tracing::warn!("Nicknames file not found at {:?}", nicknames_path);
        }
        Err(e) => return Err(e).context("Failed to read nicknames.json"),
    }

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
