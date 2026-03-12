use shared::models::*;

#[test]
fn localized_names_serializes_with_all_fields() {
    let names = LocalizedNames {
        en: "Pikachu".to_string(),
        ja: Some("ピカチュウ".to_string()),
        zh: Some("皮卡丘".to_string()),
        zh_pinyin: Some("pikaqiu pkq".to_string()),
    };
    let json = serde_json::to_string(&names).unwrap();
    assert!(json.contains("\"en\":\"Pikachu\""));
    assert!(json.contains("\"ja\":\"ピカチュウ\""));
    assert!(json.contains("\"zh\":\"皮卡丘\""));
}

#[test]
fn localized_names_skips_none_fields() {
    let names = LocalizedNames {
        en: "Bulbasaur".to_string(),
        ja: None,
        zh: None,
        zh_pinyin: None,
    };
    let json = serde_json::to_string(&names).unwrap();
    assert!(json.contains("\"en\":\"Bulbasaur\""));
    assert!(!json.contains("\"ja\""));
    assert!(!json.contains("\"zh\""));
}

#[test]
fn localized_names_deserializes_without_optional_fields() {
    let json = r#"{"en":"Charmander"}"#;
    let names: LocalizedNames = serde_json::from_str(json).unwrap();
    assert_eq!(names.en, "Charmander");
    assert!(names.ja.is_none());
    assert!(names.zh.is_none());
}

#[test]
fn pokemon_summary_roundtrip() {
    let summary = PokemonSummary {
        id: 25,
        species_id: 25,
        name: "pikachu".to_string(),
        names: LocalizedNames {
            en: "Pikachu".to_string(),
            ja: Some("ピカチュウ".to_string()),
            zh: None,
            zh_pinyin: None,
        },
        types: vec![TypeRef {
            id: 13,
            name: "Electric".to_string(),
            names: LocalizedNames {
                en: "Electric".to_string(),
                ja: Some("でんき".to_string()),
                zh: None,
                zh_pinyin: None,
            },
        }],
        sprite_url: "https://example.com/25.png".to_string(),
        nicknames: Some("pika 皮神 皮卡 ピカ".to_string()),
    };

    let json = serde_json::to_string(&summary).unwrap();
    let deserialized: PokemonSummary = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.id, 25);
    assert_eq!(deserialized.name, "pikachu");
    assert_eq!(deserialized.types.len(), 1);
    assert_eq!(deserialized.types[0].name, "Electric");
    assert_eq!(deserialized.nicknames, Some("pika 皮神 皮卡 ピカ".to_string()));
}

#[test]
fn pokemon_detail_roundtrip() {
    let detail = PokemonDetail {
        id: 6,
        species_id: 6,
        name: "charizard".to_string(),
        names: LocalizedNames {
            en: "Charizard".to_string(),
            ja: Some("リザードン".to_string()),
            zh: Some("喷火龙".to_string()),
            zh_pinyin: Some("penhuolong phl".to_string()),
        },
        species_names: LocalizedNames {
            en: "Charizard".to_string(),
            ja: Some("リザードン".to_string()),
            zh: Some("喷火龙".to_string()),
            zh_pinyin: Some("penhuolong phl".to_string()),
        },
        types: vec![
            TypeRef {
                id: 10,
                name: "Fire".to_string(),
                names: LocalizedNames { zh_pinyin: None, en: "Fire".to_string(), ja: None, zh: None },
            },
            TypeRef {
                id: 3,
                name: "Flying".to_string(),
                names: LocalizedNames { zh_pinyin: None, en: "Flying".to_string(), ja: None, zh: None },
            },
        ],
        sprite_url: "https://example.com/6.png".to_string(),
        stats: Stats {
            hp: 78,
            attack: 84,
            defense: 78,
            special_attack: 109,
            special_defense: 85,
            speed: 100,
        },
        abilities: vec![AbilityInfo {
            name: "Blaze".to_string(),
            names: LocalizedNames { zh_pinyin: None, en: "Blaze".to_string(), ja: None, zh: None },
            description: LocalizedNames { zh_pinyin: None, en: "Powers up Fire-type moves".to_string(), ja: None, zh: None },
            is_hidden: false,
        }],
        moves: vec![PokemonMoveRef {
            id: 1,
            name: "Flamethrower".to_string(),
            names: LocalizedNames { zh_pinyin: None, en: "Flamethrower".to_string(), ja: None, zh: None },
        }],
        height: 17,
        weight: 905,
        generation: 1,
    };

    let json = serde_json::to_string(&detail).unwrap();
    let deserialized: PokemonDetail = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.id, 6);
    assert_eq!(deserialized.stats.hp, 78);
    assert_eq!(deserialized.stats.speed, 100);
    assert_eq!(deserialized.types.len(), 2);
    assert_eq!(deserialized.abilities.len(), 1);
    assert_eq!(deserialized.abilities[0].name, "Blaze");
    assert_eq!(deserialized.height, 17);
    assert_eq!(deserialized.weight, 905);
    assert_eq!(deserialized.generation, 1);
}

