import { MatchTicket } from "./types";

export type GameModeId =
  | "conquest"
  | "legacy_bingo"
  | "veilbreak"
  | "base_game"
  | "scadubingo"
  | "legacy_dungeons"
  | "cluedo"
  | "ringus"
  | "battleship";

export type GameModeGroup = "bingo" | "casual_games";
export type GameModeSelectGroup = GameModeGroup | "all";

export type GameModeConfig = {
  id: GameModeId;
  label: string;
  emoji?: string;
  description: string;
  group: GameModeGroup;
  totalPlayers: number;
  maxPlayers: number;
  allowedPlayerCounts: readonly number[];
  quickCommandName: string;
  quickCommandDescription: string;
  websiteUrl?: string;
  usesLobbyCode: boolean;
  usesGameSeed: boolean;
  supportsRandomTeams: boolean;
};

export type GameModeFlags = Pick<MatchTicket, GameModeId>;

export const GAME_MODES: readonly GameModeConfig[] = [
  {
    id: "conquest",
    label: "Conquest",
    emoji: "<:conquest_dragonkin:1564861211047366686>",
    description: "Search for a 1v1 Conquest Bingo match.",
    group: "bingo",
    totalPlayers: 2,
    maxPlayers: 2,
    allowedPlayerCounts: [2],
    quickCommandName: "conquest",
    quickCommandDescription:
      "Create a casual Conquest matchmaking ticket searching for 1 hour.",
    usesLobbyCode: true,
    usesGameSeed: true,
    supportsRandomTeams: false,
  },
  {
    id: "legacy_bingo",
    label: "Legacy Bingo",
    description: "Search for a 1v1 Legacy Bingo match.",
    group: "bingo",
    totalPlayers: 2,
    maxPlayers: 2,
    allowedPlayerCounts: [2],
    quickCommandName: "legacybingo",
    quickCommandDescription:
      "Create a casual Legacy Bingo matchmaking ticket searching for 1 hour.",
    usesLobbyCode: true,
    usesGameSeed: true,
    supportsRandomTeams: false,
  },
  {
    id: "veilbreak",
    label: "Veilbreak",
    emoji: "<:vcc_flask:1564861136975700100>",
    description: "Search for a 2v2 Veilbreak Bingo match.",
    group: "bingo",
    totalPlayers: 4,
    maxPlayers: 4,
    allowedPlayerCounts: [4],
    quickCommandName: "veilbreak",
    quickCommandDescription:
      "Create a casual Veilbreak matchmaking ticket searching for 1 hour.",
    usesLobbyCode: true,
    usesGameSeed: true,
    supportsRandomTeams: true,
  },
  {
    id: "base_game",
    label: "Base Game",
    description: "Search for a 1v1 Base Game Bingo match.",
    group: "bingo",
    totalPlayers: 2,
    maxPlayers: 2,
    allowedPlayerCounts: [2],
    quickCommandName: "basegame",
    quickCommandDescription:
      "Create a casual Base Game matchmaking ticket searching for 1 hour.",
    usesLobbyCode: true,
    usesGameSeed: true,
    supportsRandomTeams: false,
  },
  {
    id: "scadubingo",
    label: "Scadubingo",
    emoji: "<:scadubingo_cross:1564861186703491175>",
    description: "Search for a 1v1 Scadubingo match.",
    group: "bingo",
    totalPlayers: 2,
    maxPlayers: 2,
    allowedPlayerCounts: [2],
    quickCommandName: "scadubingo",
    quickCommandDescription:
      "Create a casual Scadubingo matchmaking ticket searching for 1 hour.",
    usesLobbyCode: true,
    usesGameSeed: true,
    supportsRandomTeams: false,
  },
  {
    id: "legacy_dungeons",
    label: "Legacy Dungeons",
    description: "Search for a Legacy Dungeons match.",
    group: "bingo",
    totalPlayers: 2,
    maxPlayers: 2,
    allowedPlayerCounts: [2],
    quickCommandName: "legacydungeons",
    quickCommandDescription:
      "Create a casual Legacy Dungeons matchmaking ticket searching for 1 hour.",
    usesLobbyCode: true,
    usesGameSeed: true,
    supportsRandomTeams: false,
  },
  {
    id: "cluedo",
    label: "Cluedo",
    description: "Search for a 6-player Cluedo match.",
    group: "casual_games",
    totalPlayers: 6,
    maxPlayers: 6,
    allowedPlayerCounts: [6],
    quickCommandName: "cluedo",
    quickCommandDescription:
      "Create a casual Cluedo matchmaking ticket searching for 1 hour.",
    websiteUrl: "https://kcbrazos.github.io/Elden-Cluedo/#/",
    usesLobbyCode: false,
    usesGameSeed: false,
    supportsRandomTeams: false,
  },
  {
    id: "battleship",
    label: "Battleship",
    emoji: "<:battleshiplogo:1564861505298632714>",
    description: "Search for a 3v3, 4v4, or 5v5 Battleship match.",
    group: "casual_games",
    totalPlayers: 6,
    maxPlayers: 10,
    allowedPlayerCounts: [6, 8, 10],
    quickCommandName: "battleship",
    quickCommandDescription:
      "Create a casual Battleship matchmaking ticket searching for 1 hour.",
    websiteUrl: "https://kcbrazos.github.io/Elden-Battleship/#/",
    usesLobbyCode: false,
    usesGameSeed: false,
    supportsRandomTeams: true,
  },
  {
    id: "ringus",
    label: "Ringus",
    description: "Search for a 3v3 Ringus match.",
    group: "casual_games",
    totalPlayers: 6,
    maxPlayers: 6,
    allowedPlayerCounts: [6],
    quickCommandName: "ringus",
    quickCommandDescription:
      "Create a casual 3v3 Ringus matchmaking ticket searching for 1 hour.",
    usesLobbyCode: false,
    usesGameSeed: false,
    supportsRandomTeams: true,
  },
] as const;

