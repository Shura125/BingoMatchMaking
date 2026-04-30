import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "../config";

const commands = [
  new SlashCommandBuilder()
    .setName("creatematch")
    .setDescription("Create a casual or official matchmaking ticket.")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("myticket")
    .setDescription("Show your current active matchmaking ticket.")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("cancelticket")
    .setDescription("Cancel your active matchmaking ticket if you are the host.")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("leavequeue")
    .setDescription("Leave a matchmaking ticket you accepted.")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("recentmatches")
    .setDescription("Show the most recent finished matches.")
    .toJSON(),

  new SlashCommandBuilder()
    .setName("openmatches")
    .setDescription("View all currently open or started matchmaking tickets.")
    .toJSON(),

    new SlashCommandBuilder()
  .setName("forceclose")
  .setDescription("Admin: force close a matchmaking ticket.")
  .addStringOption((option) =>
    option
      .setName("ticket_id")
      .setDescription("The ticket UUID.")
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName("status")
      .setDescription("The status to set.")
      .setRequired(true)
      .addChoices(
        { name: "Cancelled", value: "cancelled" },
        { name: "Expired", value: "expired" },
        { name: "Wasn't Played", value: "wasnt_played" },
        { name: "Finished", value: "finished" }
      )
  )
  .toJSON(),

new SlashCommandBuilder()
  .setName("removeplayer")
  .setDescription("Admin: remove a player or ref from a ticket queue.")
  .addStringOption((option) =>
    option
      .setName("ticket_id")
      .setDescription("The ticket UUID.")
      .setRequired(true)
  )
  .addUserOption((option) =>
    option
      .setName("user")
      .setDescription("The user to remove from the ticket.")
      .setRequired(true)
  )
  .toJSON(),
];

export async function registerCommands() {
  const rest = new REST({ version: "10" }).setToken(config.discordToken);

  await rest.put(
    Routes.applicationGuildCommands(config.discordClientId, config.guildId),
    {
      body: commands,
    }
  );

  console.log("Slash commands registered.");
}