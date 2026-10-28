import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  MessageFlags,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import {
  GameModeId,
  modeSupportsRandomTeams,
  ticketHasMode,
} from "../gameModes";
import { AcceptanceType } from "../types";
import {
  addAcceptance,
  closeTicket,
  fetchTicket,
  getAcceptances,
  leaveSpecificTicket,
  setRandomizedTeams,
  startTicketGame,
  userHasActiveCasualTicketOrAcceptance,
} from "../services/ticketService";
import {
  getPlayerAcceptances,
  getPlayerRequirementText,
  getMaxAcceptedPlayers,
  getStartModeLabel,
  getStartModeOptionsForTicket,
  canStartModeWithPlayers,
} from "../utils/playerLimits";
import { buildTicketButtons, buildTicketEmbedForClient } from "../ui/ticketRenderer";
import { refreshTicketMessage } from "../utils/ticketMessage";
import { deleteTicketMessage } from "../utils/ticketCleanup";
import { getPlayerDisplayName, resolveTicketPlayerNames } from "../utils/playerNames";
import { canRandomizeTeamRoster, formatRandomizedTeams } from "../utils/teams";

async function completeTicketAction(interaction: ButtonInteraction | StringSelectMenuInteraction, ticketId: string, notice: string) {
  if (!interaction.deferred && !interaction.replied) await interaction.deferUpdate();
  try {
    if (!interaction.message.flags.has(MessageFlags.Ephemeral)) {
      const ticket = await fetchTicket(ticketId);
      if (ticket) {
        const acceptances = await getAcceptances(ticketId);
        await interaction.editReply({ embeds: [await buildTicketEmbedForClient(interaction.client, ticket, acceptances)], components: buildTicketButtons(ticket, acceptances) });
        return;
      }
    } else await interaction.editReply({ content: notice, embeds: [], components: [] });
    if (await refreshTicketMessage(interaction.client, ticketId)) return;
  } catch (error) { console.error('Failed to refresh public ticket:', error); }
  await interaction.followUp({ content: 'Your action was saved, but the shared ticket could not refresh. Please contact an admin.', ephemeral: true });
}

