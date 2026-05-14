import { supabase } from "../supabase";
import {
  AcceptanceType,
  MatchRecord,
  MatchTicket,
  MatchTicketAcceptance,
  MatchmakingType,
  TicketStatus,
} from "../types";
import { generateGameSeed, generateLobbyCode } from "../utils/generators";

const activeStatuses: TicketStatus[] = ["open", "started"];

export async function userHasActiveTicketOrAcceptance(
  discordId: string
): Promise<boolean> {
  const { data: ownedTickets, error: ownedError } = await supabase
    .from("match_tickets")
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
    .from("match_ticket_acceptances")
    .select(
      `
      id,
      match_tickets!inner (
        id,
        status
      )
    `
    )
    .eq("discord_id", discordId)
    .in("match_tickets.status", activeStatuses)
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
    .from("match_tickets")
    .select("id")
    .eq("creator_discord_id", discordId)
    .eq("matchmaking_type", "casual")
    .eq("status", "open")
    .limit(1);

  if (ownedError) {
    console.error("Failed to check owned casual tickets:", ownedError);
    return true;
  }

  if (ownedTickets && ownedTickets.length > 0) {
    return true;
  }

  const { data: acceptedTickets, error: acceptedError } = await supabase
    .from("match_ticket_acceptances")
    .select(
      `
      id,
      match_tickets!inner (
        id,
        status,
        matchmaking_type
      )
      `
    )
    .eq("discord_id", discordId)
    .eq("match_tickets.matchmaking_type", "casual")
    .eq("match_tickets.status", "open")
    .limit(1);

  if (acceptedError) {
    console.error("Failed to check accepted casual tickets:", acceptedError);
    return true;
  }

  return !!acceptedTickets && acceptedTickets.length > 0;
}

