import { escapeMarkdown, type Client } from "discord.js";
import type { MatchTicket, MatchTicketAcceptance } from "../types";

export type PlayerNames = ReadonlyMap<string, string>;

export function getPlayerDisplayName(discordId: string, names: PlayerNames): string {
  const name = names.get(discordId)?.replace(/[\r\n\t]+/g, " ").trim();
  // Discord display names fit 32 characters. Bound legacy/unexpected values
  // so a full ten-player roster still fits an embed field.
  return name ? Array.from(name).slice(0, 32).join("") : "Name unavailable";
}

export function formatPlayerMention(discordId: string, names: PlayerNames): string {
  const name = escapeMarkdown(getPlayerDisplayName(discordId, names)).replace(/@/g, "@\u200b");
  return `<@${discordId}> (${name})`;
}

export async function resolveTicketPlayerNames(
  client: Client,
  ticket: MatchTicket,
  acceptances: MatchTicketAcceptance[]
): Promise<PlayerNames> {
  const teamIds = [...(ticket.randomized_teams ?? "").matchAll(/<@!?(\d+)>/g)].map((match) => match[1]);
  const ids = new Set([ticket.creator_discord_id, ...acceptances.map((row) => row.discord_id), ...teamIds]);
  const names = new Map<string, string>();
  const guild = client.guilds.cache.get(ticket.guild_id);

  await Promise.all([...ids].map(async (id) => {
    const cachedMember = guild?.members.cache.get(id);
    if (cachedMember) {
      names.set(id, cachedMember.displayName);
      return;
    }
    // Fetch individual members, never the entire guild roster.
    const member = await guild?.members.fetch(id).catch(() => null);
    if (member) {
      names.set(id, member.displayName);
      return;
    }
    const user = client.users.cache.get(id) ?? await client.users.fetch(id).catch(() => null);
    if (user) names.set(id, user.globalName || user.username);
  }));

  return names;
}
