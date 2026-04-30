import { ChannelType, Client } from "discord.js";

export async function deleteTicketMessage(
  client: Client,
  ticket: {
    channel_id: string;
    message_id: string | null;
  }
) {
  if (!ticket.message_id) return;

  const channel = await client.channels.fetch(ticket.channel_id).catch(() => null);

  if (!channel || channel.type !== ChannelType.GuildText) return;

  const message = await channel.messages.fetch(ticket.message_id).catch(() => null);

  await message?.delete().catch(() => {});
}