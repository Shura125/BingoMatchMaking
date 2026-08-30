import {
  ChatInputCommandInteraction,
  Client,
  ChannelType,
  Message,
  ActionRowBuilder,
  ButtonBuilder,
  ComponentType,
} from "discord.js";
import { buildTypeButtons } from "../ui/setupComponents";
import {
  GameModeId,
  getGameModeForCommand,
  getGameModeLabel,
  getTicketModeNames as getModeNamesForFlags,
  modesIncludeCasualGameModes,
} from "../gameModes";
import {
  closeTicket,
  createTicket,
  findActiveTicketForUser,
  getOpenMatchTickets,
  getRecentMatches,
  leaveAcceptedTicket,
  updateTicketMessageId,
  userHasActiveCasualTicketOrAcceptance,
} from "../services/ticketService";
import { getTicketJumpUrl, refreshTicketMessage } from "../utils/ticketMessage";
import {
  handleForceCloseCommand,
  handleRemovePlayerCommand,
} from "./adminHandlers";
import { config } from "../config";
import {
  buildTicketButtons,
  buildTicketEmbed,
} from "../ui/ticketRenderer";
import { deleteTicketMessage } from "../utils/ticketCleanup";

function getMatchModeNames(match: {
  veilbreak: boolean;
  base_game: boolean;
  scadubingo: boolean;
  legacy_dungeons: boolean;
  cluedo: boolean;
  battleship: boolean;
}): string {
  const modeNames = getModeNamesForFlags(match).replace("None", "Unknown");

  return modeNames;
}

function formatTicketModeNames(ticket: {
  veilbreak: boolean;
  base_game: boolean;
  scadubingo: boolean;
  legacy_dungeons: boolean;
  cluedo: boolean;
  battleship: boolean;
}): string {
  return getModeNamesForFlags(ticket).replace("None", "Unknown");
}

function getTicketJumpUrlFromParts(ticket: {
  guild_id: string;
  channel_id: string;
  message_id: string | null;
}): string | null {
  if (!ticket.message_id) return null;

  return `https://discord.com/channels/${ticket.guild_id}/${ticket.channel_id}/${ticket.message_id}`;
}

function formatOpenTicketLine(ticket: {
  guild_id: string;
  channel_id: string;
  message_id: string | null;
  creator_discord_id: string;
  matchmaking_type: string;
  status: string;
  veilbreak: boolean;
  base_game: boolean;
  scadubingo: boolean;
  legacy_dungeons: boolean;
  cluedo: boolean;
  battleship: boolean;
  created_at: string;
}): string {
  const ticketUrl = getTicketJumpUrlFromParts(ticket);
  const createdTime = `<t:${Math.floor(
    new Date(ticket.created_at).getTime() / 1000
  )}:R>`;

  return (
    `**${ticket.matchmaking_type.toUpperCase()}** - ${formatTicketModeNames(ticket)}\n` +
    `Host: <@${ticket.creator_discord_id}>\n` +
    `Status: **${ticket.status.toUpperCase()}**\n` +
    `Created: ${createdTime}\n` +
    (ticketUrl ? `Ticket: ${ticketUrl}` : "Ticket link unavailable")
  );
}

function formatRecentMatchLine(match: {
  matchmaking_type: string;
  player1_discord_id: string;
  player2_discord_id: string | null;
  ref_discord_id: string | null;
  veilbreak: boolean;
  base_game: boolean;
  scadubingo: boolean;
  legacy_dungeons: boolean;
  cluedo: boolean;
  battleship: boolean;
  finished_at: string | null;
}): string {
  const player2 = match.player2_discord_id
    ? `<@${match.player2_discord_id}>`
    : "No opponent recorded";

  const ref = match.ref_discord_id
    ? `\nRef: <@${match.ref_discord_id}>`
    : "";

  const finishedDate = match.finished_at
    ? `<t:${Math.floor(new Date(match.finished_at).getTime() / 1000)}:R>`
    : "Unknown time";

  return (
    `**${match.matchmaking_type.toUpperCase()}** - ${getMatchModeNames(match)}\n` +
    `<@${match.player1_discord_id}> vs ${player2}\n` +
    `Finished: ${finishedDate}` +
    ref
  );
}

