import { useQuery } from "@tanstack/react-query";

import {
  getPublicSettings,
  signUpEnabledFromSettings,
} from "@/lib/api/public-settings";

export function useSignupEnabled() {
  const { data, isPending } = useQuery({
    queryKey: ["settings", "public"],
    queryFn: getPublicSettings,
  });
  return {
    signUpEnabled: import.meta.env.DEV || signUpEnabledFromSettings(data),
    isPending,
  };
}
