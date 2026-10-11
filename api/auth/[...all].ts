import { toNodeHandler } from "better-auth/node";
import type { IncomingMessage, ServerResponse } from "http";
import { auth } from "../../src/server/vercelAuth.js";

const handler = toNodeHandler(auth);

export default async function (req: IncomingMessage, res: ServerResponse) {
  try {
    await handler(req, res);
  } catch (err) {
    console.error("Auth handler error:", err);
    if (!res.headersSent) {
      res.writeHead(500, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Authentication failed" }));
    }
  }
}
