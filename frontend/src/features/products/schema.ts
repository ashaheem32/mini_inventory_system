import { z } from "zod";

/** Backend limits: DecimalField(max_digits=10, decimal_places=2) and a 32-bit stock column. */
export const NAME_MAX_LENGTH = 200;
export const PRICE_MAX_INTEGER_DIGITS = 8;
export const STOCK_MAX = 2_147_483_647;

const PRICE_PATTERN = /^-?\d+(\.\d+)?$/;

export const productFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter a product name.")
    .max(NAME_MAX_LENGTH, `Name must be ${NAME_MAX_LENGTH} characters or fewer.`),
  // Price stays a decimal string end to end to avoid floating-point rounding.
  price: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const fail = (message: string) => ctx.addIssue({ code: "custom", message });
      if (!value) return fail("Enter a price.");
      if (!PRICE_PATTERN.test(value)) return fail("Enter a price as a number, for example 12.50.");
      if (Number(value) <= 0) return fail("Price must be greater than zero.");
      const [whole, fraction = ""] = value.split(".");
      if (fraction.length > 2) return fail("Use no more than two decimal places.");
      if (whole.replace(/^0+(?=\d)/, "").length > PRICE_MAX_INTEGER_DIGITS) {
        return fail("Price must be less than 100,000,000.");
      }
    }),
  stock: z
    .string()
    .trim()
    .superRefine((value, ctx) => {
      const fail = (message: string) => ctx.addIssue({ code: "custom", message });
      if (!value) return fail("Enter the stock quantity.");
      if (/^-\d+$/.test(value)) return fail("Stock cannot be negative.");
      if (!/^\d+$/.test(value)) return fail("Stock must be a whole number.");
      if (Number(value) > STOCK_MAX) return fail(`Stock cannot exceed ${STOCK_MAX.toLocaleString("en-US")}.`);
    })
    .transform((value) => Number(value)),
  category: z
    .string()
    .min(1, "Choose a category.")
    .regex(/^\d+$/, "Choose a category.")
    .transform((value) => Number(value)),
  is_active: z.boolean(),
});

/** Raw form state (strings, as typed). */
export type ProductFormValues = z.input<typeof productFormSchema>;
/** Validated payload sent to the API. */
export type ProductFormOutput = z.output<typeof productFormSchema>;

export const emptyProductFormValues: ProductFormValues = {
  name: "",
  price: "",
  stock: "",
  category: "",
  is_active: true,
};
