import { screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createMockApi, deferred, json, makeProduct } from "../../test/mockApi";
import { renderApp } from "../../test/renderApp";

async function fillValid(user: ReturnType<typeof renderApp>["user"]) {
  await screen.findByRole("option", { name: "Kitchen" });
  await user.type(screen.getByLabelText("Name"), "  Coffee Mug  ");
  await user.type(screen.getByLabelText(/Price/), "24.5");
  await user.type(screen.getByLabelText("Stock"), "40");
  await user.selectOptions(screen.getByLabelText("Category"), "Kitchen");
}

describe("create product", () => {
  it("validates on the client without calling the API", async () => {
    const api = createMockApi().install();
    const { user } = renderApp("/products/new");
    await screen.findByRole("option", { name: "Kitchen" });

    await user.type(screen.getByLabelText("Name"), "   ");
    await user.type(screen.getByLabelText(/Price/), "0");
    await user.type(screen.getByLabelText("Stock"), "1.5");
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByText("Enter a product name.")).toBeInTheDocument();
    expect(screen.getByText("Price must be greater than zero.")).toBeInTheDocument();
    expect(screen.getByText("Stock must be a whole number.")).toBeInTheDocument();
    expect(screen.getByText("Choose a category.")).toBeInTheDocument();
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");

    await user.clear(screen.getByLabelText(/Price/));
    await user.type(screen.getByLabelText(/Price/), "1.999");
    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "-3");
    await user.type(screen.getByLabelText("Name"), "x".repeat(201));
    await user.click(screen.getByRole("button", { name: "Create product" }));
    expect(await screen.findByText("Use no more than two decimal places.")).toBeInTheDocument();
    expect(screen.getByText("Stock cannot be negative.")).toBeInTheDocument();
    expect(screen.getByText("Name must be 200 characters or fewer.")).toBeInTheDocument();

    await user.clear(screen.getByLabelText(/Price/));
    await user.type(screen.getByLabelText(/Price/), "123456789");
    await user.click(screen.getByRole("button", { name: "Create product" }));
    expect(await screen.findByText("Price must be less than 100,000,000.")).toBeInTheDocument();

    expect(api.requests.some((r) => r.method === "POST" && r.path === "/api/products/")).toBe(false);
  });

  it("sends a decimal-string price and integer stock/category, then shows success", async () => {
    const api = createMockApi().install();
    const { user, location } = renderApp("/products/new");
    await fillValid(user);
    await user.click(screen.getByLabelText("Active")); // uncheck
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByText('"Coffee Mug" was created.')).toBeInTheDocument();
    expect(location()).toBe("/products");
    const post = api.requests.find((r) => r.method === "POST" && r.path === "/api/products/")!;
    expect(post.body).toEqual({ name: "Coffee Mug", price: "24.5", stock: 40, category: 3, is_active: false });
    expect(await screen.findByText("Coffee Mug")).toBeInTheDocument();
  });

  it("disables repeat submission and shows a pending label", async () => {
    const api = createMockApi().install();
    const gate = deferred();
    api.on("POST", /^\/api\/products\/$/, async () => {
      await gate.promise;
      return undefined;
    });
    const { user } = renderApp("/products/new");
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    const pending = await screen.findByRole("button", { name: "Creating…" });
    expect(pending).toBeDisabled();
    await user.click(pending);
    gate.resolve();
    await screen.findByText('"Coffee Mug" was created.');
    expect(api.requests.filter((r) => r.method === "POST" && r.path === "/api/products/")).toHaveLength(1);
  });

  it("maps backend field errors to inputs and keeps entered values", async () => {
    const api = createMockApi().install();
    api.on("POST", /^\/api\/products\/$/, () =>
      json({ name: ["Ensure this field has no more than 200 characters."], category: ['Invalid pk "3" - object does not exist.'] }, 400),
    );
    const { user } = renderApp("/products/new");
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Create product" }));

    expect(await screen.findByText("Ensure this field has no more than 200 characters.")).toBeInTheDocument();
    expect(screen.getByText('Invalid pk "3" - object does not exist.')).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Please correct the highlighted fields.");
    expect(screen.getByLabelText("Name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Name")).toHaveValue("  Coffee Mug  ");
    expect(screen.getByLabelText(/Price/)).toHaveValue("24.5");
    expect(screen.getByLabelText("Stock")).toHaveValue("40");
    expect(screen.getByRole("button", { name: "Create product" })).toBeEnabled();
  });

  it("shows general request errors above the form", async () => {
    const api = createMockApi().install();
    api.on("POST", /^\/api\/products\/$/, () => Promise.reject(new TypeError("Failed to fetch")));
    const { user } = renderApp("/products/new");
    await fillValid(user);
    await user.click(screen.getByRole("button", { name: "Create product" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't reach the server.");
    expect(screen.getByLabelText("Name")).toHaveValue("  Coffee Mug  ");
  });

  it("blocks submission with a retry when categories fail to load", async () => {
    const api = createMockApi().install();
    api.on("GET", /^\/api\/categories\//, () => json({ detail: "error" }, 500), { once: true });
    const { user } = renderApp("/products/new");

    expect(await screen.findByText(/Categories couldn't be loaded/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create product" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByRole("option", { name: "Kitchen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Create product" })).toBeEnabled();
  });
});

describe("edit product", () => {
  it("loads through the detail endpoint on direct navigation and saves", async () => {
    const api = createMockApi({ products: [makeProduct(7, { name: "Lamp", price: "19.90", stock: 3 })] }).install();
    const { user, location, queryClient } = renderApp("/products/7/edit");

    expect(await screen.findByRole("status", { name: "Loading product" })).toBeInTheDocument();
    expect(await screen.findByDisplayValue("Lamp")).toBeInTheDocument();
    expect(api.requests.some((r) => r.path === "/api/products/7/" && r.method === "GET")).toBe(true);
    await waitFor(() => expect(screen.getByLabelText("Category")).toHaveValue("1"));
    expect(screen.getByLabelText(/Price/)).toHaveValue("19.90");

    await user.clear(screen.getByLabelText("Stock"));
    await user.type(screen.getByLabelText("Stock"), "0");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    expect(await screen.findByText('"Lamp" was updated.')).toBeInTheDocument();
    expect(location()).toBe("/products");
    const put = api.requests.find((r) => r.method === "PUT")!;
    expect(put.body).toEqual({ name: "Lamp", price: "19.90", stock: 0, category: 1, is_active: true });
    expect(queryClient.getQueryData(["product", 7])).toMatchObject({ stock: 0 });
  });

  it("shows a missing-product state for a 404", async () => {
    createMockApi().install();
    renderApp("/products/999/edit");
    expect(await screen.findByText("Product not found")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to products" })).toHaveAttribute("href", "/products");
  });

  it("shows a load failure with retry", async () => {
    const api = createMockApi({ products: [makeProduct(7, { name: "Lamp" })] }).install();
    api.on("GET", /^\/api\/products\/7\//, () => json({ detail: "boom" }, 500), { once: true });
    const { user } = renderApp("/products/7/edit");
    expect(await screen.findByText("Couldn't load this product")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByDisplayValue("Lamp")).toBeInTheDocument();
  });

  it("returns to the filtered list it came from", async () => {
    createMockApi({ products: [makeProduct(7, { name: "Lamp", category: 3 })] }).install();
    const { user, location } = renderApp("/products?category=3");
    await user.click(await screen.findByRole("link", { name: "Edit Lamp" }));
    await screen.findByDisplayValue("Lamp");
    await user.click(screen.getByRole("button", { name: "Save changes" }));
    await screen.findByText('"Lamp" was updated.');
    expect(location()).toBe("/products?category=3");
  });
});
