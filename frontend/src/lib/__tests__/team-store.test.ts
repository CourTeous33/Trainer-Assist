import { describe, it, expect, beforeEach, vi } from 'vitest';
import { getTeams, saveTeams, createTeam, updateTeam, deleteTeam } from '../team-store';
import type { Team } from '../types';

// Mock localStorage
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: vi.fn((key: string) => store[key] ?? null),
  setItem: vi.fn((key: string, value: string) => { store[key] = value; }),
  removeItem: vi.fn((key: string) => { delete store[key]; }),
  clear: vi.fn(() => { Object.keys(store).forEach(k => delete store[k]); }),
  length: 0,
  key: vi.fn(() => null),
};

Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock });

// Mock crypto.randomUUID
vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-123' });

beforeEach(() => {
  localStorageMock.clear();
  vi.clearAllMocks();
});

describe('getTeams', () => {
  it('returns empty array when localStorage is empty', () => {
    expect(getTeams()).toEqual([]);
  });

  it('returns parsed teams from localStorage', () => {
    const teams: Team[] = [{ id: '1', name: 'Team 1', pokemon: [null, null, null, null, null, null] }];
    store['trainer-assist-teams'] = JSON.stringify(teams);
    expect(getTeams()).toEqual(teams);
  });

  it('returns empty array on corrupted JSON', () => {
    store['trainer-assist-teams'] = 'not valid json{{{';
    expect(getTeams()).toEqual([]);
  });
});

describe('saveTeams', () => {
  it('persists teams to localStorage', () => {
    const teams: Team[] = [{ id: '1', name: 'Team 1', pokemon: [null, null, null, null, null, null] }];
    saveTeams(teams);
    expect(localStorageMock.setItem).toHaveBeenCalledWith(
      'trainer-assist-teams',
      JSON.stringify(teams)
    );
  });
});

describe('createTeam', () => {
  it('creates a team with 6 null slots', () => {
    const team = createTeam('My Team');
    expect(team.name).toBe('My Team');
    expect(team.id).toBe('test-uuid-123');
    expect(team.pokemon).toEqual([null, null, null, null, null, null]);
  });

  it('persists the created team', () => {
    createTeam('My Team');
    const teams = getTeams();
    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe('My Team');
  });
});

describe('updateTeam', () => {
  it('updates an existing team', () => {
    const team = createTeam('Original');
    const updated = { ...team, name: 'Updated' };
    updateTeam(updated);
    const teams = getTeams();
    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe('Updated');
  });

  it('adds a team if it does not exist', () => {
    const team: Team = { id: 'new-id', name: 'New', pokemon: [null, null, null, null, null, null] };
    updateTeam(team);
    const teams = getTeams();
    expect(teams).toHaveLength(1);
    expect(teams[0].id).toBe('new-id');
  });
});

describe('deleteTeam', () => {
  it('removes a team by ID', () => {
    createTeam('Team A');
    // Reset the UUID mock for a different ID
    vi.stubGlobal('crypto', { randomUUID: () => 'test-uuid-456' });
    createTeam('Team B');
    deleteTeam('test-uuid-123');
    const teams = getTeams();
    expect(teams).toHaveLength(1);
    expect(teams[0].name).toBe('Team B');
  });

  it('does nothing if team ID not found', () => {
    createTeam('Team A');
    deleteTeam('nonexistent');
    const teams = getTeams();
    expect(teams).toHaveLength(1);
  });
});
