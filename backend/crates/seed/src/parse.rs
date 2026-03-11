use std::collections::HashMap;

use anyhow::{Context, Result};
use serde::Deserialize;

// ---------------------------------------------------------------------------
// CSV row structs
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
pub struct PokemonRow {
    pub id: i32,
    pub identifier: String,
    pub species_id: i32,
    pub height: i32,
    pub weight: i32,
    pub is_default: i32,
    // remaining columns ignored
}

#[derive(Debug, Deserialize)]
pub struct PokemonTypeRow {
    pub pokemon_id: i32,
    pub type_id: i32,
    pub slot: i32,
}

#[derive(Debug, Deserialize)]
pub struct PokemonStatRow {
    pub pokemon_id: i32,
    pub stat_id: i32,
    pub base_stat: i32,
    // effort column ignored
}

#[derive(Debug, Deserialize)]
pub struct PokemonSpeciesRow {
    pub id: i32,
    #[serde(default)]
    pub identifier: String,
    pub generation_id: i32,
    // remaining columns ignored
}

#[derive(Debug, Deserialize)]
pub struct PokemonSpeciesNameRow {
    pub pokemon_species_id: i32,
    pub local_language_id: i32,
    pub name: String,
    // genus column ignored
}

#[derive(Debug, Deserialize)]
pub struct TypeRow {
    pub id: i32,
    pub identifier: String,
    // remaining columns ignored
}

