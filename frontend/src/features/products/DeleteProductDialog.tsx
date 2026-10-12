import { ConfirmDialog } from "../../components/ConfirmDialog";
import type { Product } from "./types";

interface DeleteProductDialogProps {
  product: Product | null;
  pending: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocusTo: () => HTMLElement | null;
}

export function DeleteProductDialog({ product, pending, error, onConfirm, onCancel, returnFocusTo }: DeleteProductDialogProps) {
  return (
    <ConfirmDialog
      open={product !== null}
      title="Delete product?"
      description={
        <p>
          <strong>{product?.name}</strong> will be permanently deleted. This can't be undone.
        </p>
      }
      confirmLabel="Delete product"
      pendingLabel="Deleting…"
      pending={pending}
      error={error}
      onConfirm={onConfirm}
      onCancel={onCancel}
      returnFocusTo={returnFocusTo}
    />
  );
}
