import { ChannelType, Client } from "discord.js";
import { fetchTicket, getAcceptances } from "../services/ticketService";
import { buildTicketButtons, buildTicketEmbed } from "../ui/ticketRenderer";
import { MatchTicket } from "../types";

export function getTicketJumpUrl(ticket: MatchTicket): string | null {
  if (!ticket.message_id) return null;

  return `https://discord.com/channels/${ticket.guild_id}/${ticket.channel_id}/${ticket.message_id}`;
}

export async function refreshTicketMessage(
  client: Client,
  ticketId: string
): Promise<boolean> {
  const ticket = await fetchTicket(ticketId);

  if (!ticket || !ticket.message_id) {
    return false;
  }

  const acceptances = await getAcceptances(ticket.id);
  const channel = await client.channels.fetch(ticket.channel_id);

  if (!channel || channel.type !== ChannelType.GuildText) {
    return false;
  }

  const message = await channel.messages.fetch(ticket.message_id);

  await message.edit({
    embeds: [buildTicketEmbed(ticket, acceptances)],
    components: buildTicketButtons(ticket),
  });

  return true;
}