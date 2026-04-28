import { REST, Routes, SlashCommandBuilder } from "discord.js";
import { config } from "../config";

const commands = [
  new SlashCommandBuilder()
    .setName("matchmake")
    .setDescription("Create a casual or competitive matchmaking ticket.")
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