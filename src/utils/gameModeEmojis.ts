import { GAME_MODES, type GameModeConfig, type GameModeId } from "../gameModes";

export type GameModeEmojis = Partial<Record<GameModeId, string>>;

export function getGameModeEmojis(
  modes: readonly Pick<GameModeConfig, "id" | "emoji">[] = GAME_MODES
): GameModeEmojis {
  const emojis: GameModeEmojis = {};
  for (const mode of modes) {
    const value = mode.emoji?.trim();
    if (!value) continue;
    if (!/^<a?:[A-Za-z0-9_]{1,32}:\d{17,20}>$/.test(value)) {
      throw new Error(`The emoji for ${mode.id} in src/gameModes.ts must be a custom emoji code such as <:mode:123456789012345678> or <a:mode:123456789012345678>.`);
    }
    emojis[mode.id] = value;
  }
  return emojis;
}

export function prefixGameModeEmoji(mode: GameModeId, label: string, emojis: GameModeEmojis): string {
  return emojis[mode] ? `${emojis[mode]} ${label}` : label;
}
