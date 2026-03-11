import type { Team } from "./types";

const STORAGE_KEY = "trainer-assist-teams";

export function getTeams(): Team[] {
  if (typeof window === "undefined") return [];
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Team[];
  } catch {
    return [];
  }
}

export function saveTeams(teams: Team[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(teams));
}

export function createTeam(name: string): Team {
  const team: Team = {
    id: crypto.randomUUID(),
    name,
    pokemon: [null, null, null, null, null, null],
  };
  const teams = getTeams();
  teams.push(team);
  saveTeams(teams);
  return team;
}

export function updateTeam(team: Team): void {
  const teams = getTeams();
  const idx = teams.findIndex((t) => t.id === team.id);
  if (idx === -1) {
    teams.push(team);
  } else {
    teams[idx] = team;
  }
  saveTeams(teams);
}

export function deleteTeam(id: string): void {
  const teams = getTeams().filter((t) => t.id !== id);
  saveTeams(teams);
}
