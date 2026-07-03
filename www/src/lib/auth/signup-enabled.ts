import { useQuery } from "@tanstack/react-query";

import { getSignupEnabled } from "@/lib/api/auth-config";

export function useSignupEnabled() {
  const { data, isPending } = useQuery({
    queryKey: ["auth", "signup-enabled"],
    queryFn: getSignupEnabled,
  });

  return {
    isPending,
    signUpEnabled: import.meta.env.DEV || (data?.signUpEnabled ?? false),
  };
}
