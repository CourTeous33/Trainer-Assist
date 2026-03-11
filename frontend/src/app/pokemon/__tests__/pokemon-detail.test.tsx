import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import PokemonDetailPage from '../[id]/page';
import type { PokemonDetail, TypeRef, TypeEfficacy } from '@/lib/types';

// --- Mocks ---

let mockGetPokemon: ReturnType<typeof vi.fn>;
let mockGetTypes: ReturnType<typeof vi.fn>;
let mockGetTypeEfficacy: ReturnType<typeof vi.fn>;

vi.mock('@/lib/api', () => ({
  getPokemon: (...args: unknown[]) => mockGetPokemon(...args),
  getTypes: (...args: unknown[]) => mockGetTypes(...args),
  getTypeEfficacy: (...args: unknown[]) => mockGetTypeEfficacy(...args),
}));

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: '25' }),
}));

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { unoptimized, ...rest } = props;
    void unoptimized;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...rest} />;
  },
}));

vi.mock('@/lib/i18n', () => ({
  useLocale: () => ({ locale: 'en', t: (key: string) => key }),
  localizedName: (names: { en: string } | undefined) => names?.en ?? '',
}));

vi.mock('@/components/TypeBadge', () => ({
  default: ({ name }: { name: string }) => <span data-testid="type-badge">{name}</span>,
}));

vi.mock('@/components/TypeIcon', () => ({
  default: () => null,
}));

// --- Test Data ---

const pikachu: PokemonDetail = {
  id: 25,
  species_id: 25,
  name: 'pikachu',
  names: { en: 'Pikachu' },
  types: [{ id: 13, name: 'electric', names: { en: 'Electric' } }],
  sprite_url: 'https://example.com/25.png',
  stats: { hp: 35, attack: 55, defense: 40, special_attack: 50, special_defense: 50, speed: 90 },
  abilities: [
    { name: 'static', names: { en: 'Static' }, description: { en: 'May paralyze on contact.' }, is_hidden: false },
  ],
  moves: [{ id: 84, name: 'thunder-shock', names: { en: 'Thunder Shock' } }],
  height: 4,
  weight: 60,
  generation: 1,
};

const typeRefs: TypeRef[] = [
  { id: 5, name: 'ground', names: { en: 'Ground' } },
  { id: 13, name: 'electric', names: { en: 'Electric' } },
];

// Electric is weak to Ground (200), normal against itself (50 self, but let's use a realistic subset)
const efficacyData: TypeEfficacy[] = [
  { attacking_type_id: 5, defending_type_id: 13, damage_factor: 200 },   // ground → electric = 2x
  { attacking_type_id: 13, defending_type_id: 13, damage_factor: 50 },   // electric → electric = 0.5x
  { attacking_type_id: 5, defending_type_id: 5, damage_factor: 100 },    // ground → ground = 1x
  { attacking_type_id: 13, defending_type_id: 5, damage_factor: 0 },     // electric → ground = 0x
];

// --- Tests ---

beforeEach(() => {
  vi.clearAllMocks();
  mockGetPokemon = vi.fn();
  mockGetTypes = vi.fn();
  mockGetTypeEfficacy = vi.fn();
});

describe('PokemonDetailPage', () => {
  it('renders loading state then pokemon detail without hooks error', async () => {
    // Regression: useMemo hooks must be called before early returns.
    // When hooks were placed after `if (loading) return ...`, React threw:
    // "React has detected a change in the order of Hooks"
    // because on first render (loading=true) the useMemo hooks were skipped,
    // but after data loaded they were called — violating Rules of Hooks.

    let resolveAll: (value: [PokemonDetail, TypeRef[], TypeEfficacy[]]) => void;
    const promise = new Promise<[PokemonDetail, TypeRef[], TypeEfficacy[]]>((r) => {
      resolveAll = r;
    });

    mockGetPokemon.mockReturnValue(promise.then(([p]) => p));
    mockGetTypes.mockReturnValue(promise.then(([, t]) => t));
    mockGetTypeEfficacy.mockReturnValue(promise.then(([, , e]) => e));

    const { container } = render(<PokemonDetailPage />);

    // Should be in loading state — no hooks error
    expect(container.innerHTML).toBeTruthy();

    // Resolve data — transition from loading to loaded
    await act(async () => {
      resolveAll!([pikachu, typeRefs, efficacyData]);
    });

    // Should render pokemon name without crashing
    expect(screen.getByText('Pikachu')).toBeInTheDocument();
  });

  it('shows type effectiveness section with correct categories', async () => {
    mockGetPokemon.mockResolvedValue(pikachu);
    mockGetTypes.mockResolvedValue(typeRefs);
    mockGetTypeEfficacy.mockResolvedValue(efficacyData);

    await act(async () => {
      render(<PokemonDetailPage />);
    });

    // Ground is 2x against Electric (weak)
    expect(screen.getByText('types.weakTo2x')).toBeInTheDocument();

    // Electric is 0.5x against Electric (resist)
    expect(screen.getByText('types.resists0_5x')).toBeInTheDocument();
  });

  it('renders error state without hooks order violation', async () => {
    mockGetPokemon.mockRejectedValue(new Error('Not found'));
    mockGetTypes.mockResolvedValue(typeRefs);
    mockGetTypeEfficacy.mockResolvedValue(efficacyData);

    await act(async () => {
      render(<PokemonDetailPage />);
    });

    // Should show error without hooks crash
    expect(screen.getByText('Not found')).toBeInTheDocument();
  });

  it('renders stat bars', async () => {
    mockGetPokemon.mockResolvedValue(pikachu);
    mockGetTypes.mockResolvedValue(typeRefs);
    mockGetTypeEfficacy.mockResolvedValue(efficacyData);

    await act(async () => {
      render(<PokemonDetailPage />);
    });

    expect(screen.getByText('stat.hp')).toBeInTheDocument();
    expect(screen.getByText('stat.speed')).toBeInTheDocument();
  });

  it('displays species_id as pokedex number, not internal id', async () => {
    const altForm: PokemonDetail = {
      ...pikachu,
      id: 10100,
      species_id: 26,
      name: 'raichu-alola',
      names: { en: 'Raichu' },
    };

    mockGetPokemon.mockResolvedValue(altForm);
    mockGetTypes.mockResolvedValue(typeRefs);
    mockGetTypeEfficacy.mockResolvedValue(efficacyData);

    await act(async () => {
      render(<PokemonDetailPage />);
    });

    // Should show #026 (species_id), not #10100 (internal id)
    expect(screen.getByText('#026')).toBeInTheDocument();
  });
});
