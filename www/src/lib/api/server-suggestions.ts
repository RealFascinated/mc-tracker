import { apiFetch } from "@/lib/api/client";

export type SuggestionAuthor = {
  id: string;
  name: string;
};

export type ServerSuggestion = {
  id: string;
  name: string;
  host: string;
  port: number | null;
  type: string;
  status: "pending" | "approved" | "denied";
  suggestedBy: SuggestionAuthor | null;
  createdAt: string;
  updatedAt: string;
};

export type ServerSuggestionsListResponse = {
  suggestions: ServerSuggestion[];
};

export type CreateServerSuggestionRequest = {
  name: string;
  host: string;
  port?: number | null;
  type: string;
};

export type ApproveServerSuggestionRequest =
  Partial<CreateServerSuggestionRequest>;

export function submitServerSuggestion(body: CreateServerSuggestionRequest) {
  return apiFetch<ServerSuggestion>("/server-suggestions", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function getMyServerSuggestions() {
  return apiFetch<ServerSuggestionsListResponse>("/server-suggestions/mine");
}

export function getAdminServerSuggestions(status: "pending" | "denied") {
  return apiFetch<ServerSuggestionsListResponse>(
    `/admin/server-suggestions?status=${status}`,
  );
}

export function approveServerSuggestion(
  id: string,
  body: ApproveServerSuggestionRequest,
) {
  return apiFetch<ServerSuggestion>(`/admin/server-suggestions/${id}/approve`, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function denyServerSuggestion(id: string) {
  return apiFetch<ServerSuggestion>(`/admin/server-suggestions/${id}/deny`, {
    method: "POST",
  });
}

export function deleteServerSuggestion(id: string) {
  return apiFetch<void>(`/admin/server-suggestions/${id}`, {
    method: "DELETE",
  });
}
