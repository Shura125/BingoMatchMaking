import { ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder, type Client } from "discord.js";
import { MatchTicket, MatchTicketAcceptance } from "../types";
import {
  GameModeConfig,
  getGameMode,
  getModeNamesFromIds,
  getTicketModeIds,
  modeSupportsRandomTeams,
} from "../gameModes";
import { getAllowedPlayerCounts, getPlayerAcceptances, getStartModeOptionsForTicket } from "../utils/playerLimits";
import { formatPlayerMention, resolveTicketPlayerNames, type PlayerNames } from "../utils/playerNames";
import { getGameModeEmojis, prefixGameModeEmoji, type GameModeEmojis } from "../utils/gameModeEmojis";

export function getDurationText(searchMinutes: number | null | undefined): string {
  if (!searchMinutes || searchMinutes <= 0) return "Until cancelled";
  if (searchMinutes === 60) return "1 hour";
  if (searchMinutes % 60 === 0) return `${searchMinutes / 60} hours`;
  return `${searchMinutes} minutes`;
}

export function getSessionModeNames(modes: string[] | undefined): string {
  return getModeNamesFromIds(modes);
}

function timestamp(value: string, style: "F" | "R" = "R"): string {
  return `<t:${Math.floor(new Date(value).getTime() / 1000)}:${style}>`;
}

function formatSize(mode: GameModeConfig, ticket?: MatchTicket): string {
  return (ticket ? getAllowedPlayerCounts(ticket, mode.id) : mode.allowedPlayerCounts).map((count) =>
    mode.id === "cluedo" ? `${count} players` : `${count / 2}v${count / 2}`
  ).join(" / ");
}

function getDisplayModes(ticket: MatchTicket): GameModeConfig[] {
  const startedMode = getGameMode(ticket.started_mode);
  if (startedMode) return [startedMode];
  return getTicketModeIds(ticket).map((id) => getGameMode(id)!);
}

function getBattleshipExpansionText(ticket: MatchTicket, count: number): string | null {
  if (ticket.status !== "open" || !ticket.battleship) return null;
  if ([3,4,5].includes(ticket.battleship_team_size ?? 0)) {
    const size = ticket.battleship_team_size!;
    const needed = size * 2 - count;
    return needed > 0 ? `Needs ${needed} more player${needed === 1 ? '' : 's'} for the selected ${size}v${size} match.`
      : needed === 0 ? `Full ${size}v${size} lobby.` : 'The roster exceeds the selected team size.';
  }
  if (count < 6) return "Battleship starts at 3v3. Keep the ticket open to fill 4v4 or 5v5.";
  if (count === 7 || count === 9) {
    return `Waiting for one more player to start ${count === 7 ? "4v4" : "5v5"}. Teams must be even; the host can also remove a player.`;
  }
  if (count === 6 || count === 8) {
    return `Ready to start ${count / 2}v${count / 2}. Keep recruiting for ${count === 6 ? "4v4 or 5v5" : "5v5"}.`;
  }
  return count === 10 ? "Full 5v5 lobby." : "The roster exceeds Battleship's 10-player limit.";
}

function getPresentation(ticket: MatchTicket, acceptances: MatchTicketAcceptance[]) {
  if (ticket.status === "started") {
    return { label: "Match in progress", color: 0x5865f2, hint: "The match has started. Good luck!" };
  }
  if (ticket.status === "finished") {
    return { label: "Match finished", color: 0x9b59b6, hint: "This match has been marked as finished." };
  }
  if (ticket.status !== "open") {
    // Historical retired statuses use the cancelled presentation.
    return ticket.status === 'expired'
      ? { label: "Search expired", color: 0xe67e22, hint: "This ticket is closed." }
      : { label: "Ticket cancelled", color: 0xed4245, hint: "This ticket is closed." };
  }
  const ready = getStartModeOptionsForTicket(ticket, acceptances);
  return ready.canStart
    ? { label: "Ready to start", color: 0x57f287, hint: "The roster fits a selected mode. The host can start the match." }
    : { label: "Looking for players", color: 0xfee75c, hint: "Join a player slot below. The host starts the match when the roster is ready." };
}

