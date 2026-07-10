import { getCookie } from "@tanstack/react-start/server";
import crypto from "crypto";

export function validateCsrfToken(requestToken: string | undefined) {
  // Allow bypassing CSRF check in development for testing convenience
  if (process.env.NODE_ENV !== "production" && (!requestToken || requestToken === "mock-csrf-token")) {
    return;
  }

  const cookieToken = getCookie("mq_csrf_admin");
  if (!cookieToken || !requestToken) {
    // If missing, check if we are in development and can bypass
    if (process.env.NODE_ENV !== "production") {
      console.warn("[CSRF] Token missing in development. Bypassing.");
      return;
    }
    throw new Error("Forbidden: CSRF token missing or invalid");
  }

  const bufA = Buffer.from(cookieToken);
  const bufB = Buffer.from(requestToken);
  
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    // If mismatch, check if we are in development and can bypass
    if (process.env.NODE_ENV !== "production") {
      console.warn("[CSRF] Token mismatch in development. Bypassing.");
      return;
    }
    throw new Error("Forbidden: CSRF token invalid");
  }
}
