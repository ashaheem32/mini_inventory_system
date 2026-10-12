import { Link, useLocation, useNavigate } from "react-router";

import { ProductForm } from "./ProductForm";
import styles from "./ProductFormPage.module.css";
import { useCreateProduct } from "./queries";
import { getReturnTo } from "./returnTo";
import { emptyProductFormValues } from "./schema";

export function NewProductPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const cancelTo = getReturnTo(location.state);
  const createMutation = useCreateProduct();

  return (
    <div className={styles.page}>
      <title>Add product · Mini Inventory</title>
      <Link to={cancelTo} className={styles.back}>
        ← Back to products
      </Link>
      <h1 className={styles.title}>Add product</h1>
      <p className={styles.subtitle}>New products appear at the top of the inventory list.</p>
      <ProductForm
        defaultValues={emptyProductFormValues}
        submitLabel="Create product"
        pendingLabel="Creating…"
        cancelTo={cancelTo}
        onSubmit={(payload) => createMutation.mutateAsync(payload)}
        onSuccess={(product) =>
          // Newest first: show page 1 without filters so the new product is visible.
          navigate("/products", { state: { notice: `"${product.name}" was created.` } })
        }
      />
    </div>
  );
}
