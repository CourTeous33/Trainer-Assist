use std::collections::HashMap;

use seed::parse::parse_all;
use seed::transform::transform;

fn make_csvs() -> HashMap<String, String> {
    let mut csvs = HashMap::new();

    // Includes: pikachu (default), raichu (default), raichu-alola (non-default regional),
    // charizard (default), charizard-mega-x (INCLUDED after whitelist broadening),
    // charizard-gmax (INCLUDED after whitelist broadening),
    // kyogre (default), primal-kyogre (INCLUDED after whitelist broadening),
    // eternatus (default), eternatus-eternamax (remains EXCLUDED)
    csvs.insert("pokemon.csv".into(),
        "id,identifier,species_id,height,weight,base_experience,order,is_default\n\
         25,pikachu,25,4,60,112,35,1\n\
         26,raichu,26,8,300,218,36,1\n\
         10100,raichu-alola,26,7,210,218,37,0\n\
         6,charizard,6,17,905,267,7,1\n\
         10034,charizard-mega-x,6,17,1005,285,8,0\n\
         10195,charizard-gmax,6,280,10050,302,9,0\n\
         382,kyogre,382,52,1950,218,265,1\n\
         10155,primal-kyogre,382,95,4300,302,266,0\n\
         890,eternatus,890,200,9500,345,848,1\n\
         10229,eternatus-eternamax,890,1000,99999,345,849,0\n".into());

    csvs.insert("pokemon_types.csv".into(),
        "pokemon_id,type_id,slot\n\
         25,13,1\n\
         26,13,1\n\
         10100,13,1\n\
         10100,14,2\n\
         6,10,1\n\
         6,3,2\n\
         10034,10,1\n\
         10034,16,2\n".into());

    csvs.insert("pokemon_stats.csv".into(),
        "pokemon_id,stat_id,base_stat,effort\n\
         25,1,35,0\n\
         25,2,55,0\n\
         25,3,40,0\n\
         25,4,50,0\n\
         25,5,50,0\n\
         25,6,90,2\n\
         26,1,60,0\n\
         26,2,90,0\n\
         26,3,55,0\n\
         26,4,90,0\n\
         26,5,80,0\n\
         26,6,110,0\n\
         10100,1,60,0\n\
         10100,2,85,0\n\
         10100,3,50,0\n\
         10100,4,95,0\n\
         10100,5,85,0\n\
         10100,6,110,0\n\
         6,1,78,0\n\
         6,2,84,0\n\
         6,3,78,0\n\
         6,4,109,0\n\
         6,5,85,0\n\
         6,6,100,0\n\
         10034,1,78,0\n\
         10034,2,130,0\n\
         10034,3,111,0\n\
         10034,4,130,0\n\
         10034,5,85,0\n\
         10034,6,100,0\n\
         10195,1,78,0\n\
         10195,2,104,0\n\
         10195,3,78,0\n\
         10195,4,109,0\n\
         10195,5,85,0\n\
         10195,6,100,0\n\
         382,1,100,0\n\
         382,2,100,0\n\
         382,3,90,0\n\
         382,4,150,0\n\
         382,5,140,0\n\
         382,6,90,0\n\
         10155,1,100,0\n\
         10155,2,150,0\n\
         10155,3,90,0\n\
         10155,4,180,0\n\
         10155,5,160,0\n\
         10155,6,90,0\n\
         890,1,140,0\n\
         890,2,85,0\n\
         890,3,95,0\n\
         890,4,145,0\n\
         890,5,95,0\n\
         890,6,130,0\n\
         10229,1,255,0\n\
         10229,2,115,0\n\
         10229,3,250,0\n\
         10229,4,125,0\n\
         10229,5,250,0\n\
         10229,6,130,0\n".into());

    csvs.insert("pokemon_species.csv".into(),
        "id,identifier,generation_id,evolves_from_species_id,evolution_chain_id,color_id,shape_id,habitat_id,gender_rate,capture_rate,base_happiness,is_baby,hatch_counter,has_gender_differences,growth_rate_id,forms_switchable,is_legendary,is_mythical,order,conquest_order\n\
         25,pikachu,1,,10,10,8,2,4,190,70,0,10,1,1,0,0,0,35,\n\
         26,raichu,1,25,10,10,6,2,4,75,70,0,10,1,1,0,0,0,36,\n\
         6,charizard,1,5,2,10,6,4,1,45,70,0,20,0,4,0,0,0,7,\n\
         382,kyogre,3,,184,10,10,,-1,5,35,0,80,0,1,0,1,0,265,\n\
         890,eternatus,8,,363,4,8,,-1,255,0,0,120,0,4,0,1,0,848,\n".into());

    csvs.insert("pokemon_species_names.csv".into(),
        "pokemon_species_id,local_language_id,name,genus\n\
         25,9,Pikachu,Mouse Pokémon\n\
         25,1,ピカチュウ,ねずみポケモン\n\
         25,12,皮卡丘,鼠宝可梦\n\
         26,9,Raichu,Mouse Pokémon\n\
         26,1,ライチュウ,ねずみポケモン\n\
         6,9,Charizard,Flame Pokémon\n\
         6,1,リザードン,かえんポケモン\n\
         382,9,Kyogre,Sea Basin Pokémon\n\
         890,9,Eternatus,Infinity Pokémon\n".into());

    csvs.insert("types.csv".into(),
        "id,identifier,generation_id,damage_class_id\n\
         1,normal,1,\n\
         3,flying,1,\n\
         10,fire,1,\n\
         13,electric,1,\n\
         14,psychic,1,\n\
         16,dragon,1,\n\
         19,stellar,9,\n\
         10001,unknown,1,\n\
         10002,shadow,3,\n".into());

    csvs.insert("type_names.csv".into(),
        "type_id,local_language_id,name\n\
         1,9,Normal\n\
         3,9,Flying\n\
         10,9,Fire\n\
         13,9,Electric\n\
         14,9,Psychic\n\
         16,9,Dragon\n\
         19,9,Stellar\n\
         10001,9,???\n\
         10002,9,Shadow\n\
         13,1,でんき\n\
         10,1,ほのお\n".into());

    csvs.insert("type_efficacy.csv".into(),
        "damage_type_id,target_type_id,damage_factor\n\
         13,3,50\n\
         10,13,100\n\
         13,10,100\n".into());

    csvs.insert("moves.csv".into(),
        "id,identifier,generation_id,type_id,power,pp,accuracy,priority,target_id,damage_class_id,effect_id,effect_chance,contest_type_id,contest_effect_id,super_contest_effect_id\n\
         84,thunder-shock,1,13,40,30,100,0,10,3,,,1,,\n\
         85,thunderbolt,1,13,90,15,100,0,10,3,,,1,,\n\
         53,flamethrower,1,10,90,15,100,0,10,3,,,1,,\n".into());

    csvs.insert("move_names.csv".into(),
        "move_id,local_language_id,name\n\
         84,9,Thunder Shock\n\
         84,1,でんきショック\n\
         85,9,Thunderbolt\n\
         85,1,10まんボルト\n\
         53,9,Flamethrower\n".into());

    csvs.insert("pokemon_moves.csv".into(),
        "pokemon_id,version_group_id,move_id,pokemon_move_method_id,level,order\n\
         25,1,84,1,1,\n\
         25,1,85,1,26,\n\
         6,1,53,1,1,\n".into());

    csvs.insert("stats.csv".into(), "id,damage_class_id,identifier,is_battle_only,game_index\n1,,hp,0,1\n".into());

    csvs.insert("abilities.csv".into(),
        "id,identifier,generation_id,is_main_series\n\
         9,static,3,1\n\
         66,blaze,3,1\n".into());

    csvs.insert("ability_names.csv".into(),
        "ability_id,local_language_id,name\n\
         9,9,Static\n\
         9,1,せいでんき\n\
         66,9,Blaze\n".into());

    csvs.insert("pokemon_abilities.csv".into(),
        "pokemon_id,ability_id,is_hidden,slot\n\
         25,9,0,1\n\
         6,66,0,1\n".into());

    csvs.insert("ability_flavor_text.csv".into(),
        "ability_id,version_group_id,language_id,flavor_text\n\
         9,20,9,Contact with the Pokemon may cause paralysis.\n\
         9,15,9,Old description.\n\
         66,20,9,Powers up Fire-type moves when HP is low.\n".into());

    csvs
}

