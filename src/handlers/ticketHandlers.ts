import { ButtonInteraction } from "discord.js";
import { AcceptanceType } from "../types";
import {
  addAcceptance,
  closeTicket,
  fetchTicket,
  getAcceptances,
  startTicketGame,
  userHasActiveTicketOrAcceptance,
} from "../services/ticketService";
import { buildTicketButtons, buildTicketEmbed } from "../ui/ticketRenderer";

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
  const hasPlayer = acceptances.some(
    (acceptance) => acceptance.acceptance_type === "player"
  );

  if (!hasPlayer) {
    await interaction.reply({
      content: "You need at least one player to accept before starting the game.",
      ephemeral: true,
    });
    return;
  }

  const success = await startTicketGame(ticketId);

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