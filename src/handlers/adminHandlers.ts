import {
  ChatInputCommandInteraction,
  Client,
  PermissionFlagsBits,
} from "discord.js";
import {
  fetchTicket,
  forceSetTicketStatus,
  leaveSpecificTicket,
} from "../services/ticketService";
import { refreshTicketMessage } from "../utils/ticketMessage";

function isAdmin(interaction: ChatInputCommandInteraction): boolean {
  if (!interaction.inGuild()) return false;

  const memberPermissions = interaction.memberPermissions;

  return Boolean(
    memberPermissions?.has(PermissionFlagsBits.ManageGuild) ||
      memberPermissions?.has(PermissionFlagsBits.Administrator)
  );
}

export async function handleForceCloseCommand(
  client: Client,
  interaction: ChatInputCommandInteraction
) {
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: "You need Manage Server or Administrator permission to use this.",
      ephemeral: true,
    });
    return;
  }

  const ticketId = interaction.options.getString("ticket_id", true);
  const status = interaction.options.getString("status", true) as
    | "finished"
    | "wasnt_played"
    | "cancelled"
    | "expired";

  const ticket = await fetchTicket(ticketId);

  if (!ticket) {
    await interaction.reply({
      content: "Could not find that ticket.",
      ephemeral: true,
    });
    return;
  }

  const success = await forceSetTicketStatus(ticketId, status);

  if (!success) {
    await interaction.reply({
      content: "Could not force close that ticket.",
      ephemeral: true,
    });
    return;
  }

  await refreshTicketMessage(client, ticketId);

  await interaction.reply({
    content: `Ticket has been set to **${status.toUpperCase()}**.`,
    ephemeral: true,
  });
}

export async function handleRemovePlayerCommand(
  client: Client,
  interaction: ChatInputCommandInteraction
) {
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: "You need Manage Server or Administrator permission to use this.",
      ephemeral: true,
    });
    return;
  }

  const ticketId = interaction.options.getString("ticket_id", true);
  const user = interaction.options.getUser("user", true);

  const ticket = await fetchTicket(ticketId);

  if (!ticket) {
    await interaction.reply({
      content: "Could not find that ticket.",
      ephemeral: true,
    });
    return;
  }

  if (ticket.creator_discord_id === user.id) {
    await interaction.reply({
      content: "You cannot remove the host with this command. Force close the ticket instead.",
      ephemeral: true,
    });
    return;
  }

  const success = await leaveSpecificTicket(ticketId, user.id);

  if (!success) {
    await interaction.reply({
      content: "Could not remove that user from the ticket.",
      ephemeral: true,
    });
    return;
  }

  await refreshTicketMessage(client, ticketId);

  await interaction.reply({
    content: `Removed ${user} from the ticket queue.`,
    ephemeral: true,
  });
}