export async function handleAcceptTicket(
  interaction: ButtonInteraction,
  ticketId: string,
  acceptanceType: AcceptanceType
) {
  await interaction.deferUpdate();
  const ticket = await fetchTicket(ticketId);

  if (!ticket) {
    await interaction.followUp({
      content: "This ticket no longer exists.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.status !== "open") {
    await interaction.followUp({
      content: "This ticket is no longer open.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.creator_discord_id === interaction.user.id) {
    await interaction.followUp({
      content: "You cannot accept your own matchmaking ticket.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.matchmaking_type === "casual") {
    const alreadyActiveCasual = await userHasActiveCasualTicketOrAcceptance(
      interaction.user.id
    );

    if (alreadyActiveCasual) {
      await interaction.followUp({
        content:
          "You already have an active casual matchmaking ticket, or you accepted another casual ticket that is still active.",
        ephemeral: true,
      });
      return;
    }
  }

  const existingAcceptances = await getAcceptances(ticketId);
  const alreadyAccepted = existingAcceptances.some(
    (acceptance) => acceptance.discord_id === interaction.user.id
  );

  if (alreadyAccepted) {
    await interaction.followUp({
      content: "You are already on this ticket.",
      ephemeral: true,
    });
    return;
  }

  const playerAcceptances = getPlayerAcceptances(existingAcceptances);
  const maxAcceptedPlayers = getMaxAcceptedPlayers(ticket);

  if (
    acceptanceType === "player" &&
    playerAcceptances.length >= maxAcceptedPlayers
  ) {
    await interaction.followUp({
      content:
        `This ticket already has the maximum number of players.\n\n` +
        getPlayerRequirementText(ticket),
      ephemeral: true,
    });
    return;
  }

  const success = await addAcceptance({
    ticketId,
    discordId: interaction.user.id,
    acceptanceType,
  });

  if (!success) {
    await interaction.followUp({
      content: "Could not accept this ticket.",
      ephemeral: true,
    });
    return;
  }

  await completeTicketAction(interaction, ticketId, acceptanceType === "ref" ? "You joined as a referee." : "You joined the match.");
}

export async function handleRemovePlayerButton(
  interaction: ButtonInteraction,
  ticketId: string
) {
  const ticket = await fetchTicket(ticketId);

  if (!ticket) {
    await interaction.reply({
      content: "This ticket no longer exists.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.creator_discord_id !== interaction.user.id) {
    await interaction.reply({
      content: "Only the host can remove players from this ticket.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.status !== "open") {
    await interaction.reply({
      content: "You can only remove players while the ticket is still open.",
      ephemeral: true,
    });
    return;
  }

  const acceptances = await getAcceptances(ticketId);

  if (acceptances.length === 0) {
    await interaction.reply({
      content: "There are no queued players or refs to remove.",
      ephemeral: true,
    });
    return;
  }

  const names = await resolveTicketPlayerNames(interaction.client, ticket, acceptances);
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ticket_remove_select_${ticket.id}`)
    .setPlaceholder("Choose someone to remove")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      acceptances.slice(0, 25).map((acceptance) => ({
        label:
          acceptance.acceptance_type === "ref"
            ? `Ref - ${getPlayerDisplayName(acceptance.discord_id, names)}`
            : `Player - ${getPlayerDisplayName(acceptance.discord_id, names)}`,
        value: acceptance.discord_id,
        description:
          acceptance.acceptance_type === "ref"
            ? "Remove this ref from the ticket"
            : "Remove this player from the ticket",
      }))
    );

  await interaction.reply({
    content: "Choose a queued player/ref to remove:",
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu),
    ],
    ephemeral: true,
  });
}

export async function handleRemovePlayerSelect(
  interaction: StringSelectMenuInteraction,
  ticketId: string
) {
  const ticket = await fetchTicket(ticketId);

  if (!ticket) {
    await interaction.reply({
      content: "This ticket no longer exists.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.creator_discord_id !== interaction.user.id) {
    await interaction.reply({
      content: "Only the host can remove players from this ticket.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.status !== "open") {
    await interaction.reply({
      content: "You can only remove players while the ticket is still open.",
      ephemeral: true,
    });
    return;
  }

  const discordIdToRemove = interaction.values[0];

  const success = await leaveSpecificTicket(ticketId, discordIdToRemove);

  if (!success) {
    await interaction.reply({
      content: "Could not remove that user from the ticket.",
      ephemeral: true,
    });
    return;
  }

  await completeTicketAction(interaction, ticketId, "Removed the selected player/ref from the ticket.");
}

export async function handleStartGame(
  interaction: ButtonInteraction,
  ticketId: string
) {
  const ticket = await fetchTicket(ticketId);

  if (!ticket) {
    await interaction.reply({
      content: "This ticket no longer exists.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.creator_discord_id !== interaction.user.id) {
    await interaction.reply({
      content: "Only the host can start this game.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.status !== "open") {
    await interaction.reply({
      content: "This ticket cannot be started because it is not open.",
      ephemeral: true,
    });
    return;
  }

  const acceptances = await getAcceptances(ticketId);
  const playerAcceptances = getPlayerAcceptances(acceptances);
  const startModeResult = getStartModeOptionsForTicket(ticket, acceptances);

  if (!startModeResult.canStart) {
    await interaction.reply({
      content:
        `You cannot start this game yet.\n\n` +
        `Current accepted players: **${playerAcceptances.length}/${startModeResult.requiredAcceptedPlayers}**\n` +
        startModeResult.message,
      ephemeral: true,
    });
    return;
  }

  if (startModeResult.autoStartMode) {
    const success = await startTicketGame(
      ticketId,
      startModeResult.autoStartMode
    );

    if (!success) {
      await interaction.reply({
        content: "Could not start the game.",
        ephemeral: true,
      });
      return;
    }

    await completeTicketAction(interaction, ticketId, "Match started. The two-hour auto-finish timer is running.");
    return;
  }

  const buttons = startModeResult.options.map((option) =>
    new ButtonBuilder()
      .setCustomId(`ticket_start_as_${option.mode}_${ticket.id}`)
      .setLabel(`Start as ${option.label}`)
      .setStyle(ButtonStyle.Primary)
  );
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  for (let index = 0; index < buttons.length; index += 5) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(buttons.slice(index, index + 5))
    );
  }

  await interaction.reply({
    content: "Choose which mode to start this match as:",
    components: rows,
    ephemeral: true,
  });
}

export async function handleLeaveQueueButton(
  interaction: ButtonInteraction,
  ticketId: string
) {
  const ticket = await fetchTicket(ticketId);

  if (!ticket) {
    await interaction.reply({
      content: "This ticket no longer exists.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.status !== "open") {
    await interaction.reply({
      content: "You can only leave tickets that are still open.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.creator_discord_id === interaction.user.id) {
    await interaction.reply({
      content: "The host cannot leave their own ticket. Use cancel instead.",
      ephemeral: true,
    });
    return;
  }

  const acceptances = await getAcceptances(ticketId);
  const isQueued = acceptances.some(
    (acceptance) => acceptance.discord_id === interaction.user.id
  );

  if (!isQueued) {
    await interaction.reply({
      content: "You are not currently queued on this ticket.",
      ephemeral: true,
    });
    return;
  }

  const success = await leaveSpecificTicket(ticketId, interaction.user.id);

  if (!success) {
    await interaction.reply({
      content: "Could not leave this queue.",
      ephemeral: true,
    });
    return;
  }

  await completeTicketAction(interaction, ticketId, "You left the queue.");
}

export async function handleRandomizeTeams(
  interaction: ButtonInteraction,
  ticketId: string
) {
  const ticket = await fetchTicket(ticketId);

  if (!ticket) {
    await interaction.reply({
      content: "This ticket no longer exists.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.creator_discord_id !== interaction.user.id) {
    await interaction.reply({
      content: "Only the host can randomize teams for this ticket.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.status !== "started") {
    await interaction.reply({
      content: "Teams can only be randomized after the game has started.",
      ephemeral: true,
    });
    return;
  }

  if (!modeSupportsRandomTeams(ticket.started_mode)) {
    await interaction.reply({
      content: "Random teams are only available for Veilbreak, Battleship, and Ringus.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.randomized_teams) {
    await interaction.reply({
      content: "Teams have already been randomized for this ticket.",
      ephemeral: true,
    });
    return;
  }

  const acceptances = await getAcceptances(ticketId);
  const playerIds = [
    ...(ticket.host_is_player ? [ticket.creator_discord_id] : []),
    ...getPlayerAcceptances(acceptances).map(
      (acceptance) => acceptance.discord_id
    ),
  ];

  if (!canRandomizeTeamRoster(playerIds, ticket.started_mode)) {
    await interaction.reply({
      content:
        "The roster must fit this mode before teams can be randomized: Veilbreak needs 4 players, Ringus needs 6, and Battleship needs 6, 8, or 10 unique players.",
      ephemeral: true,
    });
    return;
  }

  const randomizedTeams = formatRandomizedTeams(playerIds, ticket.started_mode);
  const saved = await setRandomizedTeams(ticketId, randomizedTeams);

  if (!saved) {
    await interaction.reply({
      content: "Teams have already been randomized for this ticket.",
      ephemeral: true,
    });
    return;
  }

  await completeTicketAction(interaction, ticketId, "Teams assigned. See the shared ticket for your team.");
}

export async function handleStartGameAsMode(
  interaction: ButtonInteraction,
  ticketId: string,
  startedMode: GameModeId
) {
  const ticket = await fetchTicket(ticketId);

  if (!ticket) {
    await interaction.reply({
      content: "This ticket no longer exists.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.creator_discord_id !== interaction.user.id) {
    await interaction.reply({
      content: "Only the host can start this game.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.status !== "open") {
    await interaction.reply({
      content: "This ticket cannot be started because it is not open.",
      ephemeral: true,
    });
    return;
  }

  if (!ticketHasMode(ticket, startedMode)) {
    await interaction.reply({
      content: `This ticket did not include ${getStartModeLabel(
        startedMode
      )} as an option.`,
      ephemeral: true,
    });
    return;
  }

  const acceptances = await getAcceptances(ticketId);
  if (!canStartModeWithPlayers(ticket, startedMode, acceptances)) {
    await interaction.reply({
      content: `The current roster cannot start as ${getStartModeLabel(startedMode)}.\n\n${getPlayerRequirementText(ticket)}`,
      ephemeral: true,
    });
    return;
  }

  const success = await startTicketGame(ticketId, startedMode);

  if (!success) {
    await interaction.reply({
      content: "Could not start the game.",
      ephemeral: true,
    });
    return;
  }

  await completeTicketAction(interaction, ticketId, "Match started. The two-hour auto-finish timer is running.");
}

export async function handleCloseTicket(
  interaction: ButtonInteraction,
  ticketId: string,
  newStatus: "finished" | "cancelled"
) {
  const ticket = await fetchTicket(ticketId);

  if (!ticket) {
    await interaction.reply({
      content: "This ticket no longer exists.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.creator_discord_id !== interaction.user.id) {
    await interaction.reply({
      content: "Only the ticket creator can do that.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.status !== "open" && ticket.status !== "started") {
    await interaction.reply({
      content: "This ticket is already closed.",
      ephemeral: true,
    });
    return;
  }

  const success = await closeTicket(ticket, newStatus);

  if (!success) {
    await interaction.reply({
      content: newStatus === 'finished' && ticket.status === 'open'
        ? 'Start the match before marking it finished. Use Cancel Ticket to close an unstarted match.'
        : 'Could not update this ticket. It may have changed; please check its current roster and status.',
      ephemeral: true,
    });
    return;
  }

  if (newStatus === "cancelled") {
    await interaction.reply({ content: "This ticket has been cancelled and removed.", ephemeral: true });

    await deleteTicketMessage(interaction.client, ticket);
    return;
  }

  await completeTicketAction(interaction, ticketId, "Match finished.");
}
