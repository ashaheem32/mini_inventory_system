import { Button, ButtonLink } from "../../components/Button";
import { Skeleton } from "../../components/Feedback";
import { formatPrice } from "../../lib/format";
import styles from "./ProductTable.module.css";
import type { Product } from "./types";

interface ProductTableProps {
  products: Product[];
  /** Rows belong to the previous page/filter while new data loads: block actions. */
  stale: boolean;
  returnTo: string;
  onDelete: (product: Product, trigger: HTMLButtonElement) => void;
}

function Header() {
  return (
    <thead>
      <tr>
        <th scope="col">Name</th>
        <th scope="col">Category</th>
        <th scope="col" className={styles.numeric}>
          Price
        </th>
        <th scope="col" className={styles.numeric}>
          Stock
        </th>
        <th scope="col">Status</th>
        <th scope="col" className={styles.actionsCell}>
          <span className="visually-hidden">Actions</span>
        </th>
      </tr>
    </thead>
  );
}

export function ProductTable({ products, stale, returnTo, onDelete }: ProductTableProps) {
  return (
    <div className={`${styles.wrapper} ${stale ? styles.stale : ""}`} aria-busy={stale || undefined}>
      <table className={styles.table}>
        <caption className="visually-hidden">Products</caption>
        <Header />
        <tbody>
          {products.map((product) => (
            <tr key={product.id}>
              <td className={`${styles.nameCell} ${styles.name}`}>{product.name}</td>
              <td data-label="Category">{product.category_name}</td>
              <td data-label="Price" className={styles.numeric}>
                {formatPrice(product.price)}
              </td>
              <td data-label="Stock" className={styles.numeric}>
                {product.stock.toLocaleString()}
                {product.stock === 0 && <span className={styles.outOfStock}>Out of stock</span>}
              </td>
              <td data-label="Status">
                <span className={`${styles.badge} ${product.is_active ? styles.active : styles.inactive}`}>
                  {product.is_active ? "Active" : "Inactive"}
                </span>
              </td>
              <td className={styles.actionsCell}>
                <div className={styles.actions}>
                  {stale ? (
                    <Button size="small" disabled aria-label={`Edit ${product.name}`}>
                      Edit
                    </Button>
                  ) : (
                    <ButtonLink
                      size="small"
                      to={`/products/${product.id}/edit`}
                      state={{ returnTo }}
                      aria-label={`Edit ${product.name}`}
                    >
                      Edit
                    </ButtonLink>
                  )}
                  <Button
                    size="small"
                    variant="dangerOutline"
                    disabled={stale}
                    aria-label={`Delete ${product.name}`}
                    onClick={(event) => onDelete(product, event.currentTarget)}
                  >
                    Delete
                  </Button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function ProductTableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className={styles.wrapper} role="status" aria-label="Loading products">
      <table className={styles.table} aria-hidden="true">
        <Header />
        <tbody>
          {Array.from({ length: rows }, (_, i) => (
            <tr key={i}>
              <td className={styles.nameCell}>
                <Skeleton width={`${60 + ((i * 13) % 30)}%`} height={16} />
              </td>
              <td data-label="Category">
                <Skeleton width={90} />
              </td>
              <td data-label="Price" className={styles.numeric}>
                <Skeleton width={64} style={{ marginLeft: "auto" }} />
              </td>
              <td data-label="Stock" className={styles.numeric}>
                <Skeleton width={32} style={{ marginLeft: "auto" }} />
              </td>
              <td data-label="Status">
                <Skeleton width={64} height={20} />
              </td>
              <td className={styles.actionsCell}>
                <div className={styles.actions}>
                  <Skeleton width={52} height={32} />
                  <Skeleton width={64} height={32} />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
