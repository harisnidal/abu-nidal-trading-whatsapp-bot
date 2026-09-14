import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { env } from "./config";

const dbPath = path.resolve(process.cwd(), env.databaseFile);
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");

db.exec(`
  CREATE TABLE IF NOT EXISTS customers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone TEXT UNIQUE NOT NULL,
    name TEXT,
    language TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
    body TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    product TEXT NOT NULL,
    quantity TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_customer ON messages(customer_id);
  CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id);
`);

export interface Customer {
  id: number;
  phone: string;
  name: string | null;
  language: string | null;
  created_at: string;
}

export interface Message {
  id: number;
  customer_id: number;
  direction: "in" | "out";
  body: string;
  created_at: string;
}

export interface Order {
  id: number;
  customer_id: number;
  product: string;
  quantity: string;
  status: string;
  notes: string | null;
  created_at: string;
}

export function getOrCreateCustomer(phone: string): Customer {
  const existing = db
    .prepare("SELECT * FROM customers WHERE phone = ?")
    .get(phone) as Customer | undefined;
  if (existing) return existing;

  const result = db
    .prepare("INSERT INTO customers (phone) VALUES (?)")
    .run(phone);
  return db
    .prepare("SELECT * FROM customers WHERE id = ?")
    .get(result.lastInsertRowid) as Customer;
}

export function updateCustomer(
  id: number,
  fields: Partial<Pick<Customer, "name" | "language">>
): void {
  const sets: string[] = [];
  const values: unknown[] = [];
  for (const [key, value] of Object.entries(fields)) {
    if (value === undefined) continue;
    sets.push(`${key} = ?`);
    values.push(value);
  }
  if (sets.length === 0) return;
  values.push(id);
  db.prepare(`UPDATE customers SET ${sets.join(", ")} WHERE id = ?`).run(
    ...values
  );
}

export function addMessage(
  customerId: number,
  direction: "in" | "out",
  body: string
): void {
  db.prepare(
    "INSERT INTO messages (customer_id, direction, body) VALUES (?, ?, ?)"
  ).run(customerId, direction, body);
}

export function getRecentMessages(
  customerId: number,
  limit = 20
): Message[] {
  const rows = db
    .prepare(
      "SELECT * FROM messages WHERE customer_id = ? ORDER BY id DESC LIMIT ?"
    )
    .all(customerId, limit) as Message[];
  return rows.reverse();
}

export function createOrder(
  customerId: number,
  product: string,
  quantity: string,
  notes: string | null
): Order {
  const result = db
    .prepare(
      "INSERT INTO orders (customer_id, product, quantity, notes) VALUES (?, ?, ?, ?)"
    )
    .run(customerId, product, quantity, notes);
  return db
    .prepare("SELECT * FROM orders WHERE id = ?")
    .get(result.lastInsertRowid) as Order;
}

export function listOrders(): (Order & { customer_phone: string; customer_name: string | null })[] {
  return db
    .prepare(
      `SELECT orders.*, customers.phone AS customer_phone, customers.name AS customer_name
       FROM orders
       JOIN customers ON customers.id = orders.customer_id
       ORDER BY orders.created_at DESC`
    )
    .all() as (Order & { customer_phone: string; customer_name: string | null })[];
}

export interface OrderStats {
  total: number;
  byStatus: Record<string, number>;
  conversionRate: number | null;
}

export function getOrderStats(): OrderStats {
  const rows = db
    .prepare("SELECT status, COUNT(*) AS count FROM orders GROUP BY status")
    .all() as { status: string; count: number }[];

  const byStatus: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    byStatus[row.status] = row.count;
    total += row.count;
  }

  const fulfilled = byStatus["fulfilled"] ?? 0;
  const cancelled = byStatus["cancelled"] ?? 0;
  // Conversion rate is measured against inquiries that have been resolved
  // one way or another (fulfilled or cancelled) — still-pending/confirmed
  // ones haven't reached an outcome yet, so they're excluded from the rate.
  const resolved = fulfilled + cancelled;

  return {
    total,
    byStatus,
    conversionRate: resolved > 0 ? fulfilled / resolved : null,
  };
}

export function listCustomers(): Customer[] {
  return db
    .prepare("SELECT * FROM customers ORDER BY created_at DESC")
    .all() as Customer[];
}

export function listMessagesForCustomer(customerId: number): Message[] {
  return db
    .prepare("SELECT * FROM messages WHERE customer_id = ? ORDER BY id ASC")
    .all(customerId) as Message[];
}

export function updateOrderStatus(id: number, status: string): void {
  db.prepare("UPDATE orders SET status = ? WHERE id = ?").run(status, id);
}