#[test]
fn includes_mega_evolutions() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    // Should include pikachu, raichu, raichu-alola, charizard, charizard-mega-x,
    // charizard-gmax, kyogre, primal-kyogre, eternatus = 9
    // (eternatus-eternamax is still excluded)
    assert_eq!(result.pokemon_summaries.len(), 9);
    let ids: Vec<i32> = result.pokemon_summaries.iter().map(|p| p.id).collect();
    assert!(ids.contains(&10034), "charizard-mega-x (10034) should be included");
    assert!(!ids.contains(&10229), "eternatus-eternamax (10229) should still be excluded");
}

#[test]
fn includes_mega_x_form() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let mega_x = result.pokemon_summaries.iter().find(|p| p.id == 10034);
    assert!(mega_x.is_some(), "charizard-mega-x should be included");
}

#[test]
fn includes_gmax_form() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let gmax = result.pokemon_summaries.iter().find(|p| p.id == 10195);
    assert!(gmax.is_some(), "charizard-gmax should be included");
}

#[test]
fn includes_primal_form() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let primal = result.pokemon_summaries.iter().find(|p| p.id == 10155);
    assert!(primal.is_some(), "primal-kyogre should be included");
}

#[test]
fn excludes_eternamax_form() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let eternamax = result.pokemon_summaries.iter().find(|p| p.id == 10229);
    assert!(eternamax.is_none(), "eternatus-eternamax should remain excluded");
}

