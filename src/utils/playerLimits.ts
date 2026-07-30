import { MatchTicket, MatchTicketAcceptance } from "../types";

export type StartMode =
  | "veilbreak"
  | "base_game"
  | "scadubingo"
  | "legacy_dungeons"
  | "cluedo"
  | "battleship";

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

export function getTotalRequiredPlayers(ticket: MatchTicket): number {
  if (ticket.cluedo || ticket.battleship) return 6;
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
  if (ticket.cluedo || ticket.battleship) {
    return ticket.host_is_player
      ? "Cluedo and Battleship require exactly 6 total players: host + 5 accepted players."
      : "Cluedo and Battleship require exactly 6 accepted players because the host is not playing.";
  }

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
  if (startedMode === "legacy_dungeons") return "Legacy Dungeons";
  if (startedMode === "cluedo") return "Cluedo";
  if (startedMode === "battleship") return "Battleship";
  return "Not started";
}

function getModeRequiredAcceptedPlayers(
  ticket: MatchTicket,
  totalRequiredPlayers: number
): number {
  const hostPlayerCount = ticket.host_is_player ? 1 : 0;

  return totalRequiredPlayers - hostPlayerCount;
}

export function getStartModeOptionsForTicket(
  ticket: MatchTicket,
  acceptances: MatchTicketAcceptance[]
): StartModeResult {
  const playerAcceptances = getPlayerAcceptances(acceptances);
  const acceptedCount = playerAcceptances.length;

  const availableOptions: StartModeOption[] = [];

  if (ticket.base_game) {
    availableOptions.push({
      mode: "base_game",
      label: "Base Game",
    });
  }

  if (ticket.scadubingo) {
    availableOptions.push({
      mode: "scadubingo",
      label: "Scadubingo",
    });
  }

  if (ticket.legacy_dungeons) {
    availableOptions.push({
      mode: "legacy_dungeons",
      label: "Legacy Dungeons",
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
      : ticket.legacy_dungeons
      ? "legacy_dungeons"
      : ticket.cluedo
      ? "cluedo"
      : ticket.battleship
      ? "battleship"
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

  const startableOptions: StartModeOption[] = [];

  if (
    ticket.veilbreak &&
    acceptedCount >= getModeRequiredAcceptedPlayers(ticket, 4)
  ) {
    startableOptions.push({
      mode: "veilbreak",
      label: "Veilbreak",
    });
  }

  if (acceptedCount >= getModeRequiredAcceptedPlayers(ticket, 2)) {
    startableOptions.push(...availableOptions);
  }

  if (
    ticket.cluedo &&
    acceptedCount >= getModeRequiredAcceptedPlayers(ticket, 6)
  ) {
    startableOptions.push({
      mode: "cluedo",
      label: "Cluedo",
    });
  }

  if (
    ticket.battleship &&
    acceptedCount >= getModeRequiredAcceptedPlayers(ticket, 6)
  ) {
    startableOptions.push({
      mode: "battleship",
      label: "Battleship",
    });
  }

  if (startableOptions.length > 0) {
    return {
      canStart: true,
      autoStartMode:
        startableOptions.length === 1 ? startableOptions[0].mode : null,
      options: startableOptions,
      requiredAcceptedPlayers: Math.min(
        ...startableOptions.map((option) => {
          if (option.mode === "cluedo" || option.mode === "battleship") {
            return getModeRequiredAcceptedPlayers(ticket, 6);
          }

          if (option.mode === "veilbreak") {
            return getModeRequiredAcceptedPlayers(ticket, 4);
          }

          return getModeRequiredAcceptedPlayers(ticket, 2);
        })
      ),
      message:
        startableOptions.length === 1
          ? `Ready to start as ${startableOptions[0].label}.`
          : "Choose which mode to start as.",
    };
  }

  if (availableOptions.length > 0) {
    return {
      canStart: false,
      autoStartMode: null,
      options: [],
      requiredAcceptedPlayers: getModeRequiredAcceptedPlayers(ticket, 2),
      message: "This mode requires 1 accepted player before starting.",
    };
  }

  if (ticket.veilbreak) {
    return {
      canStart: false,
      autoStartMode: null,
      options: [],
      requiredAcceptedPlayers: getModeRequiredAcceptedPlayers(ticket, 4),
      message: "Veilbreak requires 3 accepted players before starting.",
    };
  }

  return {
    canStart: false,
    autoStartMode: null,
    options: [],
    requiredAcceptedPlayers: getModeRequiredAcceptedPlayers(ticket, 6),
    message: "Cluedo and Battleship require 5 accepted players before starting.",
  };
}
