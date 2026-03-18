import { auth } from "../../src/lib/auth";
import { toNodeHandler } from "better-auth/node";
import type { IncomingMessage, ServerResponse } from "http";

const handler = toNodeHandler(auth);

export default async function (req: IncomingMessage, res: ServerResponse) {
  try {
    await handler(req, res);
  } catch (err) {
    console.error("Auth handler error:", err);
    if (!res.headersSent) {
      const status =
        typeof err === "object" &&
        err !== null &&
        "status" in err &&
        typeof err.status === "number"
          ? err.status
          : 500;
      const message =
        typeof err === "object" &&
        err !== null &&
        "message" in err &&
        typeof err.message === "string"
          ? err.message
          : "Authentication failed";
      res.writeHead(status, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: message }));
    }
  }
}
