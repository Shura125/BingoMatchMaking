import { Client, Events, GatewayIntentBits } from "discord.js";
import { config } from "./config";
import { GAME_MODE_IDS } from "./gameModes";
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
  handleRandomizeTeams,
  handleRemovePlayerButton,
  handleRemovePlayerSelect,
  handleStartGame,
  handleStartGameAsMode,
} from "./handlers/ticketHandlers";
import { startExpireTicketsJob } from "./jobs/expireTickets";

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

function isInteractionRaceError(error: unknown): boolean {
  const code = (error as { code?: number }).code;

  return code === 10062 || code === 40060;
}

client.once(Events.ClientReady, () => {
  console.log(`Logged in as ${client.user?.tag}`);

  startExpireTicketsJob(client);
});

client.on(Events.Error, (error) => {
  console.error("Discord client error:", error);
});

client.on("interactionCreate", async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      await handleChatInputCommand(client, interaction);
      return;
    }

    if (interaction.isButton()) {
      if (
        interaction.customId === "mm_type_bingo" ||
        interaction.customId === "mm_type_casual_games" ||
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

      if (interaction.customId.startsWith("ticket_randomize_teams_")) {
        const ticketId = interaction.customId.replace(
          "ticket_randomize_teams_",
          ""
        );

        await handleRandomizeTeams(interaction, ticketId);
        return;
      }

      for (const modeId of GAME_MODE_IDS) {
        const customIdPrefix = `ticket_start_as_${modeId}_`;

        if (interaction.customId.startsWith(customIdPrefix)) {
          const ticketId = interaction.customId.replace(customIdPrefix, "");

          await handleStartGameAsMode(interaction, ticketId, modeId);
          return;
        }
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
      try {
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
      } catch (responseError) {
        if (isInteractionRaceError(responseError)) {
          console.warn(
            "Could not send interaction error response because Discord already closed or acknowledged it."
          );
          return;
        }

        console.error("Failed to send interaction error response:", responseError);
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
