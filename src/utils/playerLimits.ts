import { MatchTicket, MatchTicketAcceptance } from "../types";

export type StartMode = "veilbreak" | "base_game" | "scadubingo";

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
  const totalRequiredPlayers = ticket.veilbreak ? 4 : 2;

  return totalRequiredPlayers - hostPlayerCount;
}

export function getTotalRequiredPlayers(ticket: MatchTicket): number {
  return ticket.veilbreak ? 4 : 2;
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
  if (ticket.veilbreak) {
    return ticket.host_is_player
      ? "Veilbreak requires exactly 4 total players: host + 3 accepted players."
      : "Veilbreak requires exactly 4 accepted players because the host is not playing.";
  }

  return ticket.host_is_player
    ? "This mode requires exactly 2 total players: host + 1 accepted player."
    : "This mode requires exactly 2 accepted players because the host is not playing.";
}

export function getStartModeLabel(startedMode: string | null): string {
  if (startedMode === "veilbreak") return "Veilbreak";
  if (startedMode === "base_game") return "Base Game";
  if (startedMode === "scadubingo") return "Scadubingo";
  return "Not started";
}

export function getStartModeOptionsForTicket(
  ticket: MatchTicket,
  acceptances: MatchTicketAcceptance[]
): StartModeResult {
  const playerAcceptances = getPlayerAcceptances(acceptances);
  const acceptedCount = playerAcceptances.length;

  const oneVOneOptions: StartModeOption[] = [];

  if (ticket.base_game) {
    oneVOneOptions.push({
      mode: "base_game",
      label: "Base Game",
    });
  }

  if (ticket.scadubingo) {
    oneVOneOptions.push({
      mode: "scadubingo",
      label: "Scadubingo",
    });
  }

  // Competitive stays strict.
  if (ticket.matchmaking_type === "competitive") {
    const requiredAcceptedPlayers = getRequiredAcceptedPlayers(ticket);

    const competitiveMode: StartMode | null = ticket.veilbreak
      ? "veilbreak"
      : ticket.base_game
        ? "base_game"
        : ticket.scadubingo
          ? "scadubingo"
          : null;

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

  // Casual Veilbreak starts as Veilbreak when it has enough players.
  if (ticket.veilbreak && acceptedCount >= 3) {
    return {
      canStart: true,
      autoStartMode: "veilbreak",
      options: [],
      requiredAcceptedPlayers: 3,
      message: "Ready to start as Veilbreak.",
    };
  }

  // Casual 1v1 modes can start with 1 accepted player.
  // If both Base Game and Scadubingo are selected, host chooses which one. 
  if (acceptedCount >= 1 && oneVOneOptions.length > 0) {
    return {
      canStart: true,
      autoStartMode: oneVOneOptions.length === 1 ? oneVOneOptions[0].mode : null,
      options: oneVOneOptions,
      requiredAcceptedPlayers: 1,
      message:
        oneVOneOptions.length === 1
          ? `Ready to start as ${oneVOneOptions[0].label}.`
          : "Choose which 1v1 mode to start as.",
    };
  }

  // Casual Veilbreak only.
  if (ticket.veilbreak && oneVOneOptions.length === 0) {
    return {
      canStart: false,
      autoStartMode: null,
      options: [],
      requiredAcceptedPlayers: 3,
      message: "Veilbreak requires 3 accepted players before starting.",
    };
  }

  // Casual 1v1 only.
  return {
    canStart: false,
    autoStartMode: null,
    options: [],
    requiredAcceptedPlayers: 1,
    message: "This mode requires 1 accepted player before starting.",
  };
}