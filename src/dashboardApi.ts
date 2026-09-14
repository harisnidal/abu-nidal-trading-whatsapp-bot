import { Router } from "express";
import {
  listBookings,
  listCustomers,
  listMessagesForCustomer,
  updateBookingStatus,
} from "./db";

export const dashboardApiRouter = Router();

dashboardApiRouter.get("/api/bookings", (_req, res) => {
  res.json(listBookings());
});

dashboardApiRouter.post("/api/bookings/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body as { status?: string };
  if (!status) {
    res.status(400).json({ error: "status is required" });
    return;
  }
  updateBookingStatus(id, status);
  res.json({ ok: true });
});

dashboardApiRouter.get("/api/customers", (_req, res) => {
  res.json(listCustomers());
});

dashboardApiRouter.get("/api/customers/:id/messages", (req, res) => {
  const id = Number(req.params.id);
  res.json(listMessagesForCustomer(id));
});
