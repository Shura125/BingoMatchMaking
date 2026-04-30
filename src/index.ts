import { Client, GatewayIntentBits } from "discord.js";
import { config } from "./config";
import { registerCommands } from "./commands/registerCommands";
import { handleChatInputCommand } from "./handlers/commandHandler";
import {
  handleAddMatchDetailsButton,
  handleCasualTimingButton,
  handleCompetitiveHostRoleButton,
  handleCreateTicket,
  handleDurationSelect,
  handleMatchDetailsModal,
  handleModeSelect,
  handleOpenScheduleTimestampModal,
  handleScheduleTimestampModal,
  handleSkipMatchDetailsButton,
  handleTypeButton,
} from "./handlers/setupHandlers";
import {
  handleAcceptTicket,
  handleCloseTicket,
  handleLeaveQueueButton,
  handleRemovePlayerButton,
  handleRemovePlayerSelect,
  handleStartGame,
  handleStartGameAsMode,
} from "./handlers/ticketHandlers";
import { startExpireTicketsJob } from "./jobs/expireTickets";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user?.tag}`);

  startExpireTicketsJob(client);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleChatInputCommand(client, interaction);
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

      if (
        interaction.customId === "mm_comp_host_player" ||
        interaction.customId === "mm_comp_host_organizer"
      ) {
        await handleCompetitiveHostRoleButton(interaction);
        return;
      }

      if (interaction.customId === "mm_add_match_details") {
        await handleAddMatchDetailsButton(interaction);
        return;
      }

      if (interaction.customId === "mm_skip_match_details") {
        await handleSkipMatchDetailsButton(interaction);
        return;
      }

      if (
        interaction.customId === "mm_casual_search_now" ||
        interaction.customId === "mm_casual_schedule"
      ) {
        await handleCasualTimingButton(interaction);
        return;
      }

      if (interaction.customId === "mm_open_schedule_timestamp_modal") {
        await handleOpenScheduleTimestampModal(interaction);
        return;
      }

      if (interaction.customId === "mm_create_ticket") {
        await handleCreateTicket(client, interaction);
        return;
      }

      if (interaction.customId.startsWith("ticket_accept_player_")) {
        const ticketId = interaction.customId.replace(
          "ticket_accept_player_",
          ""
        );

        await handleAcceptTicket(interaction, ticketId, "player");
        return;
      }

      if (interaction.customId.startsWith("ticket_accept_ref_")) {
        const ticketId = interaction.customId.replace("ticket_accept_ref_", "");

        await handleAcceptTicket(interaction, ticketId, "ref");
        return;
      }

      if (interaction.customId.startsWith("ticket_leave_queue_")) {
        const ticketId = interaction.customId.replace(
          "ticket_leave_queue_",
          ""
        );

        await handleLeaveQueueButton(interaction, ticketId);
        return;
      }

      if (interaction.customId.startsWith("ticket_remove_player_")) {
        const ticketId = interaction.customId.replace(
          "ticket_remove_player_",
          ""
        );

        await handleRemovePlayerButton(interaction, ticketId);
        return;
      }

      // IMPORTANT:
      // These specific routes must be above the generic "ticket_start_" route.
      if (interaction.customId.startsWith("ticket_start_as_base_game_")) {
        const ticketId = interaction.customId.replace(
          "ticket_start_as_base_game_",
          ""
        );

        await handleStartGameAsMode(interaction, ticketId, "base_game");
        return;
      }

      if (interaction.customId.startsWith("ticket_start_as_scadubingo_")) {
        const ticketId = interaction.customId.replace(
          "ticket_start_as_scadubingo_",
          ""
        );

        await handleStartGameAsMode(interaction, ticketId, "scadubingo");
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
        const ticketId = interaction.customId.replace(
          "ticket_wasnt_played_",
          ""
        );

        await handleCloseTicket(interaction, ticketId, "wasnt_played");
        return;
      }

      if (interaction.customId.startsWith("ticket_cancel_")) {
        const ticketId = interaction.customId.replace("ticket_cancel_", "");

        await handleCloseTicket(interaction, ticketId, "cancelled");
        return;
      }

      return;
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

      if (interaction.customId.startsWith("ticket_remove_select_")) {
        const ticketId = interaction.customId.replace(
          "ticket_remove_select_",
          ""
        );

        await handleRemovePlayerSelect(interaction, ticketId);
        return;
      }

      return;
    }

    if (interaction.isModalSubmit()) {
      if (interaction.customId === "mm_match_details_modal") {
        await handleMatchDetailsModal(interaction);
        return;
      }

      if (interaction.customId === "mm_schedule_timestamp_modal") {
        await handleScheduleTimestampModal(interaction);
        return;
      }

      return;
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