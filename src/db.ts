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

  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_id INTEGER NOT NULL REFERENCES customers(id),
    service TEXT NOT NULL,
    requested_time TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    notes TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_messages_customer ON messages(customer_id);
  CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);
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

export interface Booking {
  id: number;
  customer_id: number;
  service: string;
  requested_time: string;
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

export function createBooking(
  customerId: number,
  service: string,
  requestedTime: string,
  notes: string | null
): Booking {
  const result = db
    .prepare(
      "INSERT INTO bookings (customer_id, service, requested_time, notes) VALUES (?, ?, ?, ?)"
    )
    .run(customerId, service, requestedTime, notes);
  return db
    .prepare("SELECT * FROM bookings WHERE id = ?")
    .get(result.lastInsertRowid) as Booking;
}

export function listBookings(): (Booking & { customer_phone: string; customer_name: string | null })[] {
  return db
    .prepare(
      `SELECT bookings.*, customers.phone AS customer_phone, customers.name AS customer_name
       FROM bookings
       JOIN customers ON customers.id = bookings.customer_id
       ORDER BY bookings.created_at DESC`
    )
    .all() as (Booking & { customer_phone: string; customer_name: string | null })[];
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

export function updateBookingStatus(id: number, status: string): void {
  db.prepare("UPDATE bookings SET status = ? WHERE id = ?").run(status, id);
}
