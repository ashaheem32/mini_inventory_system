import { screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { formatPrice } from "../../lib/format";
import { createMockApi, deferred, json, makeProduct, makeProducts } from "../../test/mockApi";
import { renderApp } from "../../test/renderApp";
import { SEARCH_DEBOUNCE_MS } from "./ProductsPage";

const productNames = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("cell")[0].textContent);

describe("products list states", () => {
  it("shows a skeleton while loading, then rows with all columns", async () => {
    const api = createMockApi({
      products: [
        makeProduct(1, { name: "Wireless Mouse", price: "49.90", stock: 18 }),
        makeProduct(2, { name: "Old Webcam", is_active: false, stock: 0, category: 3 }),
      ],
    }).install();
    const gate = deferred();
    api.on("GET", /^\/api\/products\//, async () => {
      await gate.promise;
      return undefined;
    });
    renderApp("/products");

    expect(await screen.findByRole("status", { name: "Loading products" })).toBeInTheDocument();
    gate.resolve();

    const row = (await screen.findByText("Wireless Mouse")).closest("tr")!;
    expect(within(row).getByText("Electronics")).toBeInTheDocument();
    expect(within(row).getByText(formatPrice("49.90").replace(/\s/g, " "))).toBeInTheDocument();
    expect(within(row).getByText("18")).toBeInTheDocument();
    expect(within(row).getByText("Active")).toBeInTheDocument();
    expect(within(row).getByRole("link", { name: "Edit Wireless Mouse" })).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "Delete Wireless Mouse" })).toBeInTheDocument();

    const inactiveRow = screen.getByText("Old Webcam").closest("tr")!;
    expect(within(inactiveRow).getByText("Inactive")).toBeInTheDocument();
    expect(within(inactiveRow).getByText("Out of stock")).toBeInTheDocument();
    expect(screen.getByText("2 products")).toBeInTheDocument();
  });

  it("shows an error with retry when the request fails", async () => {
    const api = createMockApi().install();
    api.on("GET", /^\/api\/products\//, () => json({ detail: "boom" }, 500), { once: true });
    const { user } = renderApp("/products");

    expect(await screen.findByText("Couldn't load products")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Product 1")).toBeInTheDocument();
  });

  it("shows an empty inventory with an add-product action", async () => {
    createMockApi({ products: [] }).install();
    renderApp("/products");
    expect(await screen.findByText("No products yet")).toBeInTheDocument();
    const panel = screen.getByText("No products yet").closest("section")!;
    expect(within(panel).getByRole("link", { name: "Add product" })).toHaveAttribute("href", "/products/new");
  });

  it("shows no-results with a clear-filters action", async () => {
    createMockApi().install();
    const { user, location } = renderApp("/products?search=zzz&category=3");
    expect(await screen.findByText("No matching products")).toBeInTheDocument();

    const panel = screen.getByText("No matching products").closest("section")!;
    await user.click(within(panel).getByRole("button", { name: "Clear filters" }));
    expect(await screen.findByText("Product 1")).toBeInTheDocument();
    expect(location()).toBe("/products");
    expect(screen.getByLabelText("Search by name")).toHaveValue("");
  });
});

describe("search, filters and pagination", () => {
  it("debounces search into a single request for the final value", async () => {
    const api = createMockApi({
      products: [makeProduct(1, { name: "Wireless Mouse" }), makeProduct(2, { name: "Keyboard" })],
    }).install();
    const { user, location } = renderApp("/products");
    await screen.findByText("Keyboard");
    const before = api.listRequests().length;

    await user.type(screen.getByLabelText("Search by name"), "mouse");
    // Nothing sent while typing.
    expect(api.listRequests()).toHaveLength(before);

    await waitFor(() => expect(location()).toBe("/products?search=mouse"));
    await waitFor(() => expect(screen.queryByText("Keyboard")).not.toBeInTheDocument());
    const searches = api.listRequests().slice(before);
    expect(searches.map((r) => r.search.get("search"))).toEqual(["mouse"]);
    expect(screen.getByText("1 product found")).toBeInTheDocument();
    expect(SEARCH_DEBOUNCE_MS).toBe(300);
  });

  it("never shows results for an outdated search", async () => {
    const api = createMockApi({
      products: [makeProduct(1, { name: "Alpha" }), makeProduct(2, { name: "Beta" })],
    }).install();
    const slow = deferred();
    api.on("GET", /search=alpha/, async () => {
      await slow.promise;
      return undefined;
    });
    const { user } = renderApp("/products");
    await screen.findByText("Beta");

    const input = screen.getByLabelText("Search by name");
    await user.type(input, "alpha");
    await waitFor(() => expect(api.listRequests().some((r) => r.search.get("search") === "alpha")).toBe(true));
    await user.clear(input);
    await user.type(input, "beta");
    await waitFor(() => expect(productNames()).toEqual(["Beta"]));

    slow.resolve(); // old response arrives late
    await new Promise((r) => setTimeout(r, 50));
    expect(productNames()).toEqual(["Beta"]);
  });

  it("paginates through the server and resets to page 1 on filter changes", async () => {
    createMockApi({
      products: [...makeProducts(25), makeProduct(26, { name: "Kettle", category: 3 })],
    }).install();
    const { user, location } = renderApp("/products");
    await screen.findByText("Kettle");
    expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Next/ }));
    await screen.findByText("Page 2 of 3");
    expect(location()).toBe("/products?page=2");
    await waitFor(() => expect(productNames()).toContain("Product 16"));

    await user.selectOptions(screen.getByLabelText("Category"), "Kitchen");
    await waitFor(() => expect(location()).toBe("/products?category=3"));
    expect(await screen.findByText("1 product found")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Category"), "All categories");
    await user.click(await screen.findByRole("button", { name: /Next/ }));
    await waitFor(() => expect(location()).toBe("/products?page=2"));
    await user.type(screen.getByLabelText("Search by name"), "product 2");
    await waitFor(() => expect(location()).toBe("/products?search=product+2"));
  });

  it("disables row actions while a new page is loading", async () => {
    const api = createMockApi({ products: makeProducts(15) }).install();
    const gate = deferred();
    api.on("GET", /page=2/, async () => {
      await gate.promise;
      return undefined;
    });
    const { user } = renderApp("/products");
    await screen.findByText("Product 15");

    await user.click(screen.getByRole("button", { name: /Next/ }));
    // Previous page's rows are still visible but cannot be acted on.
    expect(await screen.findByRole("button", { name: "Delete Product 15" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Edit Product 15" })).toBeDisabled();
    expect(screen.getByText("Updating…")).toBeInTheDocument();

    gate.resolve();
    expect(await screen.findByRole("button", { name: "Delete Product 5" })).toBeEnabled();
  });

  it("filters by category from the URL and supports a category with no products", async () => {
    const api = createMockApi().install();
    renderApp("/products?category=4");
    expect(await screen.findByText("No matching products")).toBeInTheDocument();
    expect(api.listRequests().at(-1)!.search.get("category")).toBe("4");
    await waitFor(() => expect(screen.getByLabelText("Category")).toHaveValue("4"));
  });
});