function disableMessageButtons(message: Message) {
  return message.components
    .filter((row) => row.type === ComponentType.ActionRow)
    .map((row) => {
      const newRow = new ActionRowBuilder<ButtonBuilder>();

      for (const component of row.components) {
        if (component.type !== ComponentType.Button) continue;

        const button = ButtonBuilder.from(component).setDisabled(true);
        newRow.addComponents(button);
      }

      return newRow;
    });
}

async function markTicketMessageExpired(message: Message) {
  const disabledRows = disableMessageButtons(message);

  await message.edit({
    content: "⏰ This matchmaking ticket expired because the search time ended.",
    components: disabledRows,
  });
}

function scheduleTicketExpiration(options: {
  client: Client;
  message: Message;
  ticketId: string;
  creatorDiscordId: string;
  searchMinutes: number;
  deleteAfterMs?: number;
}) {
  const {
    client,
    message,
    ticketId,
    creatorDiscordId,
    searchMinutes,
    deleteAfterMs = 5 * 60 * 1000,
  } = options;

  setTimeout(async () => {
    try {
      const { ticket } = await findActiveTicketForUser(creatorDiscordId);

      if (!ticket) return;
      if (ticket.id !== ticketId) return;

      if (ticket.status !== "open") return;

      const success = await closeTicket(ticket, "cancelled");

      if (!success) {
        console.error(`Failed to expire ticket ${ticketId}`);
        return;
      }

      await refreshTicketMessage(client, ticketId);

      const freshMessage = await message.fetch().catch(() => null);

      if (freshMessage) {
        await markTicketMessageExpired(freshMessage);

        setTimeout(async () => {
          await freshMessage.delete().catch(() => {});
        }, deleteAfterMs);
      }
    } catch (error) {
      console.error(`Failed to run expiration for ticket ${ticketId}:`, error);
    }
  }, searchMinutes * 60 * 1000);
}

function getRoleIdForQuickMode(mode: GameModeId): string {
  if (modesIncludeCasualGameModes([mode])) {
    return config.casualGameModesRoleId;
  }

  return config.bingoPlayersRoleId;
}

function getChannelIdForQuickMode(mode: GameModeId): string {
  if (modesIncludeCasualGameModes([mode])) {
    return config.casualGameModesChannelId;
  }

  return config.matchmakingChannelId;
}

async function createQuickCasualTicket(
  client: Client,
  interaction: ChatInputCommandInteraction,
  mode: GameModeId
) {
  if (!interaction.deferred && !interaction.replied) {
    await interaction.deferReply({ ephemeral: true });
  }

  const alreadyActive = await userHasActiveCasualTicketOrAcceptance(
    interaction.user.id
  );

  if (alreadyActive) {
    await interaction.editReply({
      content:
        "You already have an active casual matchmaking ticket, or you accepted a casual ticket that is still active.\n" +
        "Finish, cancel, or leave that casual ticket before creating another casual one.",
    });
    return;
  }

  const channelId = getChannelIdForQuickMode(mode);
  const channel = await client.channels.fetch(channelId);

  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.editReply({
      content: "The matchmaking channel is invalid or not a text channel.",
    });
    return;
  }

  const modeLabel = getGameModeLabel(mode);
  const roleId = getRoleIdForQuickMode(mode);
  const searchMinutes = 60;

  const ticket = await createTicket({
    guildId: config.guildId,
    channelId,
    creatorDiscordId: interaction.user.id,
    matchmakingType: "casual",
    hostIsPlayer: true,
    modes: [mode],
    searchMinutes,
    scheduledAt: null,
    scheduledTimezone: null,
    matchTitle: `${modeLabel} Casual Match`,
    matchDetails: null,
  });

  if (!ticket) {
    await interaction.editReply({
      content: "Failed to create matchmaking ticket.",
    });
    return;
  }

  const sentMessage = await channel.send({
    content: `<@&${roleId}>`,
    embeds: [buildTicketEmbed(ticket, [])],
    components: buildTicketButtons(ticket),
    allowedMentions: {
      roles: [roleId],
    },
  });

  await updateTicketMessageId(ticket.id, sentMessage.id);

  scheduleTicketExpiration({
    client,
    message: sentMessage,
    ticketId: ticket.id,
    creatorDiscordId: interaction.user.id,
    searchMinutes,
    deleteAfterMs: 5 * 60 * 1000,
  });

  await interaction.editReply({
    content: `Created a **casual ${modeLabel}** matchmaking ticket searching for **1 hour** in <#${channelId}>.`,
  });
}

