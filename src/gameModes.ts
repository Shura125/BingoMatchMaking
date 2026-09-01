import { MatchTicket } from "./types";

export type GameModeId =
  | "veilbreak"
  | "base_game"
  | "scadubingo"
  | "legacy_dungeons"
  | "cluedo"
  | "battleship";

export type GameModeGroup = "bingo" | "casual_games";
export type GameModeSelectGroup = GameModeGroup | "all";

export type GameModeConfig = {
  id: GameModeId;
  label: string;
  description: string;
  group: GameModeGroup;
  totalPlayers: number;
  maxPlayers: number;
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
    id: "veilbreak",
    label: "Veilbreak",
    description: "Search for a Veilbreak match.",
    group: "bingo",
    totalPlayers: 4,
    maxPlayers: 4,
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
    description: "Search for a Base Game match.",
    group: "bingo",
    totalPlayers: 2,
    maxPlayers: 2,
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
    description: "Search for a Scadubingo match.",
    group: "bingo",
    totalPlayers: 2,
    maxPlayers: 2,
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
    description: "Search for a 6-player Battleship match, expandable to 10.",
    group: "casual_games",
    totalPlayers: 6,
    maxPlayers: 10,
    quickCommandName: "battleship",
    quickCommandDescription:
      "Create a casual Battleship matchmaking ticket searching for 1 hour.",
    websiteUrl: "https://kcbrazos.github.io/Elden-Battleship/#/",
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
  const totalPlayers = getGameMode(modeId)?.totalPlayers ?? 2;
  const hostPlayerCount = ticket.host_is_player ? 1 : 0;

  return totalPlayers - hostPlayerCount;
}
