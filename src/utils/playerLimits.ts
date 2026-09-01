import { MatchTicket, MatchTicketAcceptance } from "../types";
import {
  GameModeId,
  getGameMode,
  getGameModeLabel,
  getHighestMaxPlayersForTicket,
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
  const selectedModes = getTicketModeIds(ticket)
    .map((modeId) => getGameMode(modeId))
    .filter((mode) => mode !== null);

  if (selectedModes.length === 0) return 2;

  return Math.max(...selectedModes.map((mode) => mode.totalPlayers));
}

export function getMaxTotalPlayers(ticket: MatchTicket): number {
  return getHighestMaxPlayersForTicket(ticket);
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
  const totalRequiredPlayers = getTotalRequiredPlayers(ticket);
  const maxPlayers = getMaxTotalPlayers(ticket);
  const acceptedPlayers = getRequiredAcceptedPlayers(ticket);
  const maxAcceptedPlayers = getMaxAcceptedPlayers(ticket);

  if (maxPlayers > totalRequiredPlayers) {
    return ticket.host_is_player
      ? `This ticket needs ${totalRequiredPlayers} total players to start and can hold up to ${maxPlayers}: host + up to ${maxAcceptedPlayers} accepted players.`
      : `This ticket needs ${acceptedPlayers} accepted players to start and can hold up to ${maxAcceptedPlayers} accepted players.`;
  }

  if (ticket.host_is_player) {
    return `This ticket requires exactly ${totalRequiredPlayers} total players: host + ${acceptedPlayers} accepted player${
      acceptedPlayers === 1 ? "" : "s"
    }.`;
  }

  return `This ticket requires exactly ${acceptedPlayers} accepted player${
    acceptedPlayers === 1 ? "" : "s"
  } because the host is not playing.`;
}

export function getStartModeLabel(startedMode: string | null): string {
  return getGameModeLabel(startedMode);
}

export function getStartModeOptionsForTicket(
  ticket: MatchTicket,
  acceptances: MatchTicketAcceptance[]
): StartModeResult {
  const playerAcceptances = getPlayerAcceptances(acceptances);
  const acceptedCount = playerAcceptances.length;

  const selectedModeIds = getTicketModeIds(ticket);
  const availableOptions = selectedModeIds.map((modeId) => ({
    mode: modeId,
    label: getGameModeLabel(modeId),
  }));

  // Competitive stays strict.
  if (ticket.matchmaking_type === "competitive") {
    const requiredAcceptedPlayers = getRequiredAcceptedPlayers(ticket);
    const competitiveMode = selectedModeIds[0] ?? null;

    return {
      canStart: acceptedCount === requiredAcceptedPlayers,
      autoStartMode: competitiveMode,
      options: [],
      requiredAcceptedPlayers,
      message:
        acceptedCount === requiredAcceptedPlayers
          ? "Ready to start."
          : `Competitive requires exactly ${requiredAcceptedPlayers} accepted player${
              requiredAcceptedPlayers === 1 ? "" : "s"
            }.`,
    };
  }

  const startableOptions = availableOptions.filter(
    (option) =>
      acceptedCount >= getRequiredAcceptedPlayersForMode(ticket, option.mode)
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
    message: `This ticket requires ${nextRequiredAcceptedPlayers} accepted player${
      nextRequiredAcceptedPlayers === 1 ? "" : "s"
    } before starting.`,
  };
}
