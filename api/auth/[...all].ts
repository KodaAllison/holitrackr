import { auth } from "../../src/lib/auth";
import { toNodeHandler } from "better-auth/node";

export default toNodeHandler(auth);
