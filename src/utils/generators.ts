export function generateLobbyCode(length = 5): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let code = "";

  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }

  return code;
}

export function generateGameSeed(): number {
  const digitLength = Math.floor(Math.random() * 3) + 7;
  const min = Math.pow(10, digitLength - 1);
  const max = Math.pow(10, digitLength) - 1;

  return Math.floor(Math.random() * (max - min + 1)) + min;
}