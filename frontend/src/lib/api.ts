import type {
  PokemonSummary,
  PokemonDetail,
  TypeRef,
  TypeEfficacy,
  MoveSummary,
} from "./types";

const BASE_URL =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001";
const API_PREFIX = `${BASE_URL}/api/v1`;

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export async function fetchApi<T>(
  path: string,
  params?: Record<string, string | number | undefined>,
): Promise<T> {
  const url = new URL(`${API_PREFIX}${path}`);

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== "") {
        url.searchParams.set(key, String(value));
      }
    }
  }

  const res = await fetch(url.toString());

  if (!res.ok) {
    const body = await res.text().catch(() => "Unknown error");
    throw new ApiError(res.status, body);
  }

  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Pokemon
// ---------------------------------------------------------------------------

export interface PokemonListParams {
  offset?: number;
  limit?: number;
  type?: string;
  type2?: string;
  search?: string;
  generation?: number;
}

export interface PokemonListResponse {
  items: PokemonSummary[];
  total: number;
}

export function getPokemonList(
  params: PokemonListParams = {},
): Promise<PokemonListResponse> {
  return fetchApi<PokemonListResponse>("/pokemon", {
    offset: params.offset,
    limit: params.limit,
    type: params.type,
    type2: params.type2,
    search: params.search,
    generation: params.generation,
  });
}

export function getPokemon(id: number): Promise<PokemonDetail> {
  return fetchApi<PokemonDetail>(`/pokemon/${id}`);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export function getTypes(): Promise<TypeRef[]> {
  return fetchApi<TypeRef[]>("/types");
}

export function getTypeEfficacy(): Promise<TypeEfficacy[]> {
  return fetchApi<TypeEfficacy[]>("/types/efficacy");
}

export function getTypePokemon(typeId: number): Promise<PokemonSummary[]> {
  return fetchApi<PokemonSummary[]>(`/types/${typeId}/pokemon`);
}

// ---------------------------------------------------------------------------
// Moves
// ---------------------------------------------------------------------------

export interface MoveListParams {
  search?: string;
  type_id?: number;
  damage_class?: string;
}

export function getMoves(params: MoveListParams = {}): Promise<MoveSummary[]> {
  return fetchApi<MoveSummary[]>("/moves", {
    search: params.search,
    type_id: params.type_id,
    damage_class: params.damage_class,
  });
}
