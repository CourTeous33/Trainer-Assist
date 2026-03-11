use std::collections::HashMap;

use anyhow::{Context, Result};
use futures::future::join_all;
use indicatif::{ProgressBar, ProgressStyle};

const BASE_URL: &str =
    "https://raw.githubusercontent.com/PokeAPI/pokeapi/master/data/v2/csv/";

const CSV_FILES: &[&str] = &[
    "pokemon.csv",
    "pokemon_types.csv",
    "pokemon_stats.csv",
    "pokemon_species.csv",
    "pokemon_species_names.csv",
    "types.csv",
    "type_names.csv",
    "type_efficacy.csv",
    "moves.csv",
    "move_names.csv",
    "pokemon_moves.csv",
    "stats.csv",
    "abilities.csv",
    "ability_names.csv",
    "pokemon_abilities.csv",
    "ability_flavor_text.csv",
    "pokemon_forms.csv",
    "pokemon_form_names.csv",
];

pub async fn fetch_all_csvs() -> Result<HashMap<String, String>> {
    let client = reqwest::Client::new();

    let pb = ProgressBar::new(CSV_FILES.len() as u64);
    pb.set_style(
        ProgressStyle::with_template(
            "{spinner:.green} [{bar:40.cyan/blue}] {pos}/{len} {msg}",
        )
        .unwrap()
        .progress_chars("#>-"),
    );

    let futures: Vec<_> = CSV_FILES
        .iter()
        .map(|&file| {
            let client = client.clone();
            let pb = pb.clone();
            async move {
                let url = format!("{BASE_URL}{file}");
                let body = client
                    .get(&url)
                    .send()
                    .await
                    .with_context(|| format!("Failed to download {file}"))?
                    .text()
                    .await
                    .with_context(|| format!("Failed to read body for {file}"))?;

                tracing::info!("Downloaded {file} ({} bytes)", body.len());
                pb.inc(1);
                Ok::<_, anyhow::Error>((file.to_string(), body))
            }
        })
        .collect();

    let results: Vec<_> = join_all(futures).await;
    let mut map = HashMap::new();
    for result in results {
        let (name, body) = result?;
        map.insert(name, body);
    }

    pb.finish_with_message("All CSVs downloaded");
    Ok(map)
}