export async function fetchTicket(ticketId: string): Promise<MatchTicket | null> {
  const { data, error } = await supabase
    .from("match_tickets")
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
    .from("match_ticket_acceptances")
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

  const { data, error } = await supabase
    .from("match_tickets")
    .insert({
      guild_id: input.guildId,
      channel_id: input.channelId,
      creator_discord_id: input.creatorDiscordId,

      matchmaking_type: input.matchmakingType,

      host_is_player: input.hostIsPlayer,
      scheduled_at: input.scheduledAt ?? null,
      scheduled_timezone: input.scheduledTimezone ?? null,

      match_title: input.matchTitle ?? null,
      match_details: input.matchDetails ?? null,

      veilbreak: input.modes.includes("veilbreak"),
      base_game: input.modes.includes("base_game"),
      scadubingo: input.modes.includes("scadubingo"),
      legacy_dungeons: input.modes.includes("legacy_dungeons"),

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
    .from("match_tickets")
    .update({
      message_id: messageId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) {
    console.error("Failed to update message_id:", error);
  }
}

export async function addAcceptance(input: {
  ticketId: string;
  discordId: string;
  acceptanceType: AcceptanceType;
}): Promise<boolean> {
  const { error } = await supabase.from("match_ticket_acceptances").insert({
    ticket_id: input.ticketId,
    discord_id: input.discordId,
    acceptance_type: input.acceptanceType,
  });

  if (error) {
    console.error("Failed to add acceptance:", error);
    return false;
  }

  return true;
}

export async function startTicketGame(
  ticketId: string,
  startedMode: string
): Promise<boolean> {
  const { error } = await supabase
    .from("match_tickets")
    .update({
      status: "started",
      started_mode: startedMode,
      lobby_code: generateLobbyCode(),
      game_seed: generateGameSeed(),
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId)
    .eq("status", "open");

  if (error) {
    console.error("Failed to start ticket:", error);
    return false;
  }

  return true;
}

export async function closeTicket(
  ticket: MatchTicket,
  newStatus: "finished" | "wasnt_played" | "cancelled"
): Promise<boolean> {
  const { error } = await supabase
    .from("match_tickets")
    .update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticket.id);

  if (error) {
    console.error("Failed to close ticket:", error);
    return false;
  }

  if (newStatus !== "finished") {
    return true;
  }

  const acceptances = await getAcceptances(ticket.id);

  const playerAcceptances = acceptances.filter(
    (acceptance) => acceptance.acceptance_type === "player"
  );

  const refAcceptances = acceptances.filter(
    (acceptance) => acceptance.acceptance_type === "ref"
  );

  const firstRef = refAcceptances[0];

  const player1DiscordId = ticket.host_is_player
    ? ticket.creator_discord_id
    : playerAcceptances[0]?.discord_id;

  const player2DiscordId = ticket.host_is_player
    ? playerAcceptances[0]?.discord_id ?? null
    : playerAcceptances[1]?.discord_id ?? null;

  if (!player1DiscordId) {
    console.error("Cannot create match because player1 is missing.");
    return true;
  }

  const { data: matchData, error: matchError } = await supabase
    .from("matches")
    .insert({
      ticket_id: ticket.id,
      guild_id: ticket.guild_id,

      matchmaking_type: ticket.matchmaking_type,
      started_mode: ticket.started_mode,

      player1_discord_id: player1DiscordId,
      player2_discord_id: player2DiscordId,
      ref_discord_id: firstRef?.discord_id ?? null,

      veilbreak: ticket.veilbreak,
      base_game: ticket.base_game,
      scadubingo: ticket.scadubingo,
      legacy_dungeons: ticket.legacy_dungeons,

      status: "finished",
      finished_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (matchError || !matchData) {
    console.error("Ticket was closed, but match insert failed:", matchError);
    return true;
  }

  const participantRows = [
    {
      match_id: matchData.id,
      discord_id: ticket.creator_discord_id,
      participant_role: ticket.host_is_player ? "host_player" : "host",
    },
    ...playerAcceptances.map((acceptance) => ({
      match_id: matchData.id,
      discord_id: acceptance.discord_id,
      participant_role: "player",
    })),
    ...refAcceptances.map((acceptance) => ({
      match_id: matchData.id,
      discord_id: acceptance.discord_id,
      participant_role: "ref",
    })),
  ];

  const { error: participantError } = await supabase
    .from("match_participants")
    .insert(participantRows);

  if (participantError) {
    console.error(
      "Match was created, but participants insert failed:",
      participantError
    );
  }

  return true;
}

export async function findActiveOwnedTicket(
  discordId: string
): Promise<MatchTicket | null> {
  const { data, error } = await supabase
    .from("match_tickets")
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
    .from("match_ticket_acceptances")
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
    .from("match_tickets")
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
  success: boolean;
  ticket: MatchTicket | null;
}> {
  const ticket = await findActiveAcceptedTicket(discordId);

  if (!ticket) {
    return {
      success: false,
      ticket: null,
    };
  }

  const { error } = await supabase
    .from("match_ticket_acceptances")
    .delete()
    .eq("ticket_id", ticket.id)
    .eq("discord_id", discordId);

  if (error) {
    console.error("Failed to leave accepted ticket:", error);
    return {
      success: false,
      ticket,
    };
  }

  return {
    success: true,
    ticket,
  };
}

export async function getStartedTicketsPastLimit(
  hours = 2
): Promise<MatchTicket[]> {
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from("match_tickets")
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
    .from("match_tickets")
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
    .from("match_tickets")
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
  const { error } = await supabase
    .from("match_tickets")
    .update({
      status: "expired",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId)
    .eq("status", "open");

  if (error) {
    console.error("Failed to expire ticket:", error);
    return false;
  }

  return true;
}

export async function leaveSpecificTicket(
  ticketId: string,
  discordId: string
): Promise<boolean> {
  const { error } = await supabase
    .from("match_ticket_acceptances")
    .delete()
    .eq("ticket_id", ticketId)
    .eq("discord_id", discordId);

  if (error) {
    console.error("Failed to leave ticket:", error);
    return false;
  }

  return true;
}

export async function getRecentMatches(limit = 10): Promise<MatchRecord[]> {
  const { data, error } = await supabase
    .from("matches")
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
  status: "finished" | "wasnt_played" | "cancelled" | "expired"
): Promise<boolean> {
  const { error } = await supabase
    .from("match_tickets")
    .update({
      status,
      updated_at: new Date().toISOString(),
    })
    .eq("id", ticketId);

  if (error) {
    console.error("Failed to force set ticket status:", error);
    return false;
  }

  return true;
}

export async function getOpenMatchTickets(): Promise<MatchTicket[]> {
  const { data, error } = await supabase
    .from("match_tickets")
    .select("*")
    .in("status", ["open", "started"])
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to get open match tickets:", error);
    return [];
  }

  return data as MatchTicket[];
}