export async function handleChatInputCommand(
  client: Client,
  interaction: ChatInputCommandInteraction
) {
  const quickMode = getGameModeForCommand(interaction.commandName);

  if (quickMode) {
    await createQuickCasualTicket(client, interaction, quickMode.id);
    return;
  }

  if (interaction.commandName === "creatematch") {
    await interaction.reply({
      content: "Choose the matchmaking path you want to create.",
      components: [buildTypeButtons()],
      ephemeral: true,
    });

    return;
  }

  if (interaction.commandName === "forceclose") {
    await handleForceCloseCommand(client, interaction);
    return;
  }

  if (interaction.commandName === "removeplayer") {
    await handleRemovePlayerCommand(client, interaction);
    return;
  }

  if (interaction.commandName === "myticket") {
    const { ticket, role } = await findActiveTicketForUser(interaction.user.id);

    if (!ticket) {
      await interaction.reply({
        content: "You do not have an active matchmaking ticket right now.",
        ephemeral: true,
      });
      return;
    }

    const ticketUrl = getTicketJumpUrl(ticket);

    await interaction.reply({
      content:
        `You are currently on an active ticket as **${role}**.\n` +
        `Status: **${ticket.status.toUpperCase()}**\n` +
        (ticketUrl
          ? `Ticket: ${ticketUrl}`
          : "Ticket message link is not available yet."),
      ephemeral: true,
    });

    return;
  }

  if (interaction.commandName === "cancelticket") {
    const { ticket, role } = await findActiveTicketForUser(interaction.user.id);

    if (!ticket) {
      await interaction.reply({
        content: "You do not have an active matchmaking ticket to cancel.",
        ephemeral: true,
      });
      return;
    }

    if (role !== "host") {
      await interaction.reply({
        content:
          "You are not the host of your active ticket. Use `/leavequeue` if you want to leave the ticket you accepted.",
        ephemeral: true,
      });
      return;
    }

    if (ticket.status !== "open" && ticket.status !== "started") {
      await interaction.reply({
        content: "That ticket is already closed.",
        ephemeral: true,
      });
      return;
    }

    const success = await closeTicket(ticket, "cancelled");

    if (!success) {
      await interaction.reply({
        content: "Could not cancel your ticket.",
        ephemeral: true,
      });
      return;
    }

    await refreshTicketMessage(client, ticket.id);
    await deleteTicketMessage(client, ticket);

    await interaction.reply({
      content: "Your matchmaking ticket has been cancelled and removed.",
      ephemeral: true,
    });

    return;
  }

  if (interaction.commandName === "leavequeue") {
    const result = await leaveAcceptedTicket(interaction.user.id);

    if (!result.success || !result.ticket) {
      await interaction.reply({
        content: "You are not currently queued on another user's active ticket.",
        ephemeral: true,
      });
      return;
    }

    await refreshTicketMessage(client, result.ticket.id);

    await interaction.reply({
      content: "You have left the matchmaking queue.",
      ephemeral: true,
    });

    return;
  }

  if (interaction.commandName === "recentmatches") {
    const matches = await getRecentMatches(10);

    if (matches.length === 0) {
      await interaction.reply({
        content: "No recent finished matches found.",
        ephemeral: true,
      });
      return;
    }

    const description = matches
      .map((match, index) => `${index + 1}. ${formatRecentMatchLine(match)}`)
      .join("\n\n");

    await interaction.reply({
      content: `## Recent Matches\n\n${description}`,
      ephemeral: true,
      allowedMentions: { parse: [] },
    });

    return;
  }

  if (interaction.commandName === "openmatches") {
    const tickets = await getOpenMatchTickets();
    
    if (tickets.length === 0) {
      await interaction.reply({
        content: "There are no open or started matchmaking tickets right now.",
        ephemeral: true,
      });
      return;
    }
  
    const description = tickets
      .slice(0, 10)
      .map((ticket, index) => `${index + 1}. ${formatOpenTicketLine(ticket)}`)
      .join("\n\n");
  
    await interaction.reply({
      content: `## Open Matches\n\n${description}`,
      ephemeral: true,
      allowedMentions: { parse: [] },
    });
  
    return;
  }
}
