import {
  ButtonInteraction,
  ChannelType,
  Client,
  StringSelectMenuInteraction,
} from "discord.js";
import { config } from "../config";
import { MatchmakingType, PendingSession } from "../types";
import {
  buildCreateTicketButton,
  buildDurationSelect,
  buildModeSelect,
} from "../ui/setupComponents";
import {
  buildTicketButtons,
  buildTicketEmbed,
  getDurationText,
  getSessionModeNames,
} from "../ui/ticketRenderer";
import {
  createTicket,
  updateTicketMessageId,
  userHasActiveTicketOrAcceptance,
} from "../services/ticketService";

export const pendingSessions = new Map<string, PendingSession>();

export async function handleTypeButton(interaction: ButtonInteraction) {
  const matchmakingType: MatchmakingType =
    interaction.customId === "mm_type_competitive" ? "competitive" : "casual";

  pendingSessions.set(interaction.user.id, {
    matchmakingType,
  });

  await interaction.update({
    content: `Selected: **${matchmakingType.toUpperCase()}**\n\nNow choose the game modes.`,
    components: [buildModeSelect()],
  });
}

export async function handleModeSelect(interaction: StringSelectMenuInteraction) {
  const session = pendingSessions.get(interaction.user.id) ?? {};

  session.modes = interaction.values;
  pendingSessions.set(interaction.user.id, session);

  await interaction.update({
    content: `Selected modes: **${getSessionModeNames(session.modes)}**\n\nNow choose how long you are searching.`,
    components: [buildDurationSelect()],
  });
}

export async function handleDurationSelect(
  interaction: StringSelectMenuInteraction
) {
  const session = pendingSessions.get(interaction.user.id) ?? {};

  const selectedValue = interaction.values[0];
  const minutes = Number(selectedValue);

  session.searchMinutes = minutes <= 0 ? null : minutes;
  pendingSessions.set(interaction.user.id, session);

  await interaction.update({
    content:
      `Matchmaking type: **${session.matchmakingType?.toUpperCase() ?? "None"}**\n` +
      `Modes: **${getSessionModeNames(session.modes)}**\n` +
      `Searching for: **${getDurationText(session.searchMinutes)}**\n\n` +
      `Create the ticket?`,
    components: [buildCreateTicketButton()],
  });
}

export async function handleCreateTicket(
  client: Client,
  interaction: ButtonInteraction
) {
  const session = pendingSessions.get(interaction.user.id);

  if (!session?.matchmakingType || !session.modes || session.modes.length === 0) {
    await interaction.reply({
      content: "Your matchmaking setup expired or is incomplete. Run `/matchmake` again.",
      ephemeral: true,
    });
    return;
  }

  const alreadyActive = await userHasActiveTicketOrAcceptance(interaction.user.id);

  if (alreadyActive) {
    await interaction.reply({
      content:
        "You already have an active matchmaking ticket, or you accepted a ticket that is still active. Finish, cancel, or mark that ticket as wasn't played before creating another one.",
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

  const ticket = await createTicket({
    guildId: config.guildId,
    channelId: config.matchmakingChannelId,
    creatorDiscordId: interaction.user.id,
    matchmakingType: session.matchmakingType,
    modes: session.modes,
    searchMinutes: session.searchMinutes,
  });

  if (!ticket) {
    await interaction.reply({
      content: "Failed to create matchmaking ticket.",
      ephemeral: true,
    });
    return;
  }

  const sentMessage = await channel.send({
    embeds: [buildTicketEmbed(ticket, [])],
    components: buildTicketButtons(ticket),
  });

  await updateTicketMessageId(ticket.id, sentMessage.id);

  pendingSessions.delete(interaction.user.id);

  await interaction.update({
    content: `Ticket created in <#${config.matchmakingChannelId}>.`,
    components: [],
  });
}