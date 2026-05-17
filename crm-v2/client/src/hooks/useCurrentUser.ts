import { trpc } from "../lib/trpc.js";

export function useCurrentUser() {
  const { data: user, isLoading } = trpc.auth.me.useQuery(undefined, {
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  return { user: user ?? null, isLoading };
}
