export interface LocalizedNames {
  en: string;
  ja?: string;
  zh?: string;
}

export interface TypeRef {
  id: number;
  name: string;
  names: LocalizedNames;
}

export interface PokemonSummary {
  id: number;
  species_id: number;
  name: string;
  names: LocalizedNames;
  types: TypeRef[];
  sprite_url: string;
}

export interface Stats {
  hp: number;
  attack: number;
  defense: number;
  special_attack: number;
  special_defense: number;
  speed: number;
}

export interface PokemonMoveRef {
  id: number;
  name: string;
  names: LocalizedNames;
}

export interface AbilityInfo {
  name: string;
  names: LocalizedNames;
  description: LocalizedNames;
  is_hidden: boolean;
}

export interface PokemonDetail {
  id: number;
  species_id: number;
  name: string;
  names: LocalizedNames;
  species_names: LocalizedNames;
  types: TypeRef[];
  sprite_url: string;
  stats: Stats;
  abilities: AbilityInfo[];
  moves: PokemonMoveRef[];
  height: number;
  weight: number;
  generation: number;
}

export interface TypeEfficacy {
  attacking_type_id: number;
  defending_type_id: number;
  damage_factor: number;
}

export interface MoveSummary {
  id: number;
  name: string;
  names: LocalizedNames;
  type_ref: TypeRef;
  power: number | null;
  accuracy: number | null;
  pp: number | null;
  damage_class: string;
}

export interface Team {
  id: string;
  name: string;
  pokemon: (PokemonSummary | null)[]; // 6 slots
}
