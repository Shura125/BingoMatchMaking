export type MatchmakingType = "casual" | "competitive";
export type AcceptanceType = "player" | "ref";

export type TicketStatus =
  | "open"
  | "started"
  | "finished"
  | "wasnt_played"
  | "cancelled"
  | "expired";

export type PendingSession = {
  matchmakingType?: MatchmakingType;
  modes?: string[];
  searchMinutes?: number | null;
};

export type MatchTicket = {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;

  matchmaking_type: MatchmakingType;
  creator_discord_id: string;

  veilbreak: boolean;
  base_game: boolean;
  scadubingo: boolean;

  search_minutes: number | null;
  expires_at: string | null;

  status: TicketStatus;

  lobby_code: string | null;
  game_seed: number | null;
  started_at: string | null;

  created_at: string;
  updated_at: string;
};

export type MatchTicketAcceptance = {
  id: string;
  ticket_id: string;
  discord_id: string;
  acceptance_type: AcceptanceType;
  created_at: string;
};