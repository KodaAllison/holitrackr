import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

const authConfig = {
  database: new Database("./auth.db"),
  baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5173",
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    },
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 1 day
  },
  trustedOrigins: ["http://localhost:5173"],
};

export const auth = betterAuth(authConfig);
export { authConfig };
