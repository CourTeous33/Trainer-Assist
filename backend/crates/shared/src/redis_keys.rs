pub const POKEMON_LIST: &str = "pokemon:list";
pub const TYPE_EFFICACY: &str = "type:efficacy";
pub const MOVE_LIST: &str = "move:list";
pub const TYPE_LIST: &str = "type:list";

pub fn pokemon_detail(id: i32) -> String {
    format!("pokemon:{}", id)
}

pub fn type_pokemon(type_id: i32) -> String {
    format!("type:{}:pokemon", type_id)
}
