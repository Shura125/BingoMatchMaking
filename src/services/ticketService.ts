import { supabase } from "../supabase";
import {
  AcceptanceType,
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
  modes: string[];
  searchMinutes: number | null | undefined;
}): Promise<MatchTicket | null> {
  const expiresAt =
    input.searchMinutes && input.searchMinutes > 0
      ? new Date(Date.now() + input.searchMinutes * 60 * 1000).toISOString()
      : null;

  const { data, error } = await supabase
    .from("match_tickets")
    .insert({
      guild_id: input.guildId,
      channel_id: input.channelId,
      creator_discord_id: input.creatorDiscordId,

      matchmaking_type: input.matchmakingType,

      veilbreak: input.modes.includes("veilbreak"),
      base_game: input.modes.includes("base_game"),
      scadubingo: input.modes.includes("scadubingo"),

      search_minutes: input.searchMinutes,
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

export async function startTicketGame(ticketId: string): Promise<boolean> {
  const { error } = await supabase
    .from("match_tickets")
    .update({
      status: "started",
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

  if (newStatus === "finished") {
    const acceptances = await getAcceptances(ticket.id);

    const firstPlayer = acceptances.find(
      (acceptance) => acceptance.acceptance_type === "player"
    );

    const firstRef = acceptances.find(
      (acceptance) => acceptance.acceptance_type === "ref"
    );

    const { error: matchError } = await supabase.from("matches").insert({
      ticket_id: ticket.id,
      guild_id: ticket.guild_id,

      matchmaking_type: ticket.matchmaking_type,

      player1_discord_id: ticket.creator_discord_id,
      player2_discord_id: firstPlayer?.discord_id ?? null,
      ref_discord_id: firstRef?.discord_id ?? null,

      veilbreak: ticket.veilbreak,
      base_game: ticket.base_game,
      scadubingo: ticket.scadubingo,

      status: "finished",
      finished_at: new Date().toISOString(),
    });

    if (matchError) {
      console.error("Ticket was closed, but match insert failed:", matchError);
    }
  }

  return true;
}