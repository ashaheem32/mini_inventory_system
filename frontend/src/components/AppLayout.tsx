import { useState } from "react";
import { Link, Outlet } from "react-router";

import { useAuth } from "../features/auth/useAuth";
import styles from "./AppLayout.module.css";
import { Button } from "./Button";

export function AppLayout() {
  const { user, logout } = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const handleLogout = async () => {
    setSigningOut(true);
    await logout(); // always clears local state; RequireAuth then redirects to /login
  };

  return (
    <>
      <a className={styles.skipLink} href="#main">
        Skip to content
      </a>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <Link to="/products" className={styles.brand}>
            <img src="/favicon.svg" alt="" width={28} height={28} />
            <span className={styles.brandText}>Mini Inventory</span>
          </Link>
          <div className={styles.account}>
            {user && (
              <span className={styles.user}>
                Signed in as <strong>{user.username}</strong>
              </span>
            )}
            <Button size="small" onClick={handleLogout} disabled={signingOut}>
              {signingOut ? "Signing out…" : "Sign out"}
            </Button>
          </div>
        </div>
      </header>
      <main id="main" className={styles.main} tabIndex={-1}>
        <Outlet />
      </main>
    </>
  );
}
