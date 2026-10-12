import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router";

import { AppRoutes } from "../App";
import { AuthProvider } from "../features/auth/AuthProvider";
import { ApiError } from "../lib/api";
import { tokenStore } from "../lib/tokenStore";
import { VALID_TOKEN } from "./mockApi";

let currentLocation = "";
function LocationProbe() {
  const location = useLocation();
  currentLocation = `${location.pathname}${location.search}`;
  return null;
}

interface RenderOptions {
  /** Start with a stored token (default true). */
  signedIn?: boolean;
  token?: string;
}

export function renderApp(path: string, { signedIn = true, token = VALID_TOKEN }: RenderOptions = {}) {
  if (signedIn) tokenStore.set(token);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, error) => !(error instanceof ApiError) && count < 1,
        retryDelay: 0,
        staleTime: 30_000,
        refetchOnWindowFocus: false,
      },
      mutations: { retry: false },
    },
  });
  const user = userEvent.setup();
  const utils = render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <AuthProvider>
          <AppRoutes />
          <LocationProbe />
        </AuthProvider>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { ...utils, user, queryClient, location: () => currentLocation };
}
