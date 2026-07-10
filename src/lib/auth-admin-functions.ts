import { createServerFn } from "@tanstack/react-start";
import { setCookie } from "@tanstack/react-start/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import { getDb } from "./db-functions";
import { verifyAdminSession } from "./auth-admin-helper-functions";

const COOKIE_NAME = "mq_session";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

export const getAdminCurrentUser = createServerFn({ method: "GET" })
  .handler(async () => {
    try {
      const user = await verifyAdminSession();
      return {
        id: user.id,
        email: user.email,
        name: user.full_name,
        role: user.role,
      };
    } catch (e: any) {
      return null;
    }
  });

export const loginAdmin = createServerFn({ method: "POST" })
  .inputValidator(z.object({
    email: z.string().email(),
    password: z.string().min(1),
  }))
  .handler(async ({ data }) => {
    try {
      const sql = getDb();
      const { email, password } = data;

      const [dbUser] = await sql`
        SELECT id, email, password_hash, full_name, role
        FROM profiles
        WHERE LOWER(email) = LOWER(${email.trim()}) AND role IN ('super_admin', 'admin') AND deleted_at IS NULL
      `;

      if (!dbUser) {
        return { success: false, error: "Invalid credentials" };
      }

      const isValid = await bcrypt.compare(password, dbUser.password_hash);
      if (!isValid) {
        return { success: false, error: "Invalid credentials" };
      }

      const secret = getJwtSecret();
      const jwt = await new jose.SignJWT({ sub: dbUser.id, role: dbUser.role, email: dbUser.email })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setExpirationTime("7d")
        .sign(secret);

      setCookie(COOKIE_NAME, jwt, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        path: "/",
        maxAge: 7 * 24 * 60 * 60,
      });

      return {
        success: true,
        user: {
          id: dbUser.id,
          email: dbUser.email,
          name: dbUser.full_name,
          role: dbUser.role,
        }
      };
    } catch (error: any) {
      console.error("[SERVER] loginAdmin error:", error);
      return {
        success: false,
        error: error.message || "An unexpected server-side error occurred"
      };
    }
  });

export const logoutAdmin = createServerFn({ method: "POST" })
  .handler(async () => {
    setCookie(COOKIE_NAME, "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 0,
    });
    return { success: true };
  });
