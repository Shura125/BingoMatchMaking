import { ChatInputCommandInteraction } from "discord.js";
import { buildTypeButtons } from "../ui/setupComponents";
import { userHasActiveTicketOrAcceptance } from "../services/ticketService";

export async function handleChatInputCommand(
  interaction: ChatInputCommandInteraction
) {
  if (interaction.commandName !== "matchmake") return;

  const alreadyActive = await userHasActiveTicketOrAcceptance(interaction.user.id);

  if (alreadyActive) {
    await interaction.reply({
      content:
        "You already have an active matchmaking ticket, or you accepted a ticket that is still active. Finish, cancel, or mark that ticket as wasn't played before creating another one.",
      ephemeral: true,
    });
    return;
  }

  await interaction.reply({
    content: "Choose the type of matchmaking ticket you want to create.",
    components: [buildTypeButtons()],
    ephemeral: true,
  });
}