export const GAME_MODE_IDS = GAME_MODES.map((mode) => mode.id);

export function isGameModeId(value: string): value is GameModeId {
  return GAME_MODE_IDS.includes(value as GameModeId);
}

export function getGameMode(modeId: string | null | undefined) {
  if (!modeId) return null;

  return GAME_MODES.find((mode) => mode.id === modeId) ?? null;
}

export function getGameModeLabel(modeId: string | null | undefined): string {
  return getGameMode(modeId)?.label ?? "Not started";
}

export function getGameModesForSelect(group: GameModeSelectGroup) {
  if (group === "all") return GAME_MODES;

  return GAME_MODES.filter((mode) => mode.group === group);
}

export function getGameModeForCommand(commandName: string) {
  return GAME_MODES.find((mode) => mode.quickCommandName === commandName) ?? null;
}

export function modeSupportsRandomTeams(
  modeId: string | null | undefined
): boolean {
  return getGameMode(modeId)?.supportsRandomTeams ?? false;
}

export function ticketHasMode(
  ticket: GameModeFlags,
  modeId: GameModeId
): boolean {
  return Boolean(ticket[modeId]);
}

export function getTicketModeIds(ticket: GameModeFlags): GameModeId[] {
  return GAME_MODES.filter((mode) => ticketHasMode(ticket, mode.id)).map(
    (mode) => mode.id
  );
}

export function getModeNamesFromIds(
  modeIds: readonly string[] | undefined
): string {
  if (!modeIds || modeIds.length === 0) return "None";

  return modeIds
    .map((modeId) => getGameMode(modeId)?.label ?? modeId)
    .join(", ");
}

export function getTicketModeNames(ticket: GameModeFlags): string {
  const modeNames = getTicketModeIds(ticket).map((modeId) =>
    getGameModeLabel(modeId)
  );

  return modeNames.length > 0 ? modeNames.join(", ") : "None";
}

export function modesIncludeCasualGameModes(modeIds: readonly string[]): boolean {
  return modeIds.some((modeId) => getGameMode(modeId)?.group === "casual_games");
}

export function getModeFlags(modeIds: readonly string[]) {
  return Object.fromEntries(
    GAME_MODES.map((mode) => [mode.id, modeIds.includes(mode.id)])
  ) as Record<GameModeId, boolean>;
}

export function getHighestTotalPlayersForTicket(ticket: MatchTicket): number {
  const selectedModes = getTicketModeIds(ticket)
    .map((modeId) => getGameMode(modeId))
    .filter((mode): mode is GameModeConfig => Boolean(mode));

  if (selectedModes.length === 0) return 2;

  return Math.max(...selectedModes.map((mode) => mode.totalPlayers));
}

export function getHighestMaxPlayersForTicket(ticket: MatchTicket): number {
  const selectedModes = getTicketModeIds(ticket)
    .map((modeId) => getGameMode(modeId))
    .filter((mode): mode is GameModeConfig => Boolean(mode));

  if (selectedModes.length === 0) return 2;

  return Math.max(...selectedModes.map((mode) => mode.maxPlayers));
}

export function getRequiredAcceptedPlayersForMode(
  ticket: MatchTicket,
  modeId: GameModeId
): number {
  const totalPlayers = modeId === 'battleship' && [3,4,5].includes(ticket.battleship_team_size ?? 0)
    ? ticket.battleship_team_size! * 2 : getGameMode(modeId)?.totalPlayers ?? 2;
  const hostPlayerCount = ticket.host_is_player ? 1 : 0;

  return totalPlayers - hostPlayerCount;
}
