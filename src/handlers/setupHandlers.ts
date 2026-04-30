import {
  ButtonInteraction,
  ChannelType,
  Client,
  ModalSubmitInteraction,
  StringSelectMenuInteraction,
} from "discord.js";
import { config } from "../config";
import { MatchmakingType, PendingSession } from "../types";
import {
  buildCasualTimingButtons,
  buildCompetitiveHostRoleButtons,
  buildCreateTicketButton,
  buildDurationSelect,
  buildMatchDetailsButtons,
  buildMatchDetailsModal,
  buildModeSelect,
  buildScheduleTimestampButton,
  buildScheduleTimestampModal,
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

const TWELVE_HOURS_MS = 12 * 60 * 60 * 1000;

export async function handleTypeButton(interaction: ButtonInteraction) {
  const matchmakingType: MatchmakingType =
    interaction.customId === "mm_type_competitive" ? "competitive" : "casual";

  pendingSessions.set(interaction.user.id, {
    matchmakingType,
    hostIsPlayer: matchmakingType === "casual" ? true : undefined,
    searchMinutes: null,
    scheduledAt: null,
    scheduledTimezone: null,
    matchTitle: null,
    matchDetails: null,
  });

  if (matchmakingType === "competitive") {
    await interaction.update({
      content:
        "Selected: **COMPETITIVE**\n\nWill the host be playing in this match?",
      components: [buildCompetitiveHostRoleButtons()],
    });
    return;
  }

  await interaction.update({
    content: "Selected: **CASUAL**\n\nNow choose the game modes.",
    components: [buildModeSelect()],
  });
}

export async function handleCompetitiveHostRoleButton(
  interaction: ButtonInteraction
) {
  const session = pendingSessions.get(interaction.user.id) ?? {};

  session.hostIsPlayer = interaction.customId === "mm_comp_host_player";
  pendingSessions.set(interaction.user.id, session);

  await interaction.update({
    content:
      `Competitive host role: **${
        session.hostIsPlayer ? "Playing" : "Only Hosting"
      }**\n\nNow choose the game modes.`,
    components: [buildModeSelect()],
  });
}

export async function handleModeSelect(interaction: StringSelectMenuInteraction) {
  const session = pendingSessions.get(interaction.user.id) ?? {};

  session.modes = interaction.values;
  pendingSessions.set(interaction.user.id, session);

  await interaction.update({
    content:
      `Selected modes: **${getSessionModeNames(session.modes)}**\n\n` +
      "Would you like to add a title or details for this match?",
    components: [buildMatchDetailsButtons()],
  });
}

export async function handleAddMatchDetailsButton(
  interaction: ButtonInteraction
) {
  await interaction.showModal(buildMatchDetailsModal());
}

export async function handleSkipMatchDetailsButton(
  interaction: ButtonInteraction
) {
  const session = pendingSessions.get(interaction.user.id) ?? {};

  session.matchTitle = null;
  session.matchDetails = null;
  pendingSessions.set(interaction.user.id, session);

  if (session.matchmakingType === "competitive") {
    await interaction.update({
      content:
        `Selected modes: **${getSessionModeNames(session.modes)}**\n\n` +
        "Competitive matches use a scheduled Discord timestamp.",
      components: [buildScheduleTimestampButton()],
    });
    return;
  }

  await interaction.update({
    content:
      `Selected modes: **${getSessionModeNames(session.modes)}**\n\n` +
      "Do you want to search now or schedule this casual match?",
    components: [buildCasualTimingButtons()],
  });
}

export async function handleMatchDetailsModal(
  interaction: ModalSubmitInteraction
) {
  const session = pendingSessions.get(interaction.user.id) ?? {};

  if (!session.matchmakingType || !session.modes || session.modes.length === 0) {
    await interaction.reply({
      content: "Your matchmaking setup expired. Run `/creatematch` again.",
      ephemeral: true,
    });
    return;
  }

  const titleRaw = interaction.fields.getTextInputValue("match_title");
  const detailsRaw = interaction.fields.getTextInputValue("match_details");

  session.matchTitle = titleRaw.trim() || null;
  session.matchDetails = detailsRaw.trim() || null;

  pendingSessions.set(interaction.user.id, session);

  if (session.matchmakingType === "competitive") {
    await interaction.reply({
      content:
        "Match details saved.\n\n" +
        `Selected modes: **${getSessionModeNames(session.modes)}**\n\n` +
        "Competitive matches use a scheduled Discord timestamp.",
      components: [buildScheduleTimestampButton()],
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content:
      "Match details saved.\n\n" +
      `Selected modes: **${getSessionModeNames(session.modes)}**\n\n` +
      "Do you want to search now or schedule this casual match?",
    components: [buildCasualTimingButtons()],
    ephemeral: true,
  });
}

export async function handleCasualTimingButton(interaction: ButtonInteraction) {
  const session = pendingSessions.get(interaction.user.id) ?? {};

  if (interaction.customId === "mm_casual_search_now") {
    session.scheduledAt = null;
    session.scheduledTimezone = null;
    pendingSessions.set(interaction.user.id, session);

    await interaction.update({
      content:
        `Selected modes: **${getSessionModeNames(session.modes)}**\n\n` +
        "Now choose how long you are searching.",
      components: [buildDurationSelect()],
    });
    return;
  }

  if (interaction.customId === "mm_casual_schedule") {
    session.searchMinutes = null;
    pendingSessions.set(interaction.user.id, session);

    await interaction.update({
      content:
        `Selected modes: **${getSessionModeNames(session.modes)}**\n\n` +
        "Casual scheduled matches must be within the next **12 hours**.\n\n" +
        "Click below and paste a Discord timestamp.",
      components: [buildScheduleTimestampButton()],
    });
  }
}

export async function handleOpenScheduleTimestampModal(
  interaction: ButtonInteraction
) {
  await interaction.showModal(buildScheduleTimestampModal());
}

function parseDiscordTimestamp(input: string): string | null {
  const cleaned = input.trim();

  const discordTimestampMatch = cleaned.match(/^<t:(\d{10})(?::[tTdDfFR])?>$/);
  const rawUnixMatch = cleaned.match(/^(\d{10})$/);

  const unixSeconds = discordTimestampMatch
    ? Number(discordTimestampMatch[1])
    : rawUnixMatch
      ? Number(rawUnixMatch[1])
      : null;

  if (!unixSeconds || !Number.isFinite(unixSeconds)) {
    return null;
  }

  const date = new Date(unixSeconds * 1000);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export async function handleScheduleTimestampModal(
  interaction: ModalSubmitInteraction
) {
  const session = pendingSessions.get(interaction.user.id) ?? {};

  if (!session.matchmakingType) {
    await interaction.reply({
      content: "Your matchmaking setup expired. Run `/creatematch` again.",
      ephemeral: true,
    });
    return;
  }

  const timestampInput =
    interaction.fields.getTextInputValue("scheduled_timestamp");

  const scheduledAt = parseDiscordTimestamp(timestampInput);

  if (!scheduledAt) {
    await interaction.reply({
      content:
        "I could not understand that timestamp. Please use a Discord timestamp like `<t:1777941000:F>`.",
      ephemeral: true,
    });
    return;
  }

  const scheduledTimeMs = new Date(scheduledAt).getTime();
  const now = Date.now();

  if (scheduledTimeMs <= now) {
    await interaction.reply({
      content: "Scheduled time must be in the future.",
      ephemeral: true,
    });
    return;
  }

  if (
    session.matchmakingType === "casual" &&
    scheduledTimeMs > now + TWELVE_HOURS_MS
  ) {
    await interaction.reply({
      content:
        "Casual matches can only be scheduled up to **12 hours** in advance.",
      ephemeral: true,
    });
    return;
  }

  session.scheduledAt = scheduledAt;
  session.scheduledTimezone = null;
  session.searchMinutes = null;

  pendingSessions.set(interaction.user.id, session);

  const unixSeconds = Math.floor(scheduledTimeMs / 1000);

  await interaction.reply({
    content:
      `Matchmaking type: **${session.matchmakingType.toUpperCase()}**\n` +
      `Host playing: **${session.hostIsPlayer ? "Yes" : "No"}**\n` +
      `Modes: **${getSessionModeNames(session.modes)}**\n` +
      `Scheduled for: <t:${unixSeconds}:F>\n\n` +
      "Create the ticket?",
    components: [buildCreateTicketButton()],
    ephemeral: true,
  });
}

export async function handleDurationSelect(
  interaction: StringSelectMenuInteraction
) {
  const session = pendingSessions.get(interaction.user.id) ?? {};

  if (session.matchmakingType === "competitive") {
    await interaction.reply({
      content:
        "Competitive matches use a scheduled timestamp instead of a search duration.",
      ephemeral: true,
    });
    return;
  }

  const selectedValue = interaction.values[0];
  const minutes = Number(selectedValue);

  session.searchMinutes = minutes <= 0 ? null : minutes;
  session.scheduledAt = null;
  session.scheduledTimezone = null;

  pendingSessions.set(interaction.user.id, session);

  await interaction.update({
    content:
      `Matchmaking type: **${session.matchmakingType?.toUpperCase() ?? "None"}**\n` +
      `Modes: **${getSessionModeNames(session.modes)}**\n` +
      `Searching for: **${getDurationText(session.searchMinutes)}**\n\n` +
      "Create the ticket?",
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
      content:
        "Your matchmaking setup expired or is incomplete. Run `/creatematch` again.",
      ephemeral: true,
    });
    return;
  }

  if (session.matchmakingType === "competitive" && !session.scheduledAt) {
    await interaction.reply({
      content: "Competitive tickets need a scheduled Discord timestamp.",
      ephemeral: true,
    });
    return;
  }

  const alreadyActive = await userHasActiveTicketOrAcceptance(interaction.user.id);

  if (alreadyActive) {
    await interaction.reply({
      content:
        "You already have an active matchmaking ticket, or you accepted a ticket that is still active. Finish, cancel, leave, or mark that ticket as wasn't played before creating another one.",
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
    hostIsPlayer: session.hostIsPlayer ?? true,
    modes: session.modes,
    searchMinutes:
      session.matchmakingType === "casual" && !session.scheduledAt
        ? session.searchMinutes
        : null,
    scheduledAt: session.scheduledAt ?? null,
    scheduledTimezone: null,
    matchTitle: session.matchTitle ?? null,
    matchDetails: session.matchDetails ?? null,
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