import { getDb } from "./server/db.ts";
import { users } from "./drizzle/schema.ts";

const db = await getDb();
const allUsers = await db.select().from(users);
console.log("Total usuários:", allUsers.length);
console.log("Roles:", allUsers.map(u => u.role));
