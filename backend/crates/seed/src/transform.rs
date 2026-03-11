use std::collections::{HashMap, HashSet};

use shared::models::{
    AbilityInfo, LocalizedNames, MoveSummary, PokemonDetail, PokemonMoveRef, PokemonSummary,
    Stats, TypeEfficacy, TypeRef,
};

use crate::parse::ParsedData;

pub struct TransformedData {
    pub pokemon_summaries: Vec<PokemonSummary>,
    pub pokemon_details: Vec<PokemonDetail>,
    pub type_refs: Vec<TypeRef>,
    pub type_efficacy: Vec<TypeEfficacy>,
    pub move_summaries: Vec<MoveSummary>,
    pub type_pokemon_map: HashMap<i32, Vec<PokemonSummary>>,
}

pub fn transform(data: &ParsedData) -> TransformedData {
    // -----------------------------------------------------------------------
    // Build lookup maps
    // -----------------------------------------------------------------------

    // species_id -> generation_id
    let species_gen: HashMap<i32, i32> = data
        .pokemon_species
        .iter()
        .map(|s| (s.id, s.generation_id))
        .collect();

    // species_id -> English name (local_language_id = 9)
    let species_name: HashMap<i32, String> = data
        .pokemon_species_names
        .iter()
        .filter(|n| n.local_language_id == 9)
        .map(|n| (n.pokemon_species_id, n.name.clone()))
        .collect();

    // species_id -> Japanese name (local_language_id = 1, ja-Hrkt/kana)
    let species_name_ja: HashMap<i32, String> = data
        .pokemon_species_names
        .iter()
        .filter(|n| n.local_language_id == 1)
        .map(|n| (n.pokemon_species_id, n.name.clone()))
        .collect();

    // species_id -> Chinese Simplified name (local_language_id = 12)
    let species_name_zh: HashMap<i32, String> = data
        .pokemon_species_names
        .iter()
        .filter(|n| n.local_language_id == 12)
        .map(|n| (n.pokemon_species_id, n.name.clone()))
        .collect();

    // type_id -> English name
    let type_name_map: HashMap<i32, String> = data
        .type_names
        .iter()
        .filter(|n| n.local_language_id == 9)
        .map(|n| (n.type_id, n.name.clone()))
        .collect();

    // type_id -> Japanese name
    let type_name_ja: HashMap<i32, String> = data
        .type_names
        .iter()
        .filter(|n| n.local_language_id == 1)
        .map(|n| (n.type_id, n.name.clone()))
        .collect();

    // type_id -> Chinese Simplified name
    let type_name_zh: HashMap<i32, String> = data
        .type_names
        .iter()
        .filter(|n| n.local_language_id == 12)
        .map(|n| (n.type_id, n.name.clone()))
        .collect();

    // Build TypeRef list (only the 18 standard types; exclude Stellar, ???, Shadow)
    let excluded_type_ids = [19, 10001, 10002];
    let type_refs: Vec<TypeRef> = data
        .types
        .iter()
        .filter(|t| !excluded_type_ids.contains(&t.id))
        .filter_map(|t| {
            type_name_map.get(&t.id).map(|name| TypeRef {
                id: t.id,
                name: name.clone(),
                names: LocalizedNames {
                    en: name.clone(),
                    ja: type_name_ja.get(&t.id).cloned(),
                    zh: type_name_zh.get(&t.id).cloned(),
                },
            })
        })
        .collect();

    // type_id -> TypeRef for quick lookup
    let type_ref_map: HashMap<i32, TypeRef> = type_refs
        .iter()
        .map(|t| (t.id, t.clone()))
        .collect();

    // pokemon_id -> Vec<TypeRef> (sorted by slot)
    let mut pokemon_type_map: HashMap<i32, Vec<(i32, TypeRef)>> = HashMap::new();
    for pt in &data.pokemon_types {
        if let Some(tr) = type_ref_map.get(&pt.type_id) {
            pokemon_type_map
                .entry(pt.pokemon_id)
                .or_default()
                .push((pt.slot, tr.clone()));
        }
    }

    // pokemon_id -> Stats
    let mut pokemon_stat_map: HashMap<i32, [i32; 6]> = HashMap::new();
    for ps in &data.pokemon_stats {
        let entry = pokemon_stat_map.entry(ps.pokemon_id).or_insert([0; 6]);
        match ps.stat_id {
            1 => entry[0] = ps.base_stat, // hp
            2 => entry[1] = ps.base_stat, // attack
            3 => entry[2] = ps.base_stat, // defense
            4 => entry[3] = ps.base_stat, // sp. atk
            5 => entry[4] = ps.base_stat, // sp. def
            6 => entry[5] = ps.base_stat, // speed
            _ => {}
        }
    }

    // ability_id -> English name
    let ability_name_map: HashMap<i32, String> = data
        .ability_names
        .iter()
        .filter(|n| n.local_language_id == 9)
        .map(|n| (n.ability_id, n.name.clone()))
        .collect();

    // ability_id -> Japanese name
    let ability_name_ja: HashMap<i32, String> = data
        .ability_names
        .iter()
        .filter(|n| n.local_language_id == 1)
        .map(|n| (n.ability_id, n.name.clone()))
        .collect();

    // ability_id -> Chinese Simplified name
    let ability_name_zh: HashMap<i32, String> = data
        .ability_names
        .iter()
        .filter(|n| n.local_language_id == 12)
        .map(|n| (n.ability_id, n.name.clone()))
        .collect();

    // ability_id -> description (highest version_group_id per language)
    let mut ability_desc_en_best: HashMap<i32, (i32, String)> = HashMap::new();
    let mut ability_desc_ja_best: HashMap<i32, (i32, String)> = HashMap::new();
    let mut ability_desc_zh_best: HashMap<i32, (i32, String)> = HashMap::new();
    for row in &data.ability_flavor_text {
        let target = match row.language_id {
            9 => Some(&mut ability_desc_en_best),
            1 => Some(&mut ability_desc_ja_best),
            12 => Some(&mut ability_desc_zh_best),
            _ => None,
        };
        if let Some(map) = target {
            let entry = map.entry(row.ability_id).or_insert((row.version_group_id, row.flavor_text.clone()));
            if row.version_group_id > entry.0 {
                *entry = (row.version_group_id, row.flavor_text.clone());
            }
        }
    }
    let ability_desc_en: HashMap<i32, String> = ability_desc_en_best.into_iter().map(|(k, (_, v))| (k, v)).collect();
    let ability_desc_ja: HashMap<i32, String> = ability_desc_ja_best.into_iter().map(|(k, (_, v))| (k, v)).collect();
    let ability_desc_zh: HashMap<i32, String> = ability_desc_zh_best.into_iter().map(|(k, (_, v))| (k, v)).collect();

    // pokemon_id -> Vec<AbilityInfo> for abilities
    let mut pokemon_ability_map: HashMap<i32, Vec<AbilityInfo>> = HashMap::new();
    for pa in &data.pokemon_abilities {
        if let Some(name) = ability_name_map.get(&pa.ability_id) {
            pokemon_ability_map
                .entry(pa.pokemon_id)
                .or_default()
                .push(AbilityInfo {
                    name: name.clone(),
                    names: LocalizedNames {
                        en: name.clone(),
                        ja: ability_name_ja.get(&pa.ability_id).cloned(),
                        zh: ability_name_zh.get(&pa.ability_id).cloned(),
                    },
                    description: LocalizedNames {
                        en: ability_desc_en.get(&pa.ability_id).cloned().unwrap_or_default(),
                        ja: ability_desc_ja.get(&pa.ability_id).cloned(),
                        zh: ability_desc_zh.get(&pa.ability_id).cloned(),
                    },
                    is_hidden: pa.is_hidden == 1,
                });
        }
    }

    // move_id -> English name
    let move_name_map: HashMap<i32, String> = data
        .move_names
        .iter()
        .filter(|n| n.local_language_id == 9)
        .map(|n| (n.move_id, n.name.clone()))
        .collect();

    // move_id -> Japanese name
    let move_name_ja: HashMap<i32, String> = data
        .move_names
        .iter()
        .filter(|n| n.local_language_id == 1)
        .map(|n| (n.move_id, n.name.clone()))
        .collect();

    // move_id -> Chinese Simplified name
    let move_name_zh: HashMap<i32, String> = data
        .move_names
        .iter()
        .filter(|n| n.local_language_id == 12)
        .map(|n| (n.move_id, n.name.clone()))
        .collect();

    // pokemon_id -> Set<move_id> (level-up moves, method_id=1, deduplicated across versions)
    let mut pokemon_move_ids: HashMap<i32, HashSet<i32>> = HashMap::new();
    for pm in &data.pokemon_moves {
        if pm.pokemon_move_method_id == 1 {
            pokemon_move_ids
                .entry(pm.pokemon_id)
                .or_default()
                .insert(pm.move_id);
        }
    }

    // -----------------------------------------------------------------------
    // Build Pokemon models (all forms including regional variants)
    // -----------------------------------------------------------------------

    // Exclude: mega evolutions, gmax, battle-only, cosmetic, totem forms
    let excluded_suffixes = [
        "mega", "mega-x", "mega-y",
        "gmax",
        "totem", "totem-busted",
        "starter", "belle", "libre", "cosplay", "pop-star", "phd", "rock-star",
        "original-cap", "hoenn-cap", "sinnoh-cap", "unova-cap", "kalos-cap",
        "alola-cap", "partner-cap", "world-cap",
        "eternamax",
        "battle-bond", "ash",
        "power-construct",  // zygarde power construct (duplicate of 10%)
    ];

    let all_pokemon: Vec<&crate::parse::PokemonRow> = data
        .pokemon
        .iter()
        .filter(|p| {
            if p.is_default == 1 {
                return true;
            }
            // Get the suffix after the base name
            let base = p.identifier.split('-').next().unwrap_or("");
            let suffix = p.identifier.strip_prefix(base).unwrap_or("").trim_start_matches('-');
            // Exclude known cosmetic/temporary forms
            if excluded_suffixes.iter().any(|&ex| suffix == ex) {
                return false;
            }
            // Exclude pikachu costume forms (all have -cap or specific costume suffixes)
            if base == "pikachu" && p.id != 25 {
                return false;
            }
            true
        })
        .collect();

    let mut pokemon_summaries: Vec<PokemonSummary> = Vec::new();
    let mut pokemon_details: Vec<PokemonDetail> = Vec::new();

    // pokemon_form_id -> pokemon_id (from pokemon_forms.csv)
    let form_to_pokemon: HashMap<i32, i32> = data
        .pokemon_forms
        .iter()
        .map(|f| (f.id, f.pokemon_id))
        .collect();

    // pokemon_id -> localized pokemon_name from pokemon_form_names.csv
    // We map form_id -> pokemon_id, then collect names by language.
    // If pokemon_name is present, use it directly (e.g. "Shadow Calyrex").
    // Otherwise, combine species name + form_name (e.g. "蕾冠王" + "骑黑马的样子" -> "蕾冠王 (骑黑马的样子)").
    let mut form_names_en: HashMap<i32, String> = HashMap::new();
    let mut form_names_ja: HashMap<i32, String> = HashMap::new();
    let mut form_names_zh: HashMap<i32, String> = HashMap::new();
    for row in &data.pokemon_form_names {
        if row.pokemon_name.is_empty() && row.form_name.is_empty() {
            continue;
        }
        if let Some(&pokemon_id) = form_to_pokemon.get(&row.pokemon_form_id) {
            // Find species_id for this pokemon_id to look up species name
            let species_id_for_form = data.pokemon.iter()
                .find(|p| p.id == pokemon_id)
                .map(|p| p.species_id);

            let full_name = if !row.pokemon_name.is_empty() {
                row.pokemon_name.clone()
            } else {
                // Build "SpeciesName (FormName)" from species name + form_name
                let species_name_for_lang = species_id_for_form.and_then(|sid| {
                    match row.local_language_id {
                        9 => species_name.get(&sid),
                        1 => species_name_ja.get(&sid),
                        12 => species_name_zh.get(&sid),
                        _ => None,
                    }
                });
                match species_name_for_lang {
                    Some(sname) => format!("{} ({})", sname, row.form_name),
                    None => row.form_name.clone(),
                }
            };

            if !full_name.is_empty() {
                match row.local_language_id {
                    9 => { form_names_en.insert(pokemon_id, full_name); }
                    1 => { form_names_ja.insert(pokemon_id, full_name); }
                    12 => { form_names_zh.insert(pokemon_id, full_name); }
                    _ => {}
                }
            }
        }
    }

    // Readable form labels
    let form_labels: HashMap<&str, &str> = HashMap::from([
        ("alola", "Alolan"),
        ("galar", "Galarian"),
        ("hisui", "Hisuian"),
        ("paldea", "Paldean"),
        ("origin", "Origin Forme"),
        ("sky", "Sky Forme"),
        ("attack", "Attack Forme"),
        ("defense", "Defense Forme"),
        ("speed", "Speed Forme"),
        ("heat", "Heat Rotom"),
        ("wash", "Wash Rotom"),
        ("frost", "Frost Rotom"),
        ("fan", "Fan Rotom"),
        ("mow", "Mow Rotom"),
        ("sandy", "Sandy Cloak"),
        ("trash", "Trash Cloak"),
        ("sunny", "Sunny Form"),
        ("rainy", "Rainy Form"),
        ("snowy", "Snowy Form"),
        ("therian", "Therian Forme"),
        ("black", "Black"),
        ("white", "White"),
        ("resolute", "Resolute"),
        ("blade", "Blade Forme"),
        ("unbound", "Unbound"),
        ("10", "10% Forme"),
        ("complete", "Complete Forme"),
        ("midnight", "Midnight Form"),
        ("dusk", "Dusk Form"),
        ("dawn", "Dawn Wings"),
        ("ultra", "Ultra"),
        ("school", "School Form"),
        ("noice", "Noice Face"),
        ("crowned", "Crowned"),
        ("ice", "Ice Rider"),
        ("shadow", "Shadow Rider"),
        ("rapid-strike", "Rapid Strike"),
        ("dada", "Dada"),
        ("female", "Female"),
        ("blue-striped", "Blue-Striped"),
        ("low-key", "Low Key"),
        ("small", "Small"),
        ("large", "Large"),
        ("super", "Super"),
        ("pom-pom", "Pom-Pom"),
        ("pau", "Pa'u"),
        ("sensu", "Sensu"),
        ("gulping", "Gulping"),
        ("gorging", "Gorging"),
        ("zen", "Zen Mode"),
        ("pirouette", "Pirouette Forme"),
        ("paldea-combat-breed", "Paldean Combat"),
        ("paldea-blaze-breed", "Paldean Blaze"),
        ("paldea-aqua-breed", "Paldean Aqua"),
    ]);

    for poke in &all_pokemon {
        let base_name = species_name
            .get(&poke.species_id)
            .cloned()
            .unwrap_or_else(|| {
                // Capitalize identifier as fallback
                let mut c = poke.identifier.chars();
                match c.next() {
                    None => String::new(),
                    Some(f) => f.to_uppercase().to_string() + c.as_str(),
                }
            });

        let base_name_ja = species_name_ja.get(&poke.species_id).cloned();
        let base_name_zh = species_name_zh.get(&poke.species_id).cloned();

        // For non-default forms, build a descriptive display name
        let (name, name_ja, name_zh) = if poke.is_default == 1 {
            (base_name.clone(), base_name_ja, base_name_zh)
        } else {
            let base = poke.identifier.split('-').next().unwrap_or("");
            let suffix = poke.identifier.strip_prefix(base).unwrap_or("").trim_start_matches('-');

            // Check if we have localized form names from pokemon_form_names.csv
            let fn_en = form_names_en.get(&poke.id);
            let fn_ja = form_names_ja.get(&poke.id);
            let fn_zh = form_names_zh.get(&poke.id);

            if fn_en.is_some() || fn_ja.is_some() || fn_zh.is_some() {
                // Use form-specific names where available, fall back to constructed name
                let construct_fallback = |label: &str| -> (String, Option<String>, Option<String>) {
                    if base == "rotom" {
                        (
                            label.to_string(),
                            base_name_ja.clone().map(|ja| format!("{} ({})", ja, label)),
                            base_name_zh.clone().map(|zh| format!("{} ({})", zh, label)),
                        )
                    } else {
                        (
                            format!("{} ({})", base_name, label),
                            base_name_ja.clone().map(|ja| format!("{} ({})", ja, label)),
                            base_name_zh.clone().map(|zh| format!("{} ({})", zh, label)),
                        )
                    }
                };

                let fallback_label = form_labels.get(suffix).copied().unwrap_or_else(|| {
                    // We need a &str that lives long enough; use suffix as-is
                    suffix
                });
                let (fallback_en, fallback_ja, fallback_zh) = construct_fallback(fallback_label);

                let en = fn_en.cloned().unwrap_or(fallback_en);
                let ja = fn_ja.cloned().or(fallback_ja);
                let zh = fn_zh.cloned().or(fallback_zh);
                (en, ja, zh)
            } else if let Some(&label) = form_labels.get(suffix) {
                // For Rotom forms, use "Heat Rotom" style instead of "Rotom (Heat Rotom)"
                if base == "rotom" {
                    (
                        label.to_string(),
                        base_name_ja.map(|ja| format!("{} ({})", ja, label)),
                        base_name_zh.map(|zh| format!("{} ({})", zh, label)),
                    )
                } else {
                    (
                        format!("{} ({})", base_name, label),
                        base_name_ja.map(|ja| format!("{} ({})", ja, label)),
                        base_name_zh.map(|zh| format!("{} ({})", zh, label)),
                    )
                }
            } else {
                // Fallback: capitalize the suffix
                let capitalized = suffix
                    .split('-')
                    .map(|w| {
                        let mut c = w.chars();
                        match c.next() {
                            None => String::new(),
                            Some(f) => f.to_uppercase().to_string() + c.as_str(),
                        }
                    })
                    .collect::<Vec<_>>()
                    .join(" ");
                (
                    format!("{} ({})", base_name, &capitalized),
                    base_name_ja.map(|ja| format!("{} ({})", ja, &capitalized)),
                    base_name_zh.map(|zh| format!("{} ({})", zh, &capitalized)),
                )
            }
        };

        let names = LocalizedNames {
            en: name.clone(),
            ja: name_ja,
            zh: name_zh,
        };

        let species_names = LocalizedNames {
            en: base_name.clone(),
            ja: species_name_ja.get(&poke.species_id).cloned(),
            zh: species_name_zh.get(&poke.species_id).cloned(),
        };

        let mut types_with_slot = pokemon_type_map
            .get(&poke.id)
            .cloned()
            .unwrap_or_default();
        types_with_slot.sort_by_key(|(slot, _)| *slot);
        let types: Vec<TypeRef> = types_with_slot.into_iter().map(|(_, t)| t).collect();

        let sprite_url = format!(
            "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/{}.png",
            poke.id
        );

        let stat_arr = pokemon_stat_map.get(&poke.id).copied().unwrap_or([0; 6]);
        let stats = Stats {
            hp: stat_arr[0],
            attack: stat_arr[1],
            defense: stat_arr[2],
            special_attack: stat_arr[3],
            special_defense: stat_arr[4],
            speed: stat_arr[5],
        };

        let abilities = pokemon_ability_map
            .get(&poke.id)
            .cloned()
            .unwrap_or_default();

        let move_ids = pokemon_move_ids
            .get(&poke.id)
            .cloned()
            .unwrap_or_default();
        let mut moves: Vec<PokemonMoveRef> = move_ids
            .into_iter()
            .filter_map(|mid| {
                move_name_map.get(&mid).map(|mname| PokemonMoveRef {
                    id: mid,
                    name: mname.clone(),
                    names: LocalizedNames {
                        en: mname.clone(),
                        ja: move_name_ja.get(&mid).cloned(),
                        zh: move_name_zh.get(&mid).cloned(),
                    },
                })
            })
            .collect();
        moves.sort_by_key(|m| m.id);

        let generation = species_gen.get(&poke.species_id).copied().unwrap_or(0);

        let summary = PokemonSummary {
            id: poke.id,
            species_id: poke.species_id,
            name: name.clone(),
            names: names.clone(),
            types: types.clone(),
            sprite_url: sprite_url.clone(),
        };

        let detail = PokemonDetail {
            id: poke.id,
            species_id: poke.species_id,
            name,
            names,
            species_names,
            types,
            sprite_url,
            stats,
            abilities,
            moves,
            height: poke.height,
            weight: poke.weight,
            generation,
        };

        pokemon_summaries.push(summary);
        pokemon_details.push(detail);
    }

    pokemon_summaries.sort_by_key(|p| p.id);
    pokemon_details.sort_by_key(|p| p.id);

    // -----------------------------------------------------------------------
    // Build type -> pokemon mapping
    // -----------------------------------------------------------------------

    let mut type_pokemon_map: HashMap<i32, Vec<PokemonSummary>> = HashMap::new();
    for summary in &pokemon_summaries {
        for tr in &summary.types {
            type_pokemon_map
                .entry(tr.id)
                .or_default()
                .push(summary.clone());
        }
    }

    // -----------------------------------------------------------------------
    // Build type efficacy
    // -----------------------------------------------------------------------

    let type_efficacy: Vec<TypeEfficacy> = data
        .type_efficacy
        .iter()
        .map(|e| TypeEfficacy {
            attacking_type_id: e.damage_type_id,
            defending_type_id: e.target_type_id,
            damage_factor: e.damage_factor,
        })
        .collect();

    // -----------------------------------------------------------------------
    // Build move summaries
    // -----------------------------------------------------------------------

    let damage_class_name = |id: i32| -> String {
        match id {
            1 => "status".to_string(),
            2 => "physical".to_string(),
            3 => "special".to_string(),
            _ => "unknown".to_string(),
        }
    };

    let mut move_summaries: Vec<MoveSummary> = data
        .moves
        .iter()
        .filter_map(|m| {
            let name = move_name_map.get(&m.id)?.clone();
            let type_ref = type_ref_map.get(&m.type_id)?.clone();
            let names = LocalizedNames {
                en: name.clone(),
                ja: move_name_ja.get(&m.id).cloned(),
                zh: move_name_zh.get(&m.id).cloned(),
            };
            Some(MoveSummary {
                id: m.id,
                name,
                names,
                type_ref,
                power: m.power,
                accuracy: m.accuracy,
                pp: m.pp,
                damage_class: damage_class_name(m.damage_class_id),
            })
        })
        .collect();
    move_summaries.sort_by_key(|m| m.id);

    // -----------------------------------------------------------------------
    // Summary
    // -----------------------------------------------------------------------

    tracing::info!(
        "Transformed: {} pokemon, {} types, {} moves, {} efficacy entries",
        pokemon_summaries.len(),
        type_refs.len(),
        move_summaries.len(),
        type_efficacy.len(),
    );

    TransformedData {
        pokemon_summaries,
        pokemon_details,
        type_refs,
        type_efficacy,
        move_summaries,
        type_pokemon_map,
    }
}
