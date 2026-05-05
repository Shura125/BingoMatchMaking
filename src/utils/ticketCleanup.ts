import { ChannelType, Client } from "discord.js";

export async function deleteTicketMessage(
  client: Client,
  ticket: {
    channel_id: string;
    message_id: string | null;
  }
) {
  if (!ticket.message_id) {
    console.warn("Cannot delete ticket message: missing message_id");
    return;
  }

  const channel = await client.channels.fetch(ticket.channel_id).catch((error) => {
    console.error("Failed to fetch ticket channel:", error);
    return null;
  });

  if (!channel || channel.type !== ChannelType.GuildText) {
    console.warn("Cannot delete ticket message: channel missing or not GuildText");
    return;
  }

  const message = await channel.messages.fetch(ticket.message_id).catch((error) => {
    console.error("Failed to fetch ticket message:", error);
    return null;
  });

  if (!message) {
    console.warn("Cannot delete ticket message: message not found");
    return;
  }

  await message.delete().catch((error) => {
    console.error("Failed to delete ticket message:", error);
  });
}