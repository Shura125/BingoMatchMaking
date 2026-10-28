import { MatchTicket, MatchTicketAcceptance } from "../types";
import {
  GameModeId,
  getGameMode,
  getGameModeLabel,
  getRequiredAcceptedPlayersForMode,
  getTicketModeIds,
} from "../gameModes";

export type StartMode = GameModeId;

export type StartModeOption = {
  mode: StartMode;
  label: string;
};

export type StartModeResult = {
  canStart: boolean;
  autoStartMode: StartMode | null;
  options: StartModeOption[];
  requiredAcceptedPlayers: number;
  message: string;
};

export function getRequiredAcceptedPlayers(ticket: MatchTicket): number {
  const hostPlayerCount = ticket.host_is_player ? 1 : 0;
  const totalRequiredPlayers = getTotalRequiredPlayers(ticket);

  return totalRequiredPlayers - hostPlayerCount;
}

export function getMaxAcceptedPlayers(ticket: MatchTicket): number {
  const hostPlayerCount = ticket.host_is_player ? 1 : 0;
  const maxPlayers = getMaxTotalPlayers(ticket);

  return maxPlayers - hostPlayerCount;
}

export function getTotalRequiredPlayers(ticket: MatchTicket): number {
  const startedMode = getGameMode(ticket.started_mode);
  if (startedMode) return getAllowedPlayerCounts(ticket, startedMode.id)[0];

  const selectedModes = getTicketModeIds(ticket)
    .map((modeId) => getGameMode(modeId))
    .filter((mode) => mode !== null);

  if (selectedModes.length === 0) return 2;

  return Math.max(...selectedModes.map((mode) => getAllowedPlayerCounts(ticket, mode.id)[0]));
}

export function getMaxTotalPlayers(ticket: MatchTicket): number {
  const startedMode = getGameMode(ticket.started_mode);
  if (startedMode) return Math.max(...getAllowedPlayerCounts(ticket, startedMode.id));

  const modes = getTicketModeIds(ticket);
  return modes.length ? Math.max(...modes.map(id => Math.max(...getAllowedPlayerCounts(ticket, id)))) : 2;
}

export function getAllowedPlayerCounts(ticket: MatchTicket, modeId: GameModeId): readonly number[] {
  if (modeId === 'battleship' && [3, 4, 5].includes(ticket.battleship_team_size ?? 0)) {
    return [ticket.battleship_team_size! * 2];
  }
  return getGameMode(modeId)?.allowedPlayerCounts ?? [];
}

export function getCurrentPlayerCount(
  ticket: MatchTicket,
  acceptances: MatchTicketAcceptance[]
): number {
  const hostPlayerCount = ticket.host_is_player ? 1 : 0;

  return hostPlayerCount + getPlayerAcceptances(acceptances).length;
}

export function getPlayerAcceptances(
  acceptances: MatchTicketAcceptance[]
): MatchTicketAcceptance[] {
  return acceptances.filter(
    (acceptance) => acceptance.acceptance_type === "player"
  );
}

export function getPlayerRequirementText(ticket: MatchTicket): string {
  const modeIds = ticket.started_mode && getGameMode(ticket.started_mode)
    ? [ticket.started_mode]
    : getTicketModeIds(ticket);
  const requirements = modeIds.map((modeId) => {
    const mode = getGameMode(modeId)!;
    return `${mode.label}: exactly ${getAllowedPlayerCounts(ticket, mode.id).join(" or ")} total players.`;
  });

  return [
    ...requirements,
    ticket.host_is_player
      ? "The host counts as one player; refs do not count."
      : "The host is only organizing; refs do not count as players.",
  ].join("\n");
}

export function canStartModeWithPlayers(
  ticket: MatchTicket,
  modeId: GameModeId,
  acceptances: MatchTicketAcceptance[]
): boolean {
  const mode = getGameMode(modeId);
  return Boolean(
    mode &&
    getTicketModeIds(ticket).includes(modeId) &&
    getAllowedPlayerCounts(ticket, modeId).includes(getCurrentPlayerCount(ticket, acceptances))
  );
}

export function getStartModeLabel(startedMode: string | null): string {
  return getGameModeLabel(startedMode);
}

export function getStartModeOptionsForTicket(
  ticket: MatchTicket,
  acceptances: MatchTicketAcceptance[]
): StartModeResult {
  const selectedModeIds = getTicketModeIds(ticket);
  const availableOptions = selectedModeIds.map((modeId) => ({
    mode: modeId,
    label: getGameModeLabel(modeId),
  }));

  const startableOptions = availableOptions.filter(
    (option) => canStartModeWithPlayers(ticket, option.mode, acceptances)
  );

  if (startableOptions.length > 0) {
    return {
      canStart: true,
      autoStartMode:
        startableOptions.length === 1 ? startableOptions[0].mode : null,
      options: startableOptions,
      requiredAcceptedPlayers: Math.min(
        ...startableOptions.map((option) =>
          getRequiredAcceptedPlayersForMode(ticket, option.mode)
        )
      ),
      message:
        startableOptions.length === 1
          ? `Ready to start as ${startableOptions[0].label}.`
          : "Choose which mode to start as.",
    };
  }

  const nextRequiredAcceptedPlayers =
    availableOptions.length > 0
      ? Math.min(
          ...availableOptions.map((option) =>
            getRequiredAcceptedPlayersForMode(ticket, option.mode)
          )
        )
      : getRequiredAcceptedPlayers(ticket);

  return {
    canStart: false,
    autoStartMode: null,
    options: [],
    requiredAcceptedPlayers: nextRequiredAcceptedPlayers,
    message: `The current roster does not fit a selected mode.\n${getPlayerRequirementText(ticket)}`,
  };
}