#[derive(Debug, Deserialize)]
pub struct TypeNameRow {
    pub type_id: i32,
    pub local_language_id: i32,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct TypeEfficacyRow {
    pub damage_type_id: i32,
    pub target_type_id: i32,
    pub damage_factor: i32,
}

#[derive(Debug, Deserialize)]
pub struct MoveRow {
    pub id: i32,
    pub identifier: String,
    #[serde(default)]
    pub generation_id: i32,
    pub type_id: i32,
    pub power: Option<i32>,
    pub pp: Option<i32>,
    pub accuracy: Option<i32>,
    #[serde(default)]
    pub priority: i32,
    #[serde(default)]
    pub target_id: i32,
    pub damage_class_id: i32,
    // remaining columns ignored
}

#[derive(Debug, Deserialize)]
pub struct MoveNameRow {
    pub move_id: i32,
    pub local_language_id: i32,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct PokemonMoveRow {
    pub pokemon_id: i32,
    pub version_group_id: i32,
    pub move_id: i32,
    pub pokemon_move_method_id: i32,
    // level/order columns ignored
}

#[derive(Debug, Deserialize)]
pub struct StatRow {
    pub id: i32,
    pub identifier: String,
    // remaining columns ignored
}

#[derive(Debug, Deserialize)]
pub struct AbilityRow {
    pub id: i32,
    pub identifier: String,
    // remaining columns ignored
}

#[derive(Debug, Deserialize)]
pub struct AbilityNameRow {
    pub ability_id: i32,
    pub local_language_id: i32,
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct PokemonAbilityRow {
    pub pokemon_id: i32,
    pub ability_id: i32,
    pub is_hidden: i32,
    pub slot: i32,
}

#[derive(Debug, Deserialize)]
pub struct AbilityFlavorTextRow {
    pub ability_id: i32,
    pub version_group_id: i32,
    pub language_id: i32,
    pub flavor_text: String,
}

#[derive(Debug, Deserialize)]
pub struct PokemonFormRow {
    pub id: i32,
    pub identifier: String,
    #[serde(default)]
    pub form_identifier: String,
    pub pokemon_id: i32,
    // remaining columns ignored
}

#[derive(Debug, Deserialize)]
pub struct PokemonFormNameRow {
    pub pokemon_form_id: i32,
    pub local_language_id: i32,
    #[serde(default)]
    pub form_name: String,
    #[serde(default)]
    pub pokemon_name: String,
}

// ---------------------------------------------------------------------------
// Parsed data container
// ---------------------------------------------------------------------------

pub struct ParsedData {
    pub pokemon: Vec<PokemonRow>,
    pub pokemon_types: Vec<PokemonTypeRow>,
    pub pokemon_stats: Vec<PokemonStatRow>,
    pub pokemon_species: Vec<PokemonSpeciesRow>,
    pub pokemon_species_names: Vec<PokemonSpeciesNameRow>,
    pub types: Vec<TypeRow>,
    pub type_names: Vec<TypeNameRow>,
    pub type_efficacy: Vec<TypeEfficacyRow>,
    pub moves: Vec<MoveRow>,
    pub move_names: Vec<MoveNameRow>,
    pub pokemon_moves: Vec<PokemonMoveRow>,
    pub abilities: Vec<AbilityRow>,
    pub ability_names: Vec<AbilityNameRow>,
    pub pokemon_abilities: Vec<PokemonAbilityRow>,
    pub ability_flavor_text: Vec<AbilityFlavorTextRow>,
    pub pokemon_forms: Vec<PokemonFormRow>,
    pub pokemon_form_names: Vec<PokemonFormNameRow>,
}

// ---------------------------------------------------------------------------
// Generic CSV parser
// ---------------------------------------------------------------------------

fn parse_csv<T: for<'de> Deserialize<'de>>(data: &str, name: &str) -> Result<Vec<T>> {
    let mut reader = csv::ReaderBuilder::new()
        .flexible(true)
        .from_reader(data.as_bytes());

    let mut rows = Vec::new();
    for result in reader.deserialize() {
        match result {
            Ok(row) => rows.push(row),
            Err(e) => {
                tracing::warn!("Skipping malformed row in {name}: {e}");
            }
        }
    }
    tracing::info!("Parsed {} rows from {name}", rows.len());
    Ok(rows)
}

// ---------------------------------------------------------------------------
// Parse all CSVs
// ---------------------------------------------------------------------------

pub fn parse_all(csvs: &HashMap<String, String>) -> Result<ParsedData> {
    let get = |name: &str| -> &str {
        csvs.get(name)
            .map(|s| s.as_str())
            .unwrap_or("")
    };

    Ok(ParsedData {
        pokemon: parse_csv(get("pokemon.csv"), "pokemon.csv")
            .context("parsing pokemon.csv")?,
        pokemon_types: parse_csv(get("pokemon_types.csv"), "pokemon_types.csv")
            .context("parsing pokemon_types.csv")?,
        pokemon_stats: parse_csv(get("pokemon_stats.csv"), "pokemon_stats.csv")
            .context("parsing pokemon_stats.csv")?,
        pokemon_species: parse_csv(get("pokemon_species.csv"), "pokemon_species.csv")
            .context("parsing pokemon_species.csv")?,
        pokemon_species_names: parse_csv(
            get("pokemon_species_names.csv"),
            "pokemon_species_names.csv",
        )
        .context("parsing pokemon_species_names.csv")?,
        types: parse_csv(get("types.csv"), "types.csv").context("parsing types.csv")?,
        type_names: parse_csv(get("type_names.csv"), "type_names.csv")
            .context("parsing type_names.csv")?,
        type_efficacy: parse_csv(get("type_efficacy.csv"), "type_efficacy.csv")
            .context("parsing type_efficacy.csv")?,
        moves: parse_csv(get("moves.csv"), "moves.csv")
            .context("parsing moves.csv")?,
        move_names: parse_csv(get("move_names.csv"), "move_names.csv")
            .context("parsing move_names.csv")?,
        pokemon_moves: parse_csv(get("pokemon_moves.csv"), "pokemon_moves.csv")
            .context("parsing pokemon_moves.csv")?,
        abilities: parse_csv(get("abilities.csv"), "abilities.csv")
            .context("parsing abilities.csv")?,
        ability_names: parse_csv(get("ability_names.csv"), "ability_names.csv")
            .context("parsing ability_names.csv")?,
        pokemon_abilities: parse_csv(
            get("pokemon_abilities.csv"),
            "pokemon_abilities.csv",
        )
        .context("parsing pokemon_abilities.csv")?,
        ability_flavor_text: parse_csv(
            get("ability_flavor_text.csv"),
            "ability_flavor_text.csv",
        )
        .context("parsing ability_flavor_text.csv")?,
        pokemon_forms: parse_csv(get("pokemon_forms.csv"), "pokemon_forms.csv")
            .context("parsing pokemon_forms.csv")?,
        pokemon_form_names: parse_csv(
            get("pokemon_form_names.csv"),
            "pokemon_form_names.csv",
        )
        .context("parsing pokemon_form_names.csv")?,
    })
}
