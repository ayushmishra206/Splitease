import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import path from "node:path";
import { defineConfig } from "prisma/config";

export default defineConfig({
  earlyAccess: true,
  schema: path.join("prisma", "schema.prisma"),
});
