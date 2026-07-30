import { ChannelType, Client } from "discord.js";

export async function deleteTicketMessage(
  client: Client,
  ticket: {
    channel_id: string;
    message_id: string | null;
  }
): Promise<boolean> {
  if (!ticket.message_id) {
    console.warn("Cannot delete ticket message: missing message_id");
    return true;
  }

  const channel = await client.channels.fetch(ticket.channel_id).catch((error) => {
    console.error("Failed to fetch ticket channel:", error);
    return null;
  });

  if (!channel || channel.type !== ChannelType.GuildText) {
    console.warn("Cannot delete ticket message: channel missing or not GuildText");
    return false;
  }

  const message = await channel.messages.fetch(ticket.message_id).catch((error) => {
    if (error?.code === 10008) {
      console.warn("Ticket message was already deleted.");
      return null;
    }

    console.error("Failed to fetch ticket message:", error);
    return null;
  });

  if (!message) {
    return true;
  }

  const deleted = await message.delete().then(
    () => true,
    (error) => {
      if (error?.code === 10008) {
        console.warn("Ticket message was already deleted.");
        return true;
      }

      console.error("Failed to delete ticket message:", error);
      return false;
    }
  );

  return deleted;
}