#[test]
fn includes_regional_variants() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let alola = result.pokemon_summaries.iter().find(|p| p.id == 10100);
    assert!(alola.is_some(), "Alolan Raichu should be included");
    let alola = alola.unwrap();
    assert!(alola.name.contains("Alolan"), "Name should contain Alolan, got: {}", alola.name);
}

#[test]
fn excludes_stellar_unknown_shadow_types() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let type_names: Vec<&str> = result.type_refs.iter().map(|t| t.name.as_str()).collect();
    assert!(!type_names.contains(&"Stellar"), "Stellar should be excluded");
    assert!(!type_names.contains(&"???"), "??? should be excluded");
    assert!(!type_names.contains(&"Shadow"), "Shadow should be excluded");
    assert!(type_names.contains(&"Electric"));
    assert!(type_names.contains(&"Fire"));
    assert!(type_names.contains(&"Normal"));
}

#[test]
fn pokemon_has_correct_types() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let charizard = result.pokemon_details.iter().find(|p| p.id == 6).unwrap();
    assert_eq!(charizard.types.len(), 2);
    assert_eq!(charizard.types[0].name, "Fire");
    assert_eq!(charizard.types[1].name, "Flying");
}

#[test]
fn pokemon_has_correct_stats() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let pikachu = result.pokemon_details.iter().find(|p| p.id == 25).unwrap();
    assert_eq!(pikachu.stats.hp, 35);
    assert_eq!(pikachu.stats.attack, 55);
    assert_eq!(pikachu.stats.defense, 40);
    assert_eq!(pikachu.stats.special_attack, 50);
    assert_eq!(pikachu.stats.special_defense, 50);
    assert_eq!(pikachu.stats.speed, 90);
}

#[test]
fn pokemon_has_localized_names() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let pikachu = result.pokemon_details.iter().find(|p| p.id == 25).unwrap();
    assert_eq!(pikachu.names.en, "Pikachu");
    assert_eq!(pikachu.names.ja, Some("ピカチュウ".to_string()));
    assert_eq!(pikachu.names.zh, Some("皮卡丘".to_string()));
}

#[test]
fn pokemon_has_abilities_with_descriptions() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let pikachu = result.pokemon_details.iter().find(|p| p.id == 25).unwrap();
    assert_eq!(pikachu.abilities.len(), 1);
    // `name` is the kebab-case slug from abilities.csv — the calc roster keys on this.
    assert_eq!(pikachu.abilities[0].name, "static");
    assert_eq!(pikachu.abilities[0].names.en, "Static");
    assert_eq!(pikachu.abilities[0].names.ja, Some("せいでんき".to_string()));
    // Should pick version_group_id 20 (highest), not 15
    assert!(pikachu.abilities[0].description.en.contains("paralysis"));
}

