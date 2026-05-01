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
}): string {
  const modes: string[] = [];

  if (match.veilbreak) modes.push("Veilbreak");
  if (match.base_game) modes.push("Base Game");
  if (match.scadubingo) modes.push("Scadubingo");

  return modes.length > 0 ? modes.join(", ") : "Unknown";
}

function getTicketModeNames(ticket: {
  veilbreak: boolean;
  base_game: boolean;
  scadubingo: boolean;
}): string {
  const modes: string[] = [];

  if (ticket.veilbreak) modes.push("Veilbreak");
  if (ticket.base_game) modes.push("Base Game");
  if (ticket.scadubingo) modes.push("Scadubingo");

  return modes.length > 0 ? modes.join(", ") : "Unknown";
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
  created_at: string;
}): string {
  const ticketUrl = getTicketJumpUrlFromParts(ticket);
  const createdTime = `<t:${Math.floor(
    new Date(ticket.created_at).getTime() / 1000
  )}:R>`;

  return (
    `**${ticket.matchmaking_type.toUpperCase()}** - ${getTicketModeNames(ticket)}\n` +
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

type QuickMode = "veilbreak" | "base_game" | "scadubingo";

function getQuickModeLabel(mode: QuickMode): string {
  if (mode === "veilbreak") return "Veilbreak";
  if (mode === "base_game") return "Base Game";
  if (mode === "scadubingo") return "Scadubingo";

  return mode;
}

async function createQuickCasualTicket(
  client: Client,
  interaction: ChatInputCommandInteraction,
  mode: QuickMode
) {
  const alreadyActive = await userHasActiveCasualTicketOrAcceptance(
    interaction.user.id
  );

  if (alreadyActive) {
    await interaction.reply({
      content:
        "You already have an active casual matchmaking ticket, or you accepted a casual ticket that is still active.\n" +
        "Finish, cancel, leave, or mark that casual ticket as wasn't played before creating another casual one.",
      ephemeral: true,
    });
    return;
  }

  const channel = await client.channels.fetch(config.matchmakingChannelId);

  if (!channel || channel.type !== ChannelType.GuildText) {
    await interaction.reply({
      content: "The matchmaking channel is invalid or not a text channel.",
      ephemeral: true,
    });
    return;
  }

  const modeLabel = getQuickModeLabel(mode);
  const searchMinutes = 60;

  const ticket = await createTicket({
    guildId: config.guildId,
    channelId: config.matchmakingChannelId,
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
    await interaction.reply({
      content: "Failed to create matchmaking ticket.",
      ephemeral: true,
    });
    return;
  }

  const sentMessage = await channel.send({
    content: `<@&${config.bingoPlayersRoleId}>`,
    embeds: [buildTicketEmbed(ticket, [])],
    components: buildTicketButtons(ticket),
    allowedMentions: {
      roles: [config.bingoPlayersRoleId],
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

  await interaction.reply({
    content: `Created a **casual ${modeLabel}** matchmaking ticket searching for **1 hour** in <#${config.matchmakingChannelId}>.`,
    ephemeral: true,
  });
}

export async function handleChatInputCommand(
  client: Client,
  interaction: ChatInputCommandInteraction
) {
  if (interaction.commandName === "veilbreak") {
    await createQuickCasualTicket(client, interaction, "veilbreak");
    return;
  }

  if (interaction.commandName === "basegame") {
    await createQuickCasualTicket(client, interaction, "base_game");
    return;
  }

  if (interaction.commandName === "scadubingo") {
    await createQuickCasualTicket(client, interaction, "scadubingo");
    return;
  }

  if (interaction.commandName === "creatematch") {
    await interaction.reply({
      content: "Choose the type of matchmaking ticket you want to create.",
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
      ephemeral: false,
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
      ephemeral: false,
    });

    return;
  }
}