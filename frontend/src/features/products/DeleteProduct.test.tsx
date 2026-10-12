import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createMockApi, deferred, json, makeProduct, makeProducts } from "../../test/mockApi";
import { renderApp } from "../../test/renderApp";

const deletes = (api: ReturnType<typeof createMockApi>) => api.requests.filter((r) => r.method === "DELETE");

describe("delete product", () => {
  it("names the product and makes no request when cancelled; focus returns", async () => {
    const api = createMockApi({ products: [makeProduct(1, { name: "Wireless Mouse" })] }).install();
    const { user } = renderApp("/products");
    const trigger = await screen.findByRole("button", { name: "Delete Wireless Mouse" });

    await user.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Delete product?" });
    expect(dialog).toHaveTextContent("Wireless Mouse will be permanently deleted. This can't be undone.");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();

    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deletes(api)).toHaveLength(0);
    expect(trigger).toHaveFocus();
  });

  it("deletes after confirmation, disables repeat confirmation and refreshes", async () => {
    const api = createMockApi({
      products: [makeProduct(1, { name: "Wireless Mouse" }), makeProduct(2, { name: "Keyboard" })],
    }).install();
    const gate = deferred();
    api.on("DELETE", /\/api\/products\/1\//, async () => {
      await gate.promise;
      return undefined;
    });
    const { user, queryClient } = renderApp("/products");
    await user.click(await screen.findByRole("button", { name: "Delete Wireless Mouse" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete product" }));

    const pending = within(dialog).getByRole("button", { name: "Deleting…" });
    expect(pending).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toBeDisabled();
    await user.click(pending);
    gate.resolve();

    expect(await screen.findByText('"Wireless Mouse" was deleted.')).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(deletes(api)).toHaveLength(1);
    await waitFor(() => expect(screen.queryByRole("cell", { name: "Wireless Mouse" })).not.toBeInTheDocument());
    expect(screen.getByText("1 product")).toBeInTheDocument();
    expect(queryClient.getQueryData(["product", 1])).toBeUndefined();
    expect(screen.getByRole("heading", { name: "Products" })).toHaveFocus();
  });

  it("keeps the dialog open with an error when deletion fails", async () => {
    const api = createMockApi({ products: [makeProduct(1, { name: "Wireless Mouse" })] }).install();
    api.on("DELETE", /\/api\/products\/1\//, () => json({ detail: "Server error" }, 500), { once: true });
    const { user } = renderApp("/products");
    await user.click(await screen.findByRole("button", { name: "Delete Wireless Mouse" }));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: "Delete product" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent("The product couldn't be deleted.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByRole("cell", { name: "Wireless Mouse" })).toBeInTheDocument();

    // Retry succeeds.
    await user.click(within(dialog).getByRole("button", { name: "Delete product" }));
    expect(await screen.findByText('"Wireless Mouse" was deleted.')).toBeInTheDocument();
  });

  it("moves to the previous page when the last item on a page is deleted", async () => {
    const api = createMockApi({ products: makeProducts(21) }).install();
    const { user, location } = renderApp("/products?page=3");
    // Page 3 holds only the oldest product.
    await user.click(await screen.findByRole("button", { name: "Delete Product 1" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete product" }));

    // While page 2 loads, never render an empty table.
    expect(screen.queryAllByRole("row").length === 1).toBe(false);
    await waitFor(() => expect(location()).toBe("/products?page=2"));
    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Delete Product 2" })).toBeEnabled();
    // Page 3 was never requested again after the delete.
    const afterDelete = api.requests.slice(api.requests.findIndex((r) => r.method === "DELETE"));
    expect(afterDelete.some((r) => r.method === "GET" && r.search.get("page") === "3")).toBe(false);
  });

  it("recovers from a page that no longer exists without confusing it with a missing product", async () => {
    createMockApi({ products: makeProducts(12) }).install();
    const { location } = renderApp("/products?page=5");
    // While page 2 loads, never render an empty table.
    expect(screen.queryAllByRole("row").length === 1).toBe(false);
    await waitFor(() => expect(location()).toBe("/products?page=2"));
    expect(await screen.findByText("Page 2 of 2")).toBeInTheDocument();
    expect(screen.queryByText("Product not found")).not.toBeInTheDocument();
  });

  it("reports a product already deleted elsewhere", async () => {
    const api = createMockApi({ products: [makeProduct(1, { name: "Wireless Mouse" }), makeProduct(2)] }).install();
    const { user } = renderApp("/products");
    await user.click(await screen.findByRole("button", { name: "Delete Wireless Mouse" }));
    api.db.products = api.db.products.filter((p) => p.id !== 1);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete product" }));
    expect(await within(screen.getByRole("dialog")).findByRole("alert")).toHaveTextContent("no longer exists");
  });
});
