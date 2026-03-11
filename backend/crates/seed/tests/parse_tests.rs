use std::collections::HashMap;

use seed::parse::parse_all;

fn make_csvs() -> HashMap<String, String> {
    let mut csvs = HashMap::new();

    csvs.insert("pokemon.csv".into(),
        "id,identifier,species_id,height,weight,base_experience,order,is_default\n\
         25,pikachu,25,4,60,112,35,1\n\
         26,raichu,26,8,300,218,36,1\n".into());

    csvs.insert("pokemon_types.csv".into(),
        "pokemon_id,type_id,slot\n\
         25,13,1\n\
         26,13,1\n".into());

    csvs.insert("pokemon_stats.csv".into(),
        "pokemon_id,stat_id,base_stat,effort\n\
         25,1,35,0\n\
         25,2,55,0\n\
         25,3,40,0\n\
         25,4,50,0\n\
         25,5,50,0\n\
         25,6,90,2\n".into());

    csvs.insert("pokemon_species.csv".into(),
        "id,identifier,generation_id,evolves_from_species_id,evolution_chain_id,color_id,shape_id,habitat_id,gender_rate,capture_rate,base_happiness,is_baby,hatch_counter,has_gender_differences,growth_rate_id,forms_switchable,is_legendary,is_mythical,order,conquest_order\n\
         25,pikachu,1,,10,10,8,2,4,190,70,0,10,1,1,0,0,0,35,\n\
         26,raichu,1,25,10,10,6,2,4,75,70,0,10,1,1,0,0,0,36,\n".into());

    csvs.insert("pokemon_species_names.csv".into(),
        "pokemon_species_id,local_language_id,name,genus\n\
         25,9,Pikachu,Mouse Pokémon\n\
         25,1,ピカチュウ,ねずみポケモン\n\
         25,12,皮卡丘,鼠宝可梦\n\
         26,9,Raichu,Mouse Pokémon\n".into());

    csvs.insert("types.csv".into(),
        "id,identifier,generation_id,damage_class_id\n\
         1,normal,1,\n\
         10,fire,1,\n\
         13,electric,1,\n\
         19,stellar,9,\n\
         10001,unknown,1,\n\
         10002,shadow,3,\n".into());

    csvs.insert("type_names.csv".into(),
        "type_id,local_language_id,name\n\
         1,9,Normal\n\
         10,9,Fire\n\
         13,9,Electric\n\
         13,1,でんき\n\
         13,12,电\n\
         19,9,Stellar\n\
         10001,9,???\n\
         10002,9,Shadow\n".into());

    csvs.insert("type_efficacy.csv".into(),
        "damage_type_id,target_type_id,damage_factor\n\
         13,11,200\n\
         10,11,50\n".into());

    csvs.insert("moves.csv".into(),
        "id,identifier,generation_id,type_id,power,pp,accuracy,priority,target_id,damage_class_id,effect_id,effect_chance,contest_type_id,contest_effect_id,super_contest_effect_id\n\
         84,thunder-shock,1,13,40,30,100,0,10,3,,,1,,\n\
         85,thunderbolt,1,13,90,15,100,0,10,3,,,1,,\n".into());

    csvs.insert("move_names.csv".into(),
        "move_id,local_language_id,name\n\
         84,9,Thunder Shock\n\
         84,1,でんきショック\n\
         85,9,Thunderbolt\n".into());

    csvs.insert("pokemon_moves.csv".into(),
        "pokemon_id,version_group_id,move_id,pokemon_move_method_id,level,order\n\
         25,1,84,1,1,\n\
         25,1,85,1,26,\n".into());

    csvs.insert("stats.csv".into(),
        "id,damage_class_id,identifier,is_battle_only,game_index\n\
         1,,hp,0,1\n".into());

    csvs.insert("abilities.csv".into(),
        "id,identifier,generation_id,is_main_series\n\
         9,static,3,1\n".into());

    csvs.insert("ability_names.csv".into(),
        "ability_id,local_language_id,name\n\
         9,9,Static\n\
         9,1,せいでんき\n".into());

    csvs.insert("pokemon_abilities.csv".into(),
        "pokemon_id,ability_id,is_hidden,slot\n\
         25,9,0,1\n".into());

    csvs.insert("ability_flavor_text.csv".into(),
        "ability_id,version_group_id,language_id,flavor_text\n\
         9,20,9,The Pokemon is charged with static electricity so contact with it may cause paralysis.\n\
         9,15,9,Older description.\n\
         9,20,1,せいでんきを　おびた　からだに　さわると　しびれることがある。\n".into());

    csvs
}

#[test]
fn parse_all_succeeds_with_valid_data() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();

    assert_eq!(parsed.pokemon.len(), 2);
    assert_eq!(parsed.pokemon[0].identifier, "pikachu");
    assert_eq!(parsed.pokemon[1].identifier, "raichu");
    assert_eq!(parsed.pokemon_types.len(), 2);
    assert_eq!(parsed.pokemon_stats.len(), 6);
    assert_eq!(parsed.types.len(), 6);
    assert_eq!(parsed.moves.len(), 2);
}

#[test]
fn parse_all_handles_empty_csv() {
    let mut csvs = make_csvs();
    csvs.insert("pokemon_moves.csv".into(), "".into());
    let parsed = parse_all(&csvs).unwrap();
    assert_eq!(parsed.pokemon_moves.len(), 0);
}

#[test]
fn parse_all_handles_missing_csv() {
    let mut csvs = make_csvs();
    csvs.remove("pokemon_moves.csv");
    let parsed = parse_all(&csvs).unwrap();
    assert_eq!(parsed.pokemon_moves.len(), 0);
}

#[test]
fn parse_pokemon_row_fields() {
    let csvs = make_csvs();
    let parsed = parse_all(&csvs).unwrap();
    let pikachu = &parsed.pokemon[0];
    assert_eq!(pikachu.id, 25);
    assert_eq!(pikachu.species_id, 25);
    assert_eq!(pikachu.height, 4);
    assert_eq!(pikachu.weight, 60);
    assert_eq!(pikachu.is_default, 1);
}
