import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm, type Path } from "react-hook-form";

import { Button, ButtonLink } from "../../components/Button";
import { Alert, Skeleton } from "../../components/Feedback";
import { Field } from "../../components/Field";
import fieldStyles from "../../components/Field.module.css";
import { config } from "../../config";
import { ApiError, NetworkError, fieldErrors } from "../../lib/api";
import styles from "./ProductForm.module.css";
import { useCategoriesQuery } from "./queries";
import { NAME_MAX_LENGTH, productFormSchema, type ProductFormOutput, type ProductFormValues } from "./schema";
import type { Product, ProductPayload } from "./types";

const FORM_FIELDS = ["name", "price", "stock", "category", "is_active"] as const;
type FormField = (typeof FORM_FIELDS)[number];

interface ProductFormProps {
  defaultValues: ProductFormValues;
  submitLabel: string;
  pendingLabel: string;
  cancelTo: string;
  onSubmit: (payload: ProductPayload) => Promise<Product>;
  onSuccess: (product: Product) => void;
}

function generalErrorMessage(error: unknown): string {
  if (error instanceof NetworkError) return "Couldn't reach the server. Check your connection and try again.";
  if (error instanceof ApiError) {
    if (error.status === 404) return "This product no longer exists. It may have been deleted by someone else.";
    if (error.status === 400) return "Please correct the highlighted fields.";
    if (error.status >= 500) return "The server had a problem saving the product. Please try again.";
  }
  return "The product couldn't be saved. Please try again.";
}

export function ProductForm({ defaultValues, submitLabel, pendingLabel, cancelTo, onSubmit, onSuccess }: ProductFormProps) {
  const categories = useCategoriesQuery();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ProductFormValues, unknown, ProductFormOutput>({
    resolver: zodResolver(productFormSchema),
    defaultValues,
    mode: "onTouched",
  });

  const categoriesReady = categories.isSuccess;

  const submit = async (values: ProductFormOutput) => {
    if (!categoriesReady) return;
    setFormError(null);
    try {
      const product = await onSubmit(values);
      onSuccess(product);
    } catch (error) {
      // Server validation is authoritative: attach its messages to the matching inputs.
      const serverErrors = fieldErrors(error);
      const matched = FORM_FIELDS.filter((field) => serverErrors[field]);
      matched.forEach((field: FormField, index) =>
        setError(field as Path<ProductFormValues>, { type: "server", message: serverErrors[field] }, { shouldFocus: index === 0 }),
      );
      const general = serverErrors.non_field_errors ?? serverErrors.detail;
      if (general) setFormError(general);
      else setFormError(matched.length ? "Please correct the highlighted fields." : generalErrorMessage(error));
    }
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit(submit)} noValidate aria-busy={isSubmitting}>
      {formError && <Alert tone="error">{formError}</Alert>}
      {categories.isError && (
        <Alert tone="error">
          Categories couldn't be loaded, so the product can't be saved yet.
          <Button size="small" variant="secondary" className={styles.inlineRetry} onClick={() => categories.refetch()}>
            {categories.isFetching ? "Retrying…" : "Retry"}
          </Button>
        </Alert>
      )}

      <Field id="product-name" label="Name" error={errors.name?.message} hint={`Up to ${NAME_MAX_LENGTH} characters.`}>
        {(describedBy) => (
          <input
            id="product-name"
            className={fieldStyles.control}
            autoComplete="off"
            maxLength={NAME_MAX_LENGTH + 50}
            aria-invalid={errors.name ? true : undefined}
            aria-describedby={describedBy}
            aria-required="true"
            {...register("name")}
          />
        )}
      </Field>

      <div className={styles.row}>
        <Field id="product-price" label={`Price (${config.currency})`} error={errors.price?.message} hint="Greater than 0, up to 2 decimal places.">
          {(describedBy) => (
            <input
              id="product-price"
              className={fieldStyles.control}
              inputMode="decimal"
              autoComplete="off"
              placeholder="0.00"
              aria-invalid={errors.price ? true : undefined}
              aria-describedby={describedBy}
              aria-required="true"
              {...register("price")}
            />
          )}
        </Field>
        <Field id="product-stock" label="Stock" error={errors.stock?.message} hint="Whole number, 0 or more.">
          {(describedBy) => (
            <input
              id="product-stock"
              className={fieldStyles.control}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              aria-invalid={errors.stock ? true : undefined}
              aria-describedby={describedBy}
              aria-required="true"
              {...register("stock")}
            />
          )}
        </Field>
      </div>

      <Field id="product-category" label="Category" error={errors.category?.message}>
        {(describedBy) =>
          categories.isPending ? (
            <div aria-busy="true">
              <Skeleton height={40} />
              <span className="visually-hidden">Loading categories…</span>
            </div>
          ) : (
            <select
              id="product-category"
              className={fieldStyles.control}
              disabled={!categoriesReady}
              aria-invalid={errors.category ? true : undefined}
              aria-describedby={describedBy}
              aria-required="true"
              {...register("category")}
            >
              <option value="">Select a category</option>
              {categories.data?.map((c) => (
                <option key={c.id} value={String(c.id)}>
                  {c.name}
                </option>
              ))}
            </select>
          )
        }
      </Field>

      <div className={fieldStyles.checkboxRow}>
        <input id="product-active" type="checkbox" className={fieldStyles.checkbox} aria-describedby="product-active-hint" {...register("is_active")} />
        <div>
          <label htmlFor="product-active" className={styles.checkboxLabel}>
            Active
          </label>
          <p id="product-active-hint" className={styles.checkboxHint}>
            Inactive products stay in the inventory but are marked as unavailable.
          </p>
        </div>
      </div>

      <div className={styles.actions}>
        <ButtonLink to={cancelTo} variant="secondary">
          Cancel
        </ButtonLink>
        <Button type="submit" variant="primary" disabled={isSubmitting || !categoriesReady} aria-busy={isSubmitting}>
          {isSubmitting ? pendingLabel : submitLabel}
        </Button>
      </div>
    </form>
  );
}
