import { getCookie } from "@tanstack/react-start/server";
import * as jose from "jose";
import { getDb } from "./db-functions";

const COOKIE_NAME = "mq_session";

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

export async function verifyAdminSession() {
  const token = getCookie(COOKIE_NAME);
  if (!token) {
    throw new Error("Unauthorized: No session token found");
  }

  try {
    const secret = getJwtSecret();
    const { payload } = await jose.jwtVerify(token, secret);
    const userId = (payload.sub || payload.id) as string;
    const userRole = payload.role as string;

    if (!userRole || !["super_admin", "admin"].includes(userRole)) {
      throw new Error("Forbidden: Admin access required");
    }

    const sql = getDb();
    const [dbUser] = await sql`
      SELECT id, email, full_name, role
      FROM profiles
      WHERE id = ${userId} AND role IN ('super_admin', 'admin') AND deleted_at IS NULL
    `;

    if (!dbUser) {
      throw new Error("Forbidden: User profile not found or role modified");
    }

    return dbUser;
  } catch (error: any) {
    throw new Error(error.message || "Unauthorized");
  }
}