#[test]
fn pokemon_has_moves() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let pikachu = result.pokemon_details.iter().find(|p| p.id == 25).unwrap();
    assert_eq!(pikachu.moves.len(), 2);
    let move_names: Vec<&str> = pikachu.moves.iter().map(|m| m.name.as_str()).collect();
    assert!(move_names.contains(&"Thunder Shock"));
    assert!(move_names.contains(&"Thunderbolt"));
}

#[test]
fn move_has_localized_names() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let pikachu = result.pokemon_details.iter().find(|p| p.id == 25).unwrap();
    let thunder_shock = pikachu.moves.iter().find(|m| m.name == "Thunder Shock").unwrap();
    assert_eq!(thunder_shock.names.en, "Thunder Shock");
    assert_eq!(thunder_shock.names.ja, Some("でんきショック".to_string()));
}

#[test]
fn pokemon_has_generation() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let pikachu = result.pokemon_details.iter().find(|p| p.id == 25).unwrap();
    assert_eq!(pikachu.generation, 1);
}

#[test]
fn type_efficacy_is_transformed() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    assert!(!result.type_efficacy.is_empty());
    let electric_vs_flying = result.type_efficacy.iter()
        .find(|e| e.attacking_type_id == 13 && e.defending_type_id == 3);
    assert!(electric_vs_flying.is_some());
    assert_eq!(electric_vs_flying.unwrap().damage_factor, 50);
}

#[test]
fn type_pokemon_map_is_populated() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    // Electric type (id=13) should have pikachu, raichu, alolan raichu
    let electric_pokemon = result.type_pokemon_map.get(&13).unwrap();
    assert!(electric_pokemon.len() >= 3);
}

#[test]
fn move_summaries_have_damage_class() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let thunderbolt = result.move_summaries.iter().find(|m| m.name == "Thunderbolt").unwrap();
    assert_eq!(thunderbolt.damage_class, "special");
    assert_eq!(thunderbolt.power, Some(90));
    assert_eq!(thunderbolt.accuracy, Some(100));
    assert_eq!(thunderbolt.pp, Some(15));
}

#[test]
fn move_summaries_have_type_ref() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let thunderbolt = result.move_summaries.iter().find(|m| m.name == "Thunderbolt").unwrap();
    assert_eq!(thunderbolt.type_ref.name, "Electric");
    assert_eq!(thunderbolt.type_ref.id, 13);
}

#[test]
fn results_are_sorted_by_species_id() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let species_ids: Vec<(i32, i32)> = result.pokemon_summaries.iter()
        .map(|p| (p.species_id, p.id))
        .collect();
    let mut sorted = species_ids.clone();
    sorted.sort();
    assert_eq!(species_ids, sorted, "Pokemon summaries should be sorted by (species_id, id)");

    // Verify alternate forms come after their base form
    let raichu_positions: Vec<(usize, &str, i32)> = result.pokemon_summaries.iter()
        .enumerate()
        .filter(|(_, p)| p.species_id == 26)
        .map(|(i, p)| (i, p.name.as_str(), p.id))
        .collect();
    assert_eq!(raichu_positions.len(), 2, "Should have base Raichu and Alolan Raichu");
    assert!(raichu_positions[0].2 < raichu_positions[1].2,
        "Base Raichu (id={}) should come before Alolan Raichu (id={})",
        raichu_positions[0].2, raichu_positions[1].2);

    let move_ids: Vec<i32> = result.move_summaries.iter().map(|m| m.id).collect();
    let mut sorted_moves = move_ids.clone();
    sorted_moves.sort();
    assert_eq!(move_ids, sorted_moves, "Move summaries should be sorted by ID");
}

