import type { ComponentPropsWithRef } from "react";
import { Link, type LinkProps } from "react-router";

import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "danger" | "dangerOutline" | "ghost";
type Size = "medium" | "small";

function classes(variant: Variant, size: Size, extra?: string) {
  return [styles.button, styles[variant], size === "small" ? styles.small : "", extra ?? ""]
    .filter(Boolean)
    .join(" ");
}

interface ButtonProps extends ComponentPropsWithRef<"button"> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant = "secondary", size = "medium", className, type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={classes(variant, size, className)} {...rest} />;
}

interface ButtonLinkProps extends LinkProps {
  variant?: Variant;
  size?: Size;
}

export function ButtonLink({ variant = "secondary", size = "medium", className, ...rest }: ButtonLinkProps) {
  return <Link className={classes(variant, size, className)} {...rest} />;
}
