export const STREAMING_ID = "streaming";

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolCalls?: string[];
};