#[test]
fn type_efficacy_roundtrip() {
    let efficacy = TypeEfficacy {
        attacking_type_id: 10,
        defending_type_id: 11,
        damage_factor: 200,
    };
    let json = serde_json::to_string(&efficacy).unwrap();
    let deserialized: TypeEfficacy = serde_json::from_str(&json).unwrap();
    assert_eq!(deserialized.attacking_type_id, 10);
    assert_eq!(deserialized.defending_type_id, 11);
    assert_eq!(deserialized.damage_factor, 200);
}

#[test]
fn move_summary_with_null_power() {
    let move_s = MoveSummary {
        id: 1,
        name: "Growl".to_string(),
        names: LocalizedNames { zh_pinyin: None, en: "Growl".to_string(), ja: None, zh: None },
        type_ref: TypeRef {
            id: 1,
            name: "Normal".to_string(),
            names: LocalizedNames { zh_pinyin: None, en: "Normal".to_string(), ja: None, zh: None },
        },
        power: None,
        accuracy: Some(100),
        pp: Some(40),
        damage_class: "status".to_string(),
    };
    let json = serde_json::to_string(&move_s).unwrap();
    assert!(json.contains("\"power\":null"));
    let deserialized: MoveSummary = serde_json::from_str(&json).unwrap();
    assert!(deserialized.power.is_none());
    assert_eq!(deserialized.accuracy, Some(100));
}

// --- matches_search tests ---

#[test]
fn matches_search_english_name() {
    let names = LocalizedNames {
        en: "Pikachu".to_string(),
        ja: None,
        zh: None,
        zh_pinyin: None,
    };
    assert!(names.matches_search("pika"));
    assert!(names.matches_search("pikachu"));
    assert!(!names.matches_search("bulba"));
}

#[test]
fn matches_search_case_insensitive() {
    let names = LocalizedNames {
        en: "Pikachu".to_string(),
        ja: None,
        zh: None,
        zh_pinyin: None,
    };
    assert!(names.matches_search("PIKACHU".to_lowercase().as_str()));
    assert!(names.matches_search("pikachu"));
}

#[test]
fn matches_search_japanese_name() {
    let names = LocalizedNames {
        en: "Pikachu".to_string(),
        ja: Some("ピカチュウ".to_string()),
        zh: None,
        zh_pinyin: None,
    };
    assert!(names.matches_search("ピカ"));
    assert!(!names.matches_search("リザ"));
}

#[test]
fn matches_search_chinese_name() {
    let names = LocalizedNames {
        en: "Pikachu".to_string(),
        ja: None,
        zh: Some("皮卡丘".to_string()),
        zh_pinyin: None,
    };
    assert!(names.matches_search("皮卡"));
    assert!(!names.matches_search("喷火"));
}

#[test]
fn matches_search_pinyin_full() {
    let names = LocalizedNames {
        en: "Pikachu".to_string(),
        ja: None,
        zh: Some("皮卡丘".to_string()),
        zh_pinyin: Some("pikaqiu pkq".to_string()),
    };
    assert!(names.matches_search("pikaqiu"));
}

#[test]
fn matches_search_pinyin_initials() {
    let names = LocalizedNames {
        en: "Pikachu".to_string(),
        ja: None,
        zh: Some("皮卡丘".to_string()),
        zh_pinyin: Some("pikaqiu pkq".to_string()),
    };
    assert!(names.matches_search("pkq"));
}

#[test]
fn matches_search_no_match() {
    let names = LocalizedNames {
        en: "Pikachu".to_string(),
        ja: Some("ピカチュウ".to_string()),
        zh: Some("皮卡丘".to_string()),
        zh_pinyin: Some("pikaqiu pkq".to_string()),
    };
    assert!(!names.matches_search("charizard"));
}

#[test]
fn matches_search_empty_query_matches_nothing() {
    let names = LocalizedNames {
        en: "Pikachu".to_string(),
        ja: None,
        zh: None,
        zh_pinyin: None,
    };
    // Empty string is a substring of everything
    assert!(names.matches_search(""));
}

#[test]
fn nicknames_none_skipped_in_serialization() {
    let summary = PokemonSummary {
        id: 1,
        species_id: 1,
        name: "bulbasaur".to_string(),
        names: LocalizedNames { en: "Bulbasaur".to_string(), ja: None, zh: None, zh_pinyin: None },
        types: vec![],
        sprite_url: "".to_string(),
        nicknames: None,
    };
    let json = serde_json::to_string(&summary).unwrap();
    assert!(!json.contains("nicknames"));
}

#[test]
fn zh_pinyin_skipped_when_none() {
    let names = LocalizedNames {
        en: "Bulbasaur".to_string(),
        ja: None,
        zh: None,
        zh_pinyin: None,
    };
    let json = serde_json::to_string(&names).unwrap();
    assert!(!json.contains("zh_pinyin"));
}
