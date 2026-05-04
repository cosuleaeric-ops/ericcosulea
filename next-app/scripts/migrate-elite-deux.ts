import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "drizzle-orm";
import { db } from "../lib/db";
import { eliteDeuxState } from "../lib/db/schema";

const jsonPath = resolve(__dirname, "../../data/elite-deux-state.json");
const raw = readFileSync(jsonPath, "utf8");
const state = JSON.parse(raw);

const tasksByDate = state.tasksByDate ?? {};
const totalTasks = (Object.values(tasksByDate) as unknown[]).reduce<number>((s, arr) => s + (Array.isArray(arr) ? arr.length : 0), 0);
console.log(`Loaded state: ${Object.keys(tasksByDate).length} days, ${totalTasks} tasks`);

(async () => {
  const existing = await db.select().from(eliteDeuxState).where(eq(eliteDeuxState.id, 1)).limit(1);
  if (existing.length > 0) {
    await db.update(eliteDeuxState).set({ state, updatedAt: new Date() }).where(eq(eliteDeuxState.id, 1));
    console.log("Updated existing row.");
  } else {
    await db.insert(eliteDeuxState).values({ id: 1, state, updatedAt: new Date() });
    console.log("Inserted new row.");
  }
  process.exit(0);
})();
