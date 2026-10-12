import { ButtonLink } from "../components/Button";
import { StatePanel } from "../components/Feedback";

export function NotFoundPage() {
  return (
    <main style={{ maxWidth: 560, margin: "15vh auto", padding: 16 }}>
      <title>Page not found · Mini Inventory</title>
      <h1 className="visually-hidden">Page not found</h1>
      <StatePanel
        title="Page not found"
        message="The page you're looking for doesn't exist or has moved."
        actions={
          <ButtonLink to="/" variant="primary">
            Go to inventory
          </ButtonLink>
        }
      />
    </main>
  );
}
