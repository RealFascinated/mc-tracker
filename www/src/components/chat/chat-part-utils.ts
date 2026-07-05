import type { ChatMessage, ChatPart } from "@/components/chat/chat-types";

export function assistantTextFromParts(parts: ChatPart[]): string {
  return parts
    .filter(
      (part): part is Extract<ChatPart, { kind: "text" }> =>
        part.kind === "text",
    )
    .map((part) => part.content)
    .join("");
}

export function finalizeParts(parts: ChatPart[]): ChatPart[] {
  return parts.map((part) =>
    part.kind === "reasoning" || part.kind === "text"
      ? { ...part, streaming: false }
      : part,
  );
}

function lastToolIndex(parts: ChatPart[]): number {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    if (parts[index].kind === "tool") {
      return index;
    }
  }
  return -1;
}

export function visibleAssistantParts(parts: ChatPart[]): ChatPart[] {
  const lastTool = lastToolIndex(parts);
  let reasoningIndex = -1;
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (part.kind !== "reasoning") {
      continue;
    }
    if (lastTool === -1 || index > lastTool) {
      reasoningIndex = index;
      break;
    }
  }
  return parts.filter(
    (part, index) => part.kind !== "reasoning" || index === reasoningIndex,
  );
}

export function appendReasoningDelta(
  parts: ChatPart[],
  content: string,
): ChatPart[] {
  const last = parts.at(-1);
  if (last?.kind === "reasoning" && last.streaming) {
    return [
      ...parts.slice(0, -1),
      { ...last, content: last.content + content },
    ];
  }
  const base = parts.some((part) => part.kind === "tool")
    ? parts.filter((part) => part.kind !== "reasoning")
    : parts;
  return [
    ...base,
    {
      id: crypto.randomUUID(),
      kind: "reasoning",
      content,
      streaming: true,
    },
  ];
}

export function appendToolStart(parts: ChatPart[], name: string): ChatPart[] {
  return [
    ...parts,
    {
      id: crypto.randomUUID(),
      kind: "tool",
      name,
      status: "running",
    },
  ];
}

export function markToolDone(parts: ChatPart[], name: string): ChatPart[] {
  for (let index = parts.length - 1; index >= 0; index -= 1) {
    const part = parts[index];
    if (
      part.kind === "tool" &&
      part.status === "running" &&
      part.name === name
    ) {
      return [
        ...parts.slice(0, index),
        { ...part, status: "done" },
        ...parts.slice(index + 1),
      ];
    }
  }
  return parts;
}

export function appendTextDelta(
  parts: ChatPart[],
  content: string,
): ChatPart[] {
  const closed = parts.map((part) =>
    part.kind === "reasoning" && part.streaming
      ? { ...part, streaming: false }
      : part,
  );
  const last = closed.at(-1);
  if (last?.kind === "text" && last.streaming) {
    return [
      ...closed.slice(0, -1),
      { ...last, content: last.content + content },
    ];
  }
  return [
    ...closed,
    {
      id: crypto.randomUUID(),
      kind: "text",
      content,
      streaming: true,
    },
  ];
}

export function assistantHasVisibleContent(message: ChatMessage): boolean {
  if (message.content.trim().length > 0) {
    return true;
  }
  const parts = message.parts ?? [];
  return (
    parts.some(
      (part) =>
        (part.kind === "text" || part.kind === "reasoning") &&
        part.content.trim().length > 0,
    ) || parts.some((part) => part.kind === "tool")
  );
}

export function turnsToAssistantParts(
  content: string,
  toolNames?: string[],
): ChatPart[] {
  const parts: ChatPart[] = [];
  for (const name of toolNames ?? []) {
    parts.push({
      id: crypto.randomUUID(),
      kind: "tool",
      name,
      status: "done",
    });
  }
  if (content.trim().length > 0) {
    parts.push({
      id: crypto.randomUUID(),
      kind: "text",
      content,
    });
  }
  return parts;
}
