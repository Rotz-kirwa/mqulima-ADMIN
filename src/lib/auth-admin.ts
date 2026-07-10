// Re-export admin auth server functions through a non-.server file so they
// can be statically imported by route files without triggering import-protection.
// These functions use createServerFn() — their handlers only run on the server.
export { getAdminCurrentUser, loginAdmin, logoutAdmin } from "./auth-admin-functions";
