import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import crypto from "crypto";

export const generateCsrfToken = createServerFn({ method: "POST" })
  .handler(async () => {
    try {
      const token = crypto.randomBytes(32).toString("hex");
      setCookie("mq_csrf_admin", token, {
        httpOnly: false,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60, // 30 days
      });
      return { token };
    } catch (error: any) {
      console.error("[SERVER] generateCsrfToken error:", error);
      return { token: null, error: error.message };
    }
  });
