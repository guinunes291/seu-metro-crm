import * as mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../../drizzle/schema/index.js";
import { ENV } from "./env.js";

export type DrizzleDB = ReturnType<typeof drizzle>;

let _db: DrizzleDB | null = null;
let _pool: ReturnType<typeof mysql.createPool> | null = null;

export async function getDb(): Promise<DrizzleDB | null> {
  if (!_db && ENV.DATABASE_URL) {
    try {
      _pool = mysql.createPool({
        uri: ENV.DATABASE_URL,
        connectionLimit: 5,
        waitForConnections: true,
        queueLimit: 0,
        idleTimeout: 60000,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
      });
      _db = drizzle(_pool as any, { schema, mode: "default" });
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function closeDb(): Promise<void> {
  if (_pool) {
    await _pool.end();
    _pool = null;
    _db = null;
  }
}
