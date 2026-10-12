import { Link, useLocation, useNavigate, useParams } from "react-router";

import { Button, ButtonLink } from "../../components/Button";
import { Skeleton, StatePanel } from "../../components/Feedback";
import { ApiError, NetworkError } from "../../lib/api";
import { ProductForm } from "./ProductForm";
import styles from "./ProductFormPage.module.css";
import { useProductQuery, useUpdateProduct } from "./queries";
import { getReturnTo } from "./returnTo";
import type { Product } from "./types";

function parseId(raw: string | undefined): number | null {
  return raw && /^\d+$/.test(raw) && Number(raw) > 0 ? Number(raw) : null;
}

function FormSkeleton() {
  return (
    <div className={styles.skeletonForm} role="status" aria-label="Loading product">
      {[0, 1, 2, 3].map((i) => (
        <div key={i}>
          <Skeleton width={90} height={12} style={{ marginBottom: 8 }} />
          <Skeleton height={40} />
        </div>
      ))}
    </div>
  );
}

function EditForm({ product, returnTo }: { product: Product; returnTo: string }) {
  const navigate = useNavigate();
  const updateMutation = useUpdateProduct(product.id);
  return (
    <ProductForm
      defaultValues={{
        name: product.name,
        price: product.price,
        stock: String(product.stock),
        category: String(product.category),
        is_active: product.is_active,
      }}
      submitLabel="Save changes"
      pendingLabel="Saving…"
      cancelTo={returnTo}
      onSubmit={(payload) => updateMutation.mutateAsync(payload)}
      onSuccess={(saved) => navigate(returnTo, { state: { notice: `"${saved.name}" was updated.` } })}
    />
  );
}

export function EditProductPage() {
  const { id: rawId } = useParams();
  const location = useLocation();
  const returnTo = getReturnTo(location.state);
  const id = parseId(rawId);
  const product = useProductQuery(id);

  const notFound = id === null || (product.error instanceof ApiError && product.error.status === 404);

  let body;
  if (notFound) {
    body = (
      <StatePanel
        role="alert"
        title="Product not found"
        message="This product doesn't exist. It may have been deleted."
        actions={
          <ButtonLink to={returnTo} variant="primary">
            Back to products
          </ButtonLink>
        }
      />
    );
  } else if (product.isPending) {
    body = <FormSkeleton />;
  } else if (product.isError) {
    body = (
      <StatePanel
        role="alert"
        title="Couldn't load this product"
        message={
          product.error instanceof NetworkError
            ? "The server couldn't be reached. Check your connection and try again."
            : "Something went wrong while loading the product."
        }
        actions={
          <Button variant="primary" onClick={() => product.refetch()}>
            Try again
          </Button>
        }
      />
    );
  } else {
    body = <EditForm key={product.data.id} product={product.data} returnTo={returnTo} />;
  }

  return (
    <div className={styles.page}>
      <title>Edit product · Mini Inventory</title>
      <Link to={returnTo} className={styles.back}>
        ← Back to products
      </Link>
      <h1 className={styles.title}>Edit product</h1>
      <p className={styles.subtitle}>{product.data ? product.data.name : " "}</p>
      {body}
    </div>
  );
}