export async function buildTicketEmbedForClient(client: Client, ticket: MatchTicket, acceptances: MatchTicketAcceptance[]) {
  const names = await resolveTicketPlayerNames(client, ticket, acceptances);
  return buildTicketEmbed(ticket, acceptances, names);
}

export function buildTicketEmbed(ticket: MatchTicket, acceptances: MatchTicketAcceptance[], names: PlayerNames = new Map(), emojis: GameModeEmojis = getGameModeEmojis()) {
  const modes = getDisplayModes(ticket);
  const players = [
    ...(ticket.host_is_player ? [{ id: ticket.creator_discord_id, host: true }] : []),
    ...getPlayerAcceptances(acceptances).map((row) => ({ id: row.discord_id, host: false })),
  ];
  const count = players.length;
  const validCounts = [...new Set(modes.flatMap((mode) => [...getAllowedPlayerCounts(ticket, mode.id)]))].sort((a, b) => a - b);
  const target = ticket.status === "open"
    ? validCounts.find((size) => size >= count) ?? Math.max(...validCounts, 2, count)
    : count;
  const filled = Math.min(count, target);
  const bar = "▰".repeat(filled) + "▱".repeat(Math.max(target - filled, 0));
  const roster = players.map((player, index) =>
    `${index + 1}. ${formatPlayerMention(player.id, names)}${player.host ? " · Host" : ""}`
  );
  if (ticket.status === "open") {
    for (let index = count; index < target; index += 1) roster.push(`${index + 1}. *Open slot*`);
  }
  const presentation = getPresentation(ticket, acceptances);
  const singleMode = modes.length === 1 ? modes[0] : null;
  const title = ticket.match_title || (singleMode
    ? `${singleMode.label} · ${formatSize(singleMode, ticket)}`
    : `Find a match · ${modes.length} modes`);
  const when = ticket.started_at
    ? { name: "Started", value: timestamp(ticket.started_at) }
    : ticket.scheduled_at
      ? { name: "Scheduled for", value: `${timestamp(ticket.scheduled_at, "F")}\n${timestamp(ticket.scheduled_at)}` }
      : ticket.status === "open"
        ? { name: "Search window", value: ticket.expires_at
          ? `Ends ${timestamp(ticket.expires_at)}`
          : getDurationText(ticket.search_minutes) }
        : { name: "Created", value: timestamp(ticket.created_at) };
  const expansion = getBattleshipExpansionText(ticket, count);

  const embed = new EmbedBuilder()
    .setAuthor({ name: ticket.matchmaking_type === "competitive" ? "BINGO MATCHMAKING · OFFICIAL" : "BINGO MATCHMAKING · CASUAL" })
    .setTitle(singleMode ? prefixGameModeEmoji(singleMode.id, title, emojis) : title)
    .setDescription(`**${presentation.label}**\n${presentation.hint}`)
    .setColor(presentation.color)
    .addFields(
      { name: "Host", value: `${formatPlayerMention(ticket.creator_discord_id, names)}\n${ticket.host_is_player ? "Playing" : "Organizer · not playing"}`, inline: true },
      { ...when, inline: true },
      {
        name: modes.length > 1 ? "Available modes" : "Match format",
        value: modes.map((mode) => prefixGameModeEmoji(mode.id, `**${mode.label}** · ${formatSize(mode, ticket)}`, emojis)).join("\n") || "No mode selected",
        inline: false,
      },
      {
        name: `Players (${count}/${target})`,
        value: [bar || "No players recorded", roster.join("\n"), expansion].filter(Boolean).join("\n\n"),
        inline: false,
      }
    );

  if (ticket.match_details) embed.addFields({ name: "Match notes", value: ticket.match_details });

  if (ticket.matchmaking_type === "competitive") {
    const refs = acceptances.filter((row) => row.acceptance_type === "ref");
    const visibleRefs = refs.slice(0, 10).map((row) => formatPlayerMention(row.discord_id, names));
    if (refs.length > 10) visibleRefs.push(`+ ${refs.length - 10} more`);
    embed.addFields({ name: "Referees", value: visibleRefs.join(" · ") || (ticket.status === "open" ? "No referee yet · use Join as Ref" : "No referee recorded") });
  }

  if (ticket.started_at) {
    const mode = getGameMode(ticket.started_mode);
    const gameInfo: string[] = [];
    if (mode?.websiteUrl) gameInfo.push(`[Open ${mode.label}](${mode.websiteUrl})`);
    if (mode?.usesLobbyCode && ticket.lobby_code) gameInfo.push(`Lobby code: \`${ticket.lobby_code}\``);
    if (mode?.usesGameSeed && ticket.game_seed !== null) gameInfo.push(`Game seed: \`${ticket.game_seed}\``);
    if (gameInfo.length) embed.addFields({ name: "Lobby details", value: gameInfo.join("\n") });
  }

  if (ticket.randomized_teams) {
    const teams = ticket.randomized_teams.replace(/<@!?(\d+)>/g, (_, id: string) => formatPlayerMention(id, names));
    embed.addFields({ name: "Teams", value: teams });
  } else if (modes.some((mode) => mode.supportsRandomTeams) && (ticket.status === "open" || ticket.status === "started")) {
    embed.addFields({
      name: "Team randomizer",
      value: ticket.status === "open"
        ? "The host can use Randomize Teams after starting a supported team mode."
        : "The host can use Randomize Teams to split the players into two even teams. Teams are drawn once per match.",
    });
  }

  return embed.setFooter({ text: ticket.status === "open"
    ? "Join order sets priority · Host controls are for the host only"
    : "Bingo Matchmaking" }).setTimestamp(new Date(ticket.created_at));
}

