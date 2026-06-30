export type UserRole = "admin" | "user";

export type User = {
  username: string;
  role: UserRole;
};

export type Credentials = {
  username: string;
  password: string;
};

export type LoginResponse = User;

export type MeResponse = User;
