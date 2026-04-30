import dotenv from "dotenv";

dotenv.config();

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing ${name} in .env`);
  }

  return value;
}

export const config = {
  discordToken: requireEnv("DISCORD_TOKEN"),
  discordClientId: requireEnv("DISCORD_CLIENT_ID"),
  guildId: requireEnv("GUILD_ID"),
  matchmakingChannelId: requireEnv("MATCHMAKING_CHANNEL_ID"),
  bingoPlayersRoleId: requireEnv("BINGO_PLAYERS_ROLE_ID"),

  supabaseUrl: requireEnv("SUPABASE_URL"),
  supabaseServiceRoleKey: requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
};