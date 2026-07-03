export type UserRole = "admin" | "user";

export type ChatQuota = {
  used: number;
  limit: number;
  resetsAt: string;
};

export type User = {
  username: string;
  role: UserRole;
  flags: number;
  chatQuota?: ChatQuota | null;
};

export type Credentials = {
  username: string;
  password: string;
};

export type LoginResponse = User;

export type MeResponse = User;
