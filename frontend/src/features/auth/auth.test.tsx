import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { tokenStore } from "../../lib/tokenStore";
import { createMockApi, deferred, json, VALID_TOKEN } from "../../test/mockApi";
import { renderApp } from "../../test/renderApp";

describe("login", () => {
  it("signs in, stores the token and opens the inventory", async () => {
    const api = createMockApi().install();
    const { user, location } = renderApp("/login", { signedIn: false });

    await user.type(screen.getByLabelText("Username"), "demo");
    await user.type(screen.getByLabelText("Password"), "demo-pass-2026");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("heading", { name: "Products" })).toBeInTheDocument();
    expect(location()).toBe("/products");
    expect(sessionStorage.getItem("inventory.authToken")).toBe(VALID_TOKEN);
    const login = api.requests.find((r) => r.path === "/api/auth/login/")!;
    expect(login.body).toEqual({ username: "demo", password: "demo-pass-2026" });
    expect(login.auth).toBeNull();
    // Protected requests carry the token.
    await waitFor(() => expect(api.listRequests()[0]?.auth).toBe(`Token ${VALID_TOKEN}`));
  });

  it("shows a generic message for invalid credentials", async () => {
    createMockApi().install();
    const { user } = renderApp("/login", { signedIn: false });

    await user.type(screen.getByLabelText("Username"), "demo");
    await user.type(screen.getByLabelText("Password"), "wrong");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Incorrect username or password.");
    expect(screen.queryByText(/non_field_errors|Unable to log in/)).not.toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });

  it("validates empty fields without calling the API", async () => {
    const api = createMockApi().install();
    const { user } = renderApp("/login", { signedIn: false });
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByText("Enter your username.")).toBeInTheDocument();
    expect(screen.getByText("Enter your password.")).toBeInTheDocument();
    expect(api.requests).toHaveLength(0);
  });

  it("explains throttling", async () => {
    const api = createMockApi().install();
    api.on("POST", /login/, () => json({ detail: "Request was throttled." }, 429));
    const { user } = renderApp("/login", { signedIn: false });
    await user.type(screen.getByLabelText("Username"), "demo");
    await user.type(screen.getByLabelText("Password"), "x");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Too many sign-in attempts/);
  });
});

describe("protected routes", () => {
  it("redirects anonymous users to /login and back after signing in", async () => {
    createMockApi().install();
    const { user, location } = renderApp("/products?category=3", { signedIn: false });
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(location()).toBe("/login");

    await user.type(screen.getByLabelText("Username"), "demo");
    await user.type(screen.getByLabelText("Password"), "demo-pass-2026");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    await screen.findByRole("heading", { name: "Products" });
    expect(location()).toBe("/products?category=3");
  });

  it("root redirects based on authentication", async () => {
    createMockApi().install();
    const { location } = renderApp("/", { signedIn: false });
    await screen.findByRole("heading", { name: "Sign in" });
    expect(location()).toBe("/login");
  });

  it("verifies a stored token before showing protected content", async () => {
    const api = createMockApi().install();
    const me = deferred();
    api.on("GET", /\/api\/auth\/me\//, async () => {
      await me.promise;
      return undefined;
    });
    const { location } = renderApp("/");

    expect(screen.getByText("Checking your session…")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Products" })).not.toBeInTheDocument();
    expect(api.listRequests()).toHaveLength(0);

    me.resolve();
    expect(await screen.findByRole("heading", { name: "Products" })).toBeInTheDocument();
    expect(location()).toBe("/products");
    expect(screen.getByText("demo")).toBeInTheDocument();
  });

  it("discards an invalid stored token", async () => {
    const api = createMockApi().install();
    renderApp("/products", { token: "expired" });
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
    expect(api.listRequests()).toHaveLength(0);
  });

  it("offers a retry when the session cannot be verified", async () => {
    const api = createMockApi().install();
    api.on("GET", /\/api\/auth\/me\//, () => Promise.reject(new TypeError("Failed to fetch")), { once: true });
    const { user } = renderApp("/products");
    expect(await screen.findByText("Can't reach the server")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("heading", { name: "Products" })).toBeInTheDocument();
  });

  it("on a 401 from a protected request, clears auth and cache and returns to login", async () => {
    const api = createMockApi().install();
    const { user, queryClient, location } = renderApp("/products");
    await screen.findByText("Product 3");
    expect(queryClient.getQueryCache().getAll().length).toBeGreaterThan(0);

    api.db.tokens.clear(); // token revoked server-side
    await user.click(screen.getByRole("link", { name: "Edit Product 3" }));

    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText("Your session has ended. Please sign in again.")).toBeInTheDocument();
    expect(location()).toBe("/login");
    expect(tokenStore.get()).toBeNull();
    expect(queryClient.getQueryCache().getAll().filter((q) => q.queryKey[0] !== "product")).toHaveLength(0);
  });
});

describe("logout", () => {
  it("revokes the token, clears local state and cache", async () => {
    const api = createMockApi().install();
    const { user, queryClient } = renderApp("/products");
    await screen.findByText("Product 1");

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(api.requests.some((r) => r.method === "POST" && r.path === "/api/auth/logout/")).toBe(true);
    expect(api.db.tokens.size).toBe(0);
    expect(tokenStore.get()).toBeNull();
    expect(queryClient.getQueryCache().getAll()).toHaveLength(0);
  });

  it("still signs out locally when the server cannot be reached", async () => {
    const api = createMockApi().install();
    api.on("POST", /logout/, () => Promise.reject(new TypeError("Failed to fetch")));
    const { user } = renderApp("/products");
    await screen.findByText("Product 1");

    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("heading", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.getByText(/couldn't be reached|could not be reached/)).toBeInTheDocument();
    expect(tokenStore.get()).toBeNull();
  });
});

describe("not found", () => {
  it("shows a not-found screen for unknown routes", async () => {
    createMockApi().install();
    renderApp("/does-not-exist", { signedIn: false });
    expect(screen.getByRole("heading", { name: "Page not found", level: 2 })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to inventory" })).toHaveAttribute("href", "/");
  });
});
