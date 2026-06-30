import { apiFetch } from "@/lib/api/client";

export type SignupEnabledResponse = {
  signUpEnabled: boolean;
};

export function getSignupEnabled() {
  return apiFetch<SignupEnabledResponse>("/auth/signup-enabled", {
    credentials: "omit",
  });
}
