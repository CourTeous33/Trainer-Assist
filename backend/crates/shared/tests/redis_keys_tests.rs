use shared::redis_keys;

#[test]
fn pokemon_list_key() {
    assert_eq!(redis_keys::POKEMON_LIST, "pokemon:list");
}

#[test]
fn type_list_key() {
    assert_eq!(redis_keys::TYPE_LIST, "type:list");
}

#[test]
fn type_efficacy_key() {
    assert_eq!(redis_keys::TYPE_EFFICACY, "type:efficacy");
}

#[test]
fn move_list_key() {
    assert_eq!(redis_keys::MOVE_LIST, "move:list");
}

#[test]
fn pokemon_detail_key() {
    assert_eq!(redis_keys::pokemon_detail(25), "pokemon:25");
    assert_eq!(redis_keys::pokemon_detail(1), "pokemon:1");
    assert_eq!(redis_keys::pokemon_detail(1000), "pokemon:1000");
}

#[test]
fn type_pokemon_key() {
    assert_eq!(redis_keys::type_pokemon(10), "type:10:pokemon");
    assert_eq!(redis_keys::type_pokemon(1), "type:1:pokemon");
}
