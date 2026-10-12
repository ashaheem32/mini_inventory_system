import { Route, Routes } from "react-router";

import { AppLayout } from "./components/AppLayout";
import { RequireAuth, RootRedirect } from "./features/auth/AuthGate";
import { LoginPage } from "./features/auth/LoginPage";
import { EditProductPage } from "./features/products/EditProductPage";
import { NewProductPage } from "./features/products/NewProductPage";
import { ProductsPage } from "./features/products/ProductsPage";
import { NotFoundPage } from "./pages/NotFoundPage";

export function AppRoutes() {
  return (
    <Routes>
      <Route index element={<RootRedirect />} />
      <Route path="login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppLayout />}>
          <Route path="products" element={<ProductsPage />} />
          <Route path="products/new" element={<NewProductPage />} />
          <Route path="products/:id/edit" element={<EditProductPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
