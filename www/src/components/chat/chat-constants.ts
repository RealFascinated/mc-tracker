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

export const DEFAULT_SUGGESTIONS = [
  "Players online right now",
  "Java vs Bedrock split",
  "Network trend (7d)",
  "Network trend (30d)",
  "Top servers by players now",
  "7-day growth leaders",
  "30-day biggest decliners",
  "Gainers this month",
  "Highest peak this week",
  "All-time peak leaders",
  "Servers near 24h peak",
  "Compare top 4 servers (7d)",
  "Providers by total players",
  "Top provider growth (30d)",
  "Provider declines (7d)",
] as const;

export const SERVER_SUGGESTION_TEMPLATES = [
  (name: string) => `Stats for ${name}`,
  (name: string) => `Tell me about ${name}`,
  (name: string) => `Is ${name} growing?`,
  (name: string) => `${name} 7-day trend`,
  (name: string) => `${name} 30-day trend`,
  (name: string) => `Compare ${name} to top 4`,
  (name: string) => `Compare ${name} over 30 days`,
  (name: string) => `How busy is ${name} now?`,
  (name: string) => `${name} all-time peak`,
  (name: string) => `Where is ${name} hosted?`,
  (name: string) => `${name} hosting & ASN`,
  (name: string) => `Is ${name} near its peak?`,
  (name: string) => `Provider trend for ${name}`,
  (name: string) => `${name} vs network trend`,
  (name: string) => `${name} peak vs current`,
] as const;

export function serverSuggestions(serverName: string): string[] {
  return SERVER_SUGGESTION_TEMPLATES.map((template) => template(serverName));
}

export function pickRotatingSuggestions(
  pool: readonly string[],
  count: number,
  offset: number,
): string[] {
  if (pool.length === 0 || count <= 0) {
    return [];
  }
  const limit = Math.min(count, pool.length);
  return Array.from({ length: limit }, (_, i) => pool[(offset + i) % pool.length]);
}
