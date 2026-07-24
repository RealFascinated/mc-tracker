export type UserRole = "admin" | "user";

export type ChatQuota = {
  used: number;
  limit: number;
  resetsAt: string;
};

export type User = {
  email: string;
  displayName: string | null;
  role: UserRole;
  flags: number;
  chatQuota?: ChatQuota | null;
};

export type Credentials = {
  username: string;
  password: string;
};

export type SignupCredentials = {
  email: string;
  password: string;
  displayName?: string;
};

export type LoginResponse = Pick<User, "email" | "displayName" | "role">;

export type MeResponse = User;