#[test]
fn pokemon_has_pinyin() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    let pikachu = result.pokemon_details.iter().find(|p| p.id == 25).unwrap();
    assert_eq!(pikachu.names.zh, Some("皮卡丘".to_string()));
    let zh_pinyin = pikachu.names.zh_pinyin.as_ref().expect("Should have zh_pinyin");
    assert!(zh_pinyin.contains("pikaqiu"), "Full pinyin should be present, got: {}", zh_pinyin);
    assert!(zh_pinyin.contains("pkq"), "Pinyin initials should be present, got: {}", zh_pinyin);
}

#[test]
fn pokemon_without_chinese_name_has_no_pinyin() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    // Charizard has no Chinese name in test data
    let charizard = result.pokemon_details.iter().find(|p| p.id == 6).unwrap();
    assert!(charizard.names.zh.is_none());
    assert!(charizard.names.zh_pinyin.is_none());
}

#[test]
fn nicknames_default_to_none() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    // All summaries should have None nicknames from transform (loaded separately in main)
    for summary in &result.pokemon_summaries {
        assert!(summary.nicknames.is_none(), "Nicknames should be None after transform for {}", summary.name);
    }
}

#[test]
fn move_names_have_pinyin() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    // Thunder Shock has Japanese name but no Chinese name in test data
    let thunder_shock = result.move_summaries.iter().find(|m| m.name == "Thunder Shock").unwrap();
    assert!(thunder_shock.names.zh_pinyin.is_none(), "No Chinese name means no pinyin");
}

#[test]
fn type_names_have_pinyin_when_chinese_available() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let result = transform(&parsed);

    // Our test data doesn't include Chinese type names, so pinyin should be None
    let electric = result.type_refs.iter().find(|t| t.name == "Electric").unwrap();
    assert!(electric.names.zh_pinyin.is_none());
}

fn empty_parsed() -> seed::parse::ParsedData {
    seed::parse::ParsedData {
        pokemon: vec![], pokemon_types: vec![], pokemon_stats: vec![],
        pokemon_species: vec![], pokemon_species_names: vec![],
        types: vec![], type_names: vec![], type_efficacy: vec![],
        moves: vec![], move_names: vec![], pokemon_moves: vec![],
        abilities: vec![], ability_names: vec![], pokemon_abilities: vec![],
        ability_flavor_text: vec![], pokemon_forms: vec![], pokemon_form_names: vec![],
        move_flag_map: vec![], move_flags: vec![], move_meta: vec![],
    }
}

#[test]
fn move_flags_whitelisted_and_attached() {
    use seed::parse::{MoveFlagMapRow, MoveFlagRow, MoveRow, MoveNameRow};
    let mut data = empty_parsed();
    data.moves = vec![
        MoveRow { id: 1, identifier: "ice-punch".into(), generation_id: 1, type_id: 15, power: Some(75), pp: Some(15), accuracy: Some(100), priority: 0, target_id: 0, damage_class_id: 2 },
        MoveRow { id: 2, identifier: "body-slam".into(), generation_id: 1, type_id: 1, power: Some(85), pp: Some(15), accuracy: Some(100), priority: 0, target_id: 0, damage_class_id: 2 },
    ];
    data.move_names = vec![
        MoveNameRow { move_id: 1, local_language_id: 9, name: "Ice Punch".into() },
        MoveNameRow { move_id: 2, local_language_id: 9, name: "Body Slam".into() },
    ];
    data.types = vec![
        seed::parse::TypeRow { id: 1, identifier: "normal".into() },
        seed::parse::TypeRow { id: 15, identifier: "ice".into() },
    ];
    data.type_names = vec![
        seed::parse::TypeNameRow { type_id: 1, local_language_id: 9, name: "Normal".into() },
        seed::parse::TypeNameRow { type_id: 15, local_language_id: 9, name: "Ice".into() },
    ];
    data.move_flag_map = vec![
        MoveFlagMapRow { move_id: 1, move_flag_id: 1 },   // contact
        MoveFlagMapRow { move_id: 1, move_flag_id: 8 },   // punch
        MoveFlagMapRow { move_id: 1, move_flag_id: 2 },   // charge — should be filtered out
        MoveFlagMapRow { move_id: 2, move_flag_id: 1 },   // contact
    ];
    data.move_flags = vec![
        MoveFlagRow { id: 1, identifier: "contact".into() },
        MoveFlagRow { id: 2, identifier: "charge".into() },
        MoveFlagRow { id: 8, identifier: "punch".into() },
    ];
    let out = transform(&data);
    let ice_punch = out.move_summaries.iter().find(|m| m.id == 1).unwrap();
    let body_slam = out.move_summaries.iter().find(|m| m.id == 2).unwrap();
    assert_eq!(ice_punch.flags, vec!["contact".to_string(), "punch".to_string()]);
    assert_eq!(body_slam.flags, vec!["contact".to_string()]);
}

