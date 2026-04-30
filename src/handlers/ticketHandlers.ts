import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  StringSelectMenuBuilder,
  StringSelectMenuInteraction,
} from "discord.js";
import { AcceptanceType } from "../types";
import {
  addAcceptance,
  closeTicket,
  fetchTicket,
  getAcceptances,
  leaveSpecificTicket,
  startTicketGame,
  userHasActiveTicketOrAcceptance,
} from "../services/ticketService";
import {
  getPlayerAcceptances,
  getPlayerRequirementText,
  getRequiredAcceptedPlayers,
  getStartModeLabel,
  getStartModeOptionsForTicket,
} from "../utils/playerLimits";
import { buildTicketButtons, buildTicketEmbed } from "../ui/ticketRenderer";
import { deleteTicketMessage } from "../utils/ticketCleanup";

async function renderTicketMessage(ticketId: string) {
  const ticket = await fetchTicket(ticketId);
  if (!ticket) return null;

  const acceptances = await getAcceptances(ticket.id);

  return {
    embeds: [buildTicketEmbed(ticket, acceptances)],
    components: buildTicketButtons(ticket),
  };
}

export async function handleAcceptTicket(
  interaction: ButtonInteraction,
  ticketId: string,
  acceptanceType: AcceptanceType
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
      content: "This ticket is no longer open.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.creator_discord_id === interaction.user.id) {
    await interaction.reply({
      content: "You cannot accept your own matchmaking ticket.",
      ephemeral: true,
    });
    return;
  }

  const alreadyActiveElsewhere = await userHasActiveTicketOrAcceptance(
    interaction.user.id
  );

  if (alreadyActiveElsewhere) {
    await interaction.reply({
      content:
        "You already have an active matchmaking ticket, or you accepted another ticket that is still active.",
      ephemeral: true,
    });
    return;
  }

  const existingAcceptances = await getAcceptances(ticketId);
  const alreadyAccepted = existingAcceptances.some(
    (acceptance) => acceptance.discord_id === interaction.user.id
  );

  if (alreadyAccepted) {
    await interaction.reply({
      content: "You are already on this ticket.",
      ephemeral: true,
    });
    return;
  }

  const playerAcceptances = getPlayerAcceptances(existingAcceptances);
  const requiredAcceptedPlayers = getRequiredAcceptedPlayers(ticket);

  if (
    acceptanceType === "player" &&
    playerAcceptances.length >= requiredAcceptedPlayers
  ) {
    await interaction.reply({
      content:
        `This ticket already has the required number of players.\n\n` +
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
    await interaction.reply({
      content: "Could not accept this ticket.",
      ephemeral: true,
    });
    return;
  }

  const rendered = await renderTicketMessage(ticketId);

  if (!rendered) {
    await interaction.reply({
      content: "Accepted, but failed to refresh the ticket message.",
      ephemeral: true,
    });
    return;
  }

  await interaction.update(rendered);
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

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId(`ticket_remove_select_${ticket.id}`)
    .setPlaceholder("Choose someone to remove")
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      acceptances.slice(0, 25).map((acceptance) => ({
        label:
          acceptance.acceptance_type === "ref"
            ? `Ref - ${acceptance.discord_id}`
            : `Player - ${acceptance.discord_id}`,
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

  const rendered = await renderTicketMessage(ticketId);

  if (!rendered) {
    await interaction.reply({
      content: "Player removed, but the public ticket could not refresh.",
      ephemeral: true,
    });
    return;
  }

  await interaction.update({
    content: `Removed <@${discordIdToRemove}> from the ticket.`,
    components: [],
  });

  try {
    const publicMessage = await interaction.channel?.messages.fetch(
      ticket.message_id ?? ""
    );

    await publicMessage?.edit(rendered);
  } catch (error) {
    console.error("Failed to refresh public ticket after removing player:", error);
  }
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

    const rendered = await renderTicketMessage(ticketId);

    if (!rendered) {
      await interaction.reply({
        content: "Game started, but failed to refresh the ticket.",
        ephemeral: true,
      });
      return;
    }

    await interaction.update(rendered);
    return;
  }

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    ...startModeResult.options.map((option) =>
      new ButtonBuilder()
        .setCustomId(`ticket_start_as_${option.mode}_${ticket.id}`)
        .setLabel(`Start as ${option.label}`)
        .setStyle(ButtonStyle.Primary)
    )
  );

  await interaction.reply({
    content: "Choose which mode to start this match as:",
    components: [row],
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

  const rendered = await renderTicketMessage(ticketId);

  if (!rendered) {
    await interaction.reply({
      content: "You left the queue, but the ticket could not refresh.",
      ephemeral: true,
    });
    return;
  }

  await interaction.update(rendered);
}

export async function handleStartGameAsMode(
  interaction: ButtonInteraction,
  ticketId: string,
  startedMode: "base_game" | "scadubingo"
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

  if (startedMode === "base_game" && !ticket.base_game) {
    await interaction.reply({
      content: "This ticket did not include Base Game as an option.",
      ephemeral: true,
    });
    return;
  }

  if (startedMode === "scadubingo" && !ticket.scadubingo) {
    await interaction.reply({
      content: "This ticket did not include Scadubingo as an option.",
      ephemeral: true,
    });
    return;
  }

  const acceptances = await getAcceptances(ticketId);
  const playerAcceptances = getPlayerAcceptances(acceptances);

  if (playerAcceptances.length < 1) {
    await interaction.reply({
      content: "You need at least 1 accepted player to start as a 1v1 mode.",
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

  const rendered = await renderTicketMessage(ticketId);

  if (!rendered) {
    await interaction.reply({
      content: `Game started as **${getStartModeLabel(
        startedMode
      )}**, but failed to refresh the ticket.`,
      ephemeral: true,
    });
    return;
  }

  await interaction.update({
    content: `Game started as **${getStartModeLabel(startedMode)}**.`,
    components: [],
  });

  if (ticket.message_id) {
    try {
      await interaction.channel?.messages.fetch(ticket.message_id).then((msg) =>
        msg.edit(rendered)
      );
    } catch (error) {
      console.error("Failed to refresh public ticket after mode start:", error);
    }
  }
}

export async function handleCloseTicket(
  interaction: ButtonInteraction,
  ticketId: string,
  newStatus: "finished" | "wasnt_played" | "cancelled"
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
      content: "Could not update this ticket.",
      ephemeral: true,
    });
    return;
  }

  const deleteStatuses: Array<typeof newStatus> = ["wasnt_played", "cancelled"];

  if (deleteStatuses.includes(newStatus)) {
    await interaction.reply({
      content:
        newStatus === "wasnt_played"
          ? "This ticket has been marked as wasn't played and removed."
          : "This ticket has been cancelled and removed.",
      ephemeral: true,
    });

    await deleteTicketMessage(interaction.client, ticket);
    return;
  }

  const rendered = await renderTicketMessage(ticketId);

  if (!rendered) {
    await interaction.reply({
      content: "Ticket updated, but failed to refresh the message.",
      ephemeral: true,
    });
    return;
  }

  await interaction.update(rendered);
}