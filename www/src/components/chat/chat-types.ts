export const STREAMING_ID = "streaming";

export type ChatReasoningPart = {
  id: string;
  kind: "reasoning";
  content: string;
  streaming?: boolean;
};

export type ChatToolPart = {
  id: string;
  kind: "tool";
  name: string;
  status: "running" | "done";
};

export type ChatTextPart = {
  id: string;
  kind: "text";
  content: string;
  streaming?: boolean;
};

export type ChatPart = ChatReasoningPart | ChatToolPart | ChatTextPart;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant" | "error";
  content: string;
  parts?: ChatPart[];
  /** User prompt to resend when this is a failed assistant turn. */
  retryPrompt?: string;
};
