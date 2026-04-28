import { Client, GatewayIntentBits } from "discord.js";
import { config } from "./config";
import { registerCommands } from "./commands/registerCommands";
import { handleChatInputCommand } from "./handlers/commandHandler";
import {
  handleCreateTicket,
  handleDurationSelect,
  handleModeSelect,
  handleTypeButton,
} from "./handlers/setupHandlers";
import {
  handleAcceptTicket,
  handleCloseTicket,
  handleStartGame,
} from "./handlers/ticketHandlers";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user?.tag}`);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleChatInputCommand(interaction);
      return;
    }

    if (interaction.isButton()) {
      if (
        interaction.customId === "mm_type_casual" ||
        interaction.customId === "mm_type_competitive"
      ) {
        await handleTypeButton(interaction);
        return;
      }

      if (interaction.customId === "mm_create_ticket") {
        await handleCreateTicket(client, interaction);
        return;
      }

      if (interaction.customId.startsWith("ticket_accept_player_")) {
        const ticketId = interaction.customId.replace("ticket_accept_player_", "");
        await handleAcceptTicket(interaction, ticketId, "player");
        return;
      }

      if (interaction.customId.startsWith("ticket_accept_ref_")) {
        const ticketId = interaction.customId.replace("ticket_accept_ref_", "");
        await handleAcceptTicket(interaction, ticketId, "ref");
        return;
      }

      if (interaction.customId.startsWith("ticket_start_")) {
        const ticketId = interaction.customId.replace("ticket_start_", "");
        await handleStartGame(interaction, ticketId);
        return;
      }

      if (interaction.customId.startsWith("ticket_finish_")) {
        const ticketId = interaction.customId.replace("ticket_finish_", "");
        await handleCloseTicket(interaction, ticketId, "finished");
        return;
      }

      if (interaction.customId.startsWith("ticket_wasnt_played_")) {
        const ticketId = interaction.customId.replace("ticket_wasnt_played_", "");
        await handleCloseTicket(interaction, ticketId, "wasnt_played");
        return;
      }

      if (interaction.customId.startsWith("ticket_cancel_")) {
        const ticketId = interaction.customId.replace("ticket_cancel_", "");
        await handleCloseTicket(interaction, ticketId, "cancelled");
        return;
      }
    }

    if (interaction.isStringSelectMenu()) {
      if (interaction.customId === "mm_modes") {
        await handleModeSelect(interaction);
        return;
      }

      if (interaction.customId === "mm_duration") {
        await handleDurationSelect(interaction);
        return;
      }
    }
  } catch (error) {
    console.error("Interaction failed:", error);

    if (interaction.isRepliable()) {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({
          content: "Something went wrong.",
          ephemeral: true,
        });
      } else {
        await interaction.reply({
          content: "Something went wrong.",
          ephemeral: true,
        });
      }
    }
  }
});

async function main() {
  await registerCommands();
  await client.login(config.discordToken);
}

main().catch((error) => {
  console.error("Bot failed to start:", error);
  process.exit(1);
});