import { supabase } from "../supabase";
import {
  AcceptanceType,
  MatchRecord,
  MatchTicket,
  MatchTicketAcceptance,
  MatchmakingType,
  TicketStatus,
} from "../types";
import { GameModeId, getGameMode, getModeFlags } from "../gameModes";
import { generateGameSeed, generateLobbyCode } from "../utils/generators";

const activeStatuses: TicketStatus[] = ["open", "started"];

export async function userHasActiveTicketOrAcceptance(
  discordId: string
): Promise<boolean> {
  const { data: ownedTickets, error: ownedError } = await supabase
    .from("bot_match_tickets")
    .select("id")
    .eq("creator_discord_id", discordId)
    .in("status", activeStatuses)
    .limit(1);

  if (ownedError) {
    console.error("Failed to check owned tickets:", ownedError);
    return true;
  }

  if (ownedTickets && ownedTickets.length > 0) {
    return true;
  }

  const { data: acceptedTickets, error: acceptedError } = await supabase
    .from("bot_match_ticket_acceptances")
    .select(
      `
      id,
      bot_match_tickets!inner (
        id,
        status
      )
    `
    )
    .eq("discord_id", discordId)
    .in("bot_match_tickets.status", activeStatuses)
    .limit(1);

  if (acceptedError) {
    console.error("Failed to check accepted tickets:", acceptedError);
    return true;
  }

  return !!acceptedTickets && acceptedTickets.length > 0;
}

export async function userHasActiveCasualTicketOrAcceptance(
  discordId: string
): Promise<boolean> {
  const { data: ownedTickets, error: ownedError } = await supabase
    .from("bot_match_tickets")
    .select("id")
    .eq("creator_discord_id", discordId)
    .eq("matchmaking_type", "casual")
    .in("status", activeStatuses)
    .limit(1);

  if (ownedError) {
    console.error("Failed to check owned casual tickets:", ownedError);
    return true;
  }

  if (ownedTickets && ownedTickets.length > 0) {
    return true;
  }

  const { data: acceptedTickets, error: acceptedError } = await supabase
    .from("bot_match_ticket_acceptances")
    .select(
      `
      id,
      bot_match_tickets!inner (
        id,
        status,
        matchmaking_type
      )
      `
    )
    .eq("discord_id", discordId)
    .eq("bot_match_tickets.matchmaking_type", "casual")
    .in("bot_match_tickets.status", activeStatuses)
    .limit(1);

  if (acceptedError) {
    console.error("Failed to check accepted casual tickets:", acceptedError);
    return true;
  }

  return !!acceptedTickets && acceptedTickets.length > 0;
}

export async function fetchTicket(ticketId: string): Promise<MatchTicket | null> {
  const { data, error } = await supabase
    .from("bot_match_tickets")
    .select("*")
    .eq("id", ticketId)
    .single();

  if (error) {
    console.error("Failed to fetch ticket:", error);
    return null;
  }

  return data as MatchTicket;
}

export async function getAcceptances(
  ticketId: string
): Promise<MatchTicketAcceptance[]> {
  const { data, error } = await supabase
    .from("bot_match_ticket_acceptances")
    .select("*")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });

  if (error) {
    console.error("Failed to load acceptances:", error);
    return [];
  }

  return data as MatchTicketAcceptance[];
}

export async function createTicket(input: {
  guildId: string;
  channelId: string;
  creatorDiscordId: string;
  matchmakingType: MatchmakingType;
  hostIsPlayer: boolean;
  battleshipTeamSize?: number | null;
  modes: string[];
  searchMinutes: number | null | undefined;
  scheduledAt: string | null | undefined;
  scheduledTimezone: string | null | undefined;
  matchTitle: string | null | undefined;
  matchDetails: string | null | undefined;
}): Promise<MatchTicket | null> {
  const isCasualSearchNow =
    input.matchmakingType === "casual" && !input.scheduledAt;

  const expiresAt =
    isCasualSearchNow && input.searchMinutes && input.searchMinutes > 0
      ? new Date(Date.now() + input.searchMinutes * 60 * 1000).toISOString()
      : null;
  const modeFlags = getModeFlags(input.modes);

  const { data, error } = await supabase
    .from("bot_match_tickets")
    .insert({
      guild_id: input.guildId,
      channel_id: input.channelId,
      creator_discord_id: input.creatorDiscordId,

      matchmaking_type: input.matchmakingType,

      host_is_player: input.hostIsPlayer,
      battleship_team_size: input.modes.includes("battleship") ? input.battleshipTeamSize ?? null : null,
      scheduled_at: input.scheduledAt ?? null,
      scheduled_timezone: input.scheduledTimezone ?? null,

      match_title: input.matchTitle ?? null,
      match_details: input.matchDetails ?? null,

      ...modeFlags,

      search_minutes: isCasualSearchNow ? input.searchMinutes : null,
      expires_at: expiresAt,

      status: "open",
    })
    .select()
    .single();

  if (error || !data) {
    console.error("Failed to create ticket:", error);
    return null;
  }

  return data as MatchTicket;
}