export function buildTicketButtons(ticket: MatchTicket, acceptances: MatchTicketAcceptance[] = []) {
  if (ticket.status !== "open" && ticket.status !== "started") return [];
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  if (ticket.status === "open") {
    const playerRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket_accept_player_${ticket.id}`).setLabel("Join Match").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ticket_leave_queue_${ticket.id}`).setLabel("Leave Queue").setStyle(ButtonStyle.Secondary)
    );
    if (ticket.matchmaking_type === "competitive") playerRow.addComponents(
      new ButtonBuilder().setCustomId(`ticket_accept_ref_${ticket.id}`).setLabel("Join as Ref").setStyle(ButtonStyle.Secondary)
    );
    if (!ticket.participants_alert_requested_at && (!ticket.expires_at || Date.parse(ticket.expires_at) > Date.now())
      && getStartModeOptionsForTicket(ticket, acceptances).canStart) playerRow.addComponents(
      new ButtonBuilder().setCustomId(`ticket_alert_participants_${ticket.id}`).setLabel("Alert Participants").setStyle(ButtonStyle.Primary)
    );
    rows.push(playerRow);
    const hostRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId(`ticket_start_${ticket.id}`).setLabel("Start Match").setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`ticket_remove_player_${ticket.id}`).setLabel("Manage Roster").setStyle(ButtonStyle.Secondary)
    );
    if (getDisplayModes(ticket).some(mode => mode.supportsRandomTeams)) hostRow.addComponents(
      new ButtonBuilder().setCustomId(`ticket_randomize_teams_${ticket.id}`).setLabel("Randomize Teams").setStyle(ButtonStyle.Secondary).setDisabled(true)
    );
    rows.push(hostRow);
  } else if (modeSupportsRandomTeams(ticket.started_mode)) rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_randomize_teams_${ticket.id}`).setLabel(ticket.randomized_teams ? "Teams Assigned" : "Randomize Teams").setStyle(ButtonStyle.Primary).setDisabled(Boolean(ticket.randomized_teams))
  ));
  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`ticket_finish_${ticket.id}`).setLabel("Finish Match").setStyle(ButtonStyle.Secondary).setDisabled(ticket.status !== 'started'),
    new ButtonBuilder().setCustomId(`ticket_cancel_${ticket.id}`).setLabel("Cancel Ticket").setStyle(ButtonStyle.Danger)
  ));
  return rows;
}
