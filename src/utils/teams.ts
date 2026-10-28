import { getGameMode } from "../gameModes";

export function canRandomizeTeamRoster(players: readonly string[], modeId: string | null): boolean {
  const mode = getGameMode(modeId);
  return Boolean(
    mode?.supportsRandomTeams &&
    mode.allowedPlayerCounts.includes(players.length) &&
    new Set(players).size === players.length
  );
}

export function formatRandomizedTeams(players: readonly string[], modeId: string | null): string {
  if (!canRandomizeTeamRoster(players, modeId)) {
    throw new Error("The roster does not fit a supported team mode.");
  }
  const shuffled = [...players];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  const half = shuffled.length / 2;
  const teamOne = shuffled.slice(0, half);
  const teamTwo = shuffled.slice(half);
  return (
    `**${getGameMode(modeId)!.label} ${half}v${half}**\n\n` +
    `**Team 1**\n${teamOne.map((id) => `<@${id}>`).join("\n")}\n\n` +
    `**Team 2**\n${teamTwo.map((id) => `<@${id}>`).join("\n")}`
  );
}
