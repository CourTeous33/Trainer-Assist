use serde::{Deserialize, Serialize};

/// Localized name container: English is always present, others optional.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LocalizedNames {
    pub en: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ja: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub zh: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PokemonSummary {
    pub id: i32,
    pub species_id: i32,
    pub name: String,
    pub names: LocalizedNames,
    pub types: Vec<TypeRef>,
    pub sprite_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AbilityInfo {
    pub name: String,
    pub names: LocalizedNames,
    pub description: LocalizedNames,
    pub is_hidden: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PokemonDetail {
    pub id: i32,
    pub species_id: i32,
    pub name: String,
    pub names: LocalizedNames,
    pub species_names: LocalizedNames,
    pub types: Vec<TypeRef>,
    pub sprite_url: String,
    pub stats: Stats,
    pub abilities: Vec<AbilityInfo>,
    pub moves: Vec<PokemonMoveRef>,
    pub height: i32,
    pub weight: i32,
    pub generation: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Stats {
    pub hp: i32,
    pub attack: i32,
    pub defense: i32,
    pub special_attack: i32,
    pub special_defense: i32,
    pub speed: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeRef {
    pub id: i32,
    pub name: String,
    pub names: LocalizedNames,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TypeEfficacy {
    pub attacking_type_id: i32,
    pub defending_type_id: i32,
    pub damage_factor: i32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MoveSummary {
    pub id: i32,
    pub name: String,
    pub names: LocalizedNames,
    pub type_ref: TypeRef,
    pub power: Option<i32>,
    pub accuracy: Option<i32>,
    pub pp: Option<i32>,
    pub damage_class: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PokemonMoveRef {
    pub id: i32,
    pub name: String,
    pub names: LocalizedNames,
}
