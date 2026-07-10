// Re-export CSRF server functions through a non-.server file so they
// can be statically imported by route files without triggering import-protection.
// generateCsrfToken uses createServerFn() — the handler only runs on the server.
export { generateCsrfToken } from "./csrf-functions";
