import { Navigate, Outlet, useLocation } from "react-router";

import { Button } from "../../components/Button";
import { FullPageLoader, StatePanel } from "../../components/Feedback";
import { useAuth } from "./useAuth";

function VerificationFailed() {
  const { retryVerification, signOutLocally } = useAuth();
  return (
    <main style={{ maxWidth: 560, margin: "15vh auto", padding: 16 }}>
      <StatePanel
        role="alert"
        title="Can't reach the server"
        message="We couldn't confirm your session. Check that the API is running and try again."
        actions={
          <>
            <Button variant="primary" onClick={retryVerification}>
              Try again
            </Button>
            <Button onClick={signOutLocally}>Sign in again</Button>
          </>
        }
      />
    </main>
  );
}

/** Renders child routes only for a verified session. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "checking") return <FullPageLoader label="Checking your session…" />;
  if (status === "unverified") return <VerificationFailed />;
  if (status === "anonymous") return <Navigate to="/login" replace state={{ from: location }} />;
  return <Outlet />;
}

export function RootRedirect() {
  const { status } = useAuth();
  if (status === "checking") return <FullPageLoader label="Checking your session…" />;
  if (status === "unverified") return <VerificationFailed />;
  return <Navigate to={status === "authenticated" ? "/products" : "/login"} replace />;
}