#[test]
fn move_flags_recoil_derived_from_negative_drain() {
    use seed::parse::{MoveMetaRow, MoveRow, MoveNameRow};
    let mut data = empty_parsed();
    data.moves = vec![
        MoveRow { id: 100, identifier: "double-edge".into(), generation_id: 1, type_id: 1, power: Some(120), pp: Some(15), accuracy: Some(100), priority: 0, target_id: 0, damage_class_id: 2 },
        MoveRow { id: 101, identifier: "tackle".into(), generation_id: 1, type_id: 1, power: Some(40), pp: Some(35), accuracy: Some(100), priority: 0, target_id: 0, damage_class_id: 2 },
    ];
    data.move_names = vec![
        MoveNameRow { move_id: 100, local_language_id: 9, name: "Double-Edge".into() },
        MoveNameRow { move_id: 101, local_language_id: 9, name: "Tackle".into() },
    ];
    data.types = vec![
        seed::parse::TypeRow { id: 1, identifier: "normal".into() },
    ];
    data.type_names = vec![
        seed::parse::TypeNameRow { type_id: 1, local_language_id: 9, name: "Normal".into() },
    ];
    data.move_meta = vec![
        MoveMetaRow { move_id: 100, drain: -33, meta_category_id: 0, meta_ailment_id: 0, min_hits: None, max_hits: None, min_turns: None, max_turns: None, healing: 0, crit_rate: 0, ailment_chance: 0, flinch_chance: 0, stat_chance: 0 },
        MoveMetaRow { move_id: 101, drain: 0, meta_category_id: 0, meta_ailment_id: 0, min_hits: None, max_hits: None, min_turns: None, max_turns: None, healing: 0, crit_rate: 0, ailment_chance: 0, flinch_chance: 0, stat_chance: 0 },
    ];
    let out = transform(&data);
    let de = out.move_summaries.iter().find(|m| m.id == 100).unwrap();
    let tackle = out.move_summaries.iter().find(|m| m.id == 101).unwrap();
    assert!(de.flags.contains(&"recoil".to_string()));
    assert!(!tackle.flags.contains(&"recoil".to_string()));
}

#[test]
fn move_flags_sorted_and_deduped() {
    use seed::parse::{MoveFlagMapRow, MoveFlagRow, MoveRow, MoveNameRow};
    let mut data = empty_parsed();
    data.moves = vec![
        MoveRow { id: 1, identifier: "drain-punch".into(), generation_id: 1, type_id: 2, power: Some(75), pp: Some(10), accuracy: Some(100), priority: 0, target_id: 0, damage_class_id: 2 },
    ];
    data.move_names = vec![
        MoveNameRow { move_id: 1, local_language_id: 9, name: "Drain Punch".into() },
    ];
    data.types = vec![
        seed::parse::TypeRow { id: 2, identifier: "fighting".into() },
    ];
    data.type_names = vec![
        seed::parse::TypeNameRow { type_id: 2, local_language_id: 9, name: "Fighting".into() },
    ];
    data.move_flag_map = vec![
        MoveFlagMapRow { move_id: 1, move_flag_id: 8 },
        MoveFlagMapRow { move_id: 1, move_flag_id: 1 },
        MoveFlagMapRow { move_id: 1, move_flag_id: 8 },
    ];
    data.move_flags = vec![
        MoveFlagRow { id: 1, identifier: "contact".into() },
        MoveFlagRow { id: 8, identifier: "punch".into() },
    ];
    let out = transform(&data);
    let dp = out.move_summaries.iter().find(|m| m.id == 1).unwrap();
    assert_eq!(dp.flags, vec!["contact".to_string(), "punch".to_string()]);
}