export async function updateTicketMessageId(ticketId: string, messageId: string) {
  const { error } = await supabase
    .from("bot_match_tickets")
    .update({
      message_id: messageId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) {
    console.error("Failed to update message_id:", error);
  }
}

export async function clearTicketMessageId(ticketId: string): Promise<boolean> {
  const { error } = await supabase
    .from("bot_match_tickets")
    .update({
      message_id: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) {
    console.error("Failed to clear message_id:", error);
    return false;
  }

  return true;
}

export async function addAcceptance(input: {
  ticketId: string;
  discordId: string;
  acceptanceType: AcceptanceType;
}): Promise<boolean> {
  return runTicketMutation('bot_join_ticket', {
    p_ticket_id: input.ticketId, p_discord_id: input.discordId, p_acceptance_type: input.acceptanceType,
  });
}

export async function startTicketGame(ticketId: string, startedMode: GameModeId): Promise<boolean> {
  const mode = getGameMode(startedMode);
  if (!mode) return false;
  return runTicketMutation('bot_start_ticket', {
    p_ticket_id: ticketId, p_mode: startedMode,
    p_lobby_code: mode.usesLobbyCode ? generateLobbyCode() : null,
    p_game_seed: mode.usesGameSeed ? generateGameSeed() : null,
  });
}

export async function setRandomizedTeams(
  ticketId: string,
  randomizedTeams: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("bot_match_tickets")
    .update({
      randomized_teams: randomizedTeams,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId)
    .eq("status", "started")
    .is("randomized_teams", null)
    .select("id")
    .maybeSingle();

  if (error) {
    console.error("Failed to save randomized teams:", error);
    return false;
  }

  return Boolean(data);
}

async function runTicketMutation(name: string, args: Record<string, unknown>): Promise<boolean> {
  const { data, error } = await supabase.rpc(name, args);
  if (error) {
    console.error(`Ticket operation ${name} failed:`, error);
    return false;
  }
  return data === true;
}

export async function closeTicket(
  ticket: MatchTicket,
  newStatus: 'finished' | 'cancelled'
): Promise<boolean> {
  if (!['finished', 'cancelled'].includes(newStatus)) return false;
  return runTicketMutation('bot_close_ticket', { p_ticket_id: ticket.id, p_status: newStatus });
}

export async function findActiveOwnedTicket(
  discordId: string
): Promise<MatchTicket | null> {
  const { data, error } = await supabase
    .from("bot_match_tickets")
    .select("*")
    .eq("creator_discord_id", discordId)
    .in("status", activeStatuses)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to find active owned ticket:", error);
    return null;
  }

  return data as MatchTicket | null;
}

export async function findActiveAcceptedTicket(
  discordId: string
): Promise<MatchTicket | null> {
  const { data: acceptances, error: acceptanceError } = await supabase
    .from("bot_match_ticket_acceptances")
    .select("ticket_id")
    .eq("discord_id", discordId);

  if (acceptanceError) {
    console.error("Failed to find accepted ticket rows:", acceptanceError);
    return null;
  }

  const ticketIds = acceptances?.map((row) => row.ticket_id) ?? [];

  if (ticketIds.length === 0) {
    return null;
  }

  const { data: ticket, error: ticketError } = await supabase
    .from("bot_match_tickets")
    .select("*")
    .in("id", ticketIds)
    .in("status", activeStatuses)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (ticketError) {
    console.error("Failed to find active accepted ticket:", ticketError);
    return null;
  }

  return ticket as MatchTicket | null;
}

export async function findActiveTicketForUser(discordId: string): Promise<{
  ticket: MatchTicket | null;
  role: "host" | "accepted" | null;
}> {
  const ownedTicket = await findActiveOwnedTicket(discordId);

  if (ownedTicket) {
    return {
      ticket: ownedTicket,
      role: "host",
    };
  }

  const acceptedTicket = await findActiveAcceptedTicket(discordId);

  if (acceptedTicket) {
    return {
      ticket: acceptedTicket,
      role: "accepted",
    };
  }

  return {
    ticket: null,
    role: null,
  };
}

export async function leaveAcceptedTicket(discordId: string): Promise<{
  success: boolean; ticket: MatchTicket | null;
}> {
  const ticket = await findActiveAcceptedTicket(discordId);
  if (!ticket) return { success: false, ticket: null };
  return { success: await leaveSpecificTicket(ticket.id, discordId), ticket };
}

export async function getStartedTicketsPastLimit(
  hours = 2
): Promise<MatchTicket[]> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("bot_match_tickets")
    .select("*")
    .eq("status", "started")
    .not("started_at", "is", null)
    .lte("started_at", cutoff);

  if (error) {
    console.error("Failed to get started tickets past limit:", error);
    return [];
  }

  return data as MatchTicket[];
}

export async function getExpiredOpenTickets(): Promise<MatchTicket[]> {
  const { data, error } = await supabase
    .from("bot_match_tickets")
    .select("*")
    .eq("status", "open")
    .not("expires_at", "is", null)
    .lte("expires_at", new Date().toISOString());

  if (error) {
    console.error("Failed to get expired tickets:", error);
    return [];
  }

  return data as MatchTicket[];
}

export async function getExpiredTicketsReadyToDelete(): Promise<MatchTicket[]> {
  const deleteBefore = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("bot_match_tickets")
    .select("*")
    .eq("status", "expired")
    .not("message_id", "is", null)
    .lte("updated_at", deleteBefore);

  if (error) {
    console.error("Failed to get expired tickets ready to delete:", error);
    return [];
  }

  return data as MatchTicket[];
}

export async function expireTicket(ticketId: string): Promise<boolean> {
  return runTicketMutation('bot_close_ticket', { p_ticket_id: ticketId, p_status: 'expired' });
}

export async function leaveSpecificTicket(ticketId: string, discordId: string): Promise<boolean> {
  return runTicketMutation('bot_leave_ticket', { p_ticket_id: ticketId, p_discord_id: discordId });
}

export async function getRecentMatches(limit = 10): Promise<MatchRecord[]> {
  const { data, error } = await supabase
    .from("bot_matches")
    .select("*")
    .eq("status", "finished")
    .order("finished_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to get recent matches:", error);
    return [];
  }

  return data as MatchRecord[];
}

export async function forceSetTicketStatus(
  ticketId: string,
  status: 'finished' | 'cancelled' | 'expired'
): Promise<boolean> {
  if (!['finished', 'cancelled', 'expired'].includes(status)) return false;
  return runTicketMutation('bot_close_ticket', { p_ticket_id: ticketId, p_status: status });
}

export async function getOpenMatchTickets(): Promise<MatchTicket[]> {
  const { data, error } = await supabase
    .from("bot_match_tickets")
    .select("*")
    .in("status", ["open", "started"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to get open match tickets:", error);
    return [];
  }

  return data as MatchTicket[];
}
