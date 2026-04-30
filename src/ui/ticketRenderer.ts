import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  EmbedBuilder,
} from "discord.js";
import { MatchTicket, MatchTicketAcceptance } from "../types";
import {
  getPlayerAcceptances,
  getRequiredAcceptedPlayers,
  getStartModeLabel,
  getTotalRequiredPlayers,
} from "../utils/playerLimits";

export function getDurationText(searchMinutes: number | null | undefined): string {
  if (!searchMinutes || searchMinutes <= 0) return "Until cancelled";
  if (searchMinutes === 60) return "1 hour";
  if (searchMinutes % 60 === 0) return `${searchMinutes / 60} hours`;
  return `${searchMinutes} minutes`;
}

function getScheduledText(scheduledAt: string | null): string {
  if (!scheduledAt) return "Not scheduled";

  return `<t:${Math.floor(new Date(scheduledAt).getTime() / 1000)}:F>`;
}

export function getSessionModeNames(modes: string[] | undefined): string {
  if (!modes || modes.length === 0) return "None";

  const names: Record<string, string> = {
    veilbreak: "Veilbreak",
    base_game: "Base Game",
    scadubingo: "Scadubingo",
  };

  return modes.map((mode) => names[mode] ?? mode).join(", ");
}

function getModeNames(ticket: MatchTicket): string {
  const modes: string[] = [];

  if (ticket.veilbreak) modes.push("Veilbreak");
  if (ticket.base_game) modes.push("Base Game");
  if (ticket.scadubingo) modes.push("Scadubingo");

  return modes.length > 0 ? modes.join(", ") : "None";
}

function getStatusLabel(status: string): string {
  return status.replace("_", " ").toUpperCase();
}

export function buildTicketEmbed(
  ticket: MatchTicket,
  acceptances: MatchTicketAcceptance[]
) {
  const playerAcceptances = getPlayerAcceptances(acceptances);
  const requiredAcceptedPlayers = getRequiredAcceptedPlayers(ticket);
  const totalRequiredPlayers = getTotalRequiredPlayers(ticket);

  const currentPlayerCount =
    playerAcceptances.length + (ticket.host_is_player ? 1 : 0);

  const refAcceptances = acceptances.filter(
    (acceptance) => acceptance.acceptance_type === "ref"
  );

  const waitingSlots = Math.max(
    requiredAcceptedPlayers - playerAcceptances.length,
    0
  );

  const acceptedPlayerLines = playerAcceptances.map(
    (acceptance, index) => `${index + 1}. <@${acceptance.discord_id}>`
  );

  const waitingLines = Array.from({ length: waitingSlots }, (_, index) => {
    return `${playerAcceptances.length + index + 1}. Waiting...`;
  });

  const playerPriority = [...acceptedPlayerLines, ...waitingLines].join("\n");

  const refPriority =
    refAcceptances.length > 0
      ? refAcceptances
          .map((acceptance, index) => `${index + 1}. <@${acceptance.discord_id}>`)
          .join("\n")
      : "No refs yet.";

  const title =
    ticket.matchmaking_type === "competitive"
      ? ":trophy: Official Matchmaking Ticket"
      : ":sunglasses: Casual Matchmaking Ticket";

  const color =
    ticket.status === "open"
      ? 0x2ecc71
      : ticket.status === "started"
        ? 0x9b59b6
        : ticket.status === "finished"
          ? 0x3498db
          : ticket.status === "wasnt_played"
            ? 0xf1c40f
            : 0xe74c3c;

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color)
    .addFields(
      {
        name: "Host",
        value: `<@${ticket.creator_discord_id}>`,
        inline: true,
      },
      {
        name: "Status",
        value: getStatusLabel(ticket.status),
        inline: true,
      },
      {
        name: "Modes",
        value: getModeNames(ticket),
        inline: false,
      },
      ...(ticket.started_mode
      ? [
          {
            name: "Started As",
            value: getStartModeLabel(ticket.started_mode),
            inline: true as const,
          },
        ]
      : []),
      ...(ticket.match_title
        ? [
            {
              name: "Match Title",
              value: ticket.match_title,
              inline: false as const,
            },
          ]
        : []),
      ...(ticket.match_details
        ? [
            {
              name: "Details",
              value: ticket.match_details,
              inline: false as const,
            },
          ]
        : []),
      {
        name: ticket.scheduled_at ? "Scheduled For" : "Searching For",
        value: ticket.scheduled_at
          ? getScheduledText(ticket.scheduled_at)
          : getDurationText(ticket.search_minutes),
        inline: true,
      },
      {
        name: "Host Playing",
        value: ticket.host_is_player ? "Yes" : "No",
        inline: true,
      },
      {
        name: "Game Info",
        value:
          ticket.lobby_code && ticket.game_seed
            ? `Lobby Code: **${ticket.lobby_code}**\nGame Seed: **${ticket.game_seed}**`
            : "Game has not started yet.",
        inline: false,
      },
      {
        name: `Players (${currentPlayerCount}/${totalRequiredPlayers})`,
        value:
          `Host: <@${ticket.creator_discord_id}>${
            ticket.host_is_player ? " *(playing)*" : " *(not playing)*"
          }\n` +
          `Accepted Players: **${playerAcceptances.length}/${requiredAcceptedPlayers}**\n\n` +
          playerPriority,
        inline: false,
      }
    )
    .setFooter({
      text: "Users are prioritized by who accepted first.",
    })
    .setTimestamp(new Date(ticket.created_at));

  if (ticket.matchmaking_type === "competitive") {
    embed.addFields({
      name: "Refs",
      value: refPriority,
      inline: false,
    });
  }

  return embed;
}

export function buildTicketButtons(ticket: MatchTicket) {
  const canAccept = ticket.status === "open";
  const canStart = ticket.status === "open";
  const canClose = ticket.status === "open" || ticket.status === "started";

  const acceptRow = new ActionRowBuilder<ButtonBuilder>();

  acceptRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_accept_player_${ticket.id}`)
      .setLabel(
        ticket.matchmaking_type === "competitive"
          ? "Accept as Player"
          : "Accept Match"
      )
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canAccept)
  );

  if (ticket.matchmaking_type === "competitive") {
    acceptRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`ticket_accept_ref_${ticket.id}`)
        .setLabel("Ref This Match")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(!canAccept)
    );
  }

  acceptRow.addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_leave_queue_${ticket.id}`)
      .setLabel("Leave Queue")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!canAccept)
  );

  const startRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_start_${ticket.id}`)
      .setLabel("Start Game")
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canStart),

    new ButtonBuilder()
      .setCustomId(`ticket_remove_player_${ticket.id}`)
      .setLabel("Remove Player")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!canAccept)
  );

  const closeRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId(`ticket_finish_${ticket.id}`)
      .setLabel("Finish Match")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!canClose),

    new ButtonBuilder()
      .setCustomId(`ticket_wasnt_played_${ticket.id}`)
      .setLabel("Wasn't Played")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!canClose),

    new ButtonBuilder()
      .setCustomId(`ticket_cancel_${ticket.id}`)
      .setLabel("Cancel Ticket")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!canClose)
  );

  return [acceptRow, startRow, closeRow];
}