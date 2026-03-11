import { describe, it, expect } from 'vitest';
import { formatPokemonId } from '../format';

describe('formatPokemonId', () => {
  it('pads single digit IDs', () => {
    expect(formatPokemonId(1)).toBe('#001');
  });

  it('pads double digit IDs', () => {
    expect(formatPokemonId(25)).toBe('#025');
  });

  it('keeps triple digit IDs as-is', () => {
    expect(formatPokemonId(150)).toBe('#150');
  });

  it('does not pad 4+ digit IDs', () => {
    expect(formatPokemonId(1000)).toBe('#1000');
  });

  it('handles zero', () => {
    expect(formatPokemonId(0)).toBe('#000');
  });
});

describe('pokedex number display (species_id fallback)', () => {
  // This tests the pattern used in PokemonCard and PokemonDetailPage:
  // formatPokemonId(pokemon.species_id ?? pokemon.id)

  it('uses species_id for the true pokedex number', () => {
    const pokemon = { species_id: 898, id: 10194 };
    expect(formatPokemonId(pokemon.species_id ?? pokemon.id)).toBe('#898');
  });

  it('falls back to id when species_id is undefined (old data)', () => {
    const pokemon = { species_id: undefined as unknown as number, id: 25 };
    expect(formatPokemonId(pokemon.species_id ?? pokemon.id)).toBe('#025');
  });

  it('uses species_id for default forms (same as id)', () => {
    const pokemon = { species_id: 25, id: 25 };
    expect(formatPokemonId(pokemon.species_id ?? pokemon.id)).toBe('#025');
  });

  it('uses species_id for regional variants', () => {
    // Alolan Raichu: pokemon_id=10100, species_id=26
    const pokemon = { species_id: 26, id: 10100 };
    expect(formatPokemonId(pokemon.species_id ?? pokemon.id)).toBe('#026');
  });

  it('falls back to id when species_id is null', () => {
    const pokemon = { species_id: null as unknown as number, id: 150 };
    expect(formatPokemonId(pokemon.species_id ?? pokemon.id)).toBe('#150');
  });
});
