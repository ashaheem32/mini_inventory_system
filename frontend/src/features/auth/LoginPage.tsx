import { zodResolver } from "@hookform/resolvers/zod";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Navigate, useLocation, useNavigate, type Location } from "react-router";
import { z } from "zod";

import { Button } from "../../components/Button";
import { Alert, FullPageLoader } from "../../components/Feedback";
import { Field } from "../../components/Field";
import fieldStyles from "../../components/Field.module.css";
import { ApiError } from "../../lib/api";
import { useAuth } from "./useAuth";
import styles from "./LoginPage.module.css";

const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password."),
});
type LoginValues = z.infer<typeof loginSchema>;

function loginErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 400) return "Incorrect username or password.";
    if (error.status === 429) return "Too many sign-in attempts. Wait a minute and try again.";
  }
  return "We couldn't sign you in right now. Please try again.";
}

function redirectTarget(state: unknown): string {
  const from = (state as { from?: Location } | null)?.from;
  if (!from || from.pathname === "/login") return "/products";
  return `${from.pathname}${from.search}${from.hash}`;
}

export function LoginPage() {
  const { status, login, notice, clearNotice } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({ resolver: zodResolver(loginSchema), defaultValues: { username: "", password: "" } });

  if (status === "checking") return <FullPageLoader label="Checking your session…" />;
  if (status === "authenticated" && !isSubmitting) return <Navigate to={redirectTarget(location.state)} replace />;

  const onSubmit = async (values: LoginValues) => {
    setFormError(null);
    clearNotice();
    try {
      await login(values.username, values.password);
      navigate(redirectTarget(location.state), { replace: true });
    } catch (error) {
      setFormError(loginErrorMessage(error));
    }
  };

  return (
    <main className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <img src="/favicon.svg" alt="" width={28} height={28} />
          <span>Mini Inventory</span>
        </div>
        <h1 className={styles.title}>Sign in</h1>
        <p className={styles.subtitle}>Use your inventory account to continue.</p>

        <form className={styles.form} onSubmit={handleSubmit(onSubmit)} noValidate>
          {notice && (
            <Alert tone="warning" onDismiss={clearNotice}>
              {notice}
            </Alert>
          )}
          {formError && <Alert tone="error">{formError}</Alert>}

          <Field id="username" label="Username" error={errors.username?.message}>
            {(describedBy) => (
              <input
                id="username"
                className={fieldStyles.control}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={errors.username ? true : undefined}
                aria-describedby={describedBy}
                {...register("username")}
              />
            )}
          </Field>
          <Field id="password" label="Password" error={errors.password?.message}>
            {(describedBy) => (
              <input
                id="password"
                type="password"
                className={fieldStyles.control}
                autoComplete="current-password"
                aria-invalid={errors.password ? true : undefined}
                aria-describedby={describedBy}
                {...register("password")}
              />
            )}
          </Field>

          <Button type="submit" variant="primary" className={styles.submit} disabled={isSubmitting}>
            {isSubmitting ? "Signing in…" : "Sign in"}
          </Button>
        </form>
      </div>
    </main>
  );
}
