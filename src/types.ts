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
  hostIsPlayer?: boolean;
  modes?: string[];
  searchMinutes?: number | null;

  scheduledAt?: string | null;
  scheduledTimezone?: string | null;

  matchTitle?: string | null;
  matchDetails?: string | null;
};

export type MatchTicket = {
  id: string;
  guild_id: string;
  channel_id: string;
  message_id: string | null;

  matchmaking_type: MatchmakingType;
  creator_discord_id: string;

  host_is_player: boolean;
  scheduled_at: string | null;
  scheduled_timezone: string | null;

  match_title: string | null;
  match_details: string | null;
  started_mode: string | null;

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

export type MatchRecord = {
  id: string;
  ticket_id: string | null;
  guild_id: string;

  matchmaking_type: MatchmakingType;
  started_mode: string | null;

  player1_discord_id: string;
  player2_discord_id: string | null;
  ref_discord_id: string | null;

  veilbreak: boolean;
  base_game: boolean;
  scadubingo: boolean;

  status: string;

  created_at: string;
  finished_at: string | null;
};