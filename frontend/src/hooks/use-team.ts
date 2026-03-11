"use client";

import { useState } from "react";
import type { Team } from "../lib/types";
import * as store from "../lib/team-store";

export function useTeams() {
  const [teams, setTeams] = useState<Team[]>(() => store.getTeams());

  function createTeam(name: string): Team {
    const team = store.createTeam(name);
    setTeams(store.getTeams());
    return team;
  }

  function updateTeam(team: Team): void {
    store.updateTeam(team);
    setTeams(store.getTeams());
  }

  function deleteTeam(id: string): void {
    store.deleteTeam(id);
    setTeams(store.getTeams());
  }

  return { teams, createTeam, updateTeam, deleteTeam };
}
