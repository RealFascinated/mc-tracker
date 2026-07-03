export const DEFAULT_SUGGESTIONS = [
  "Rank servers by player count growth over the last 7 days",
  "Rank servers by biggest player count decline over the last 30 days",
  "Show total tracked player count trend over the last 30 days",
  "Which servers are at 90%+ of their recent peak player count right now?",
  "List hosting providers ranked by total players online",
  "Which server reached the highest player count in the last 7 days?",
] as const;

export const THINKING_MESSAGES = [
  "Thinking…",
  "Working on it…",
  "One moment…",
  "Still thinking…",
  "Putting it together…",
  "Almost there…",
  "Considering options…",
  "Formulating a response…",
  "Just a second…",
  "Bear with me…",
  "Processing…",
  "Taking a closer look…",
  "On it…",
  "Give me a moment…",
  "Hang tight…",
] as const;

export function serverSuggestions(serverName: string): string[] {
  return [
    `Give me stats about ${serverName}`,
    `Compare ${serverName}'s player trend to the top 4 servers this week`,
    `What hosting provider and ASN does ${serverName} use?`,
    `Is ${serverName}'s current player count near its 24h peak?`,
  ];
}
