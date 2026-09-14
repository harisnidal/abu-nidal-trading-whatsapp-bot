import { Router } from "express";
import {
  listOrders,
  listCustomers,
  listMessagesForCustomer,
  updateOrderStatus,
  getOrderStats,
} from "./db";

export const dashboardApiRouter = Router();

dashboardApiRouter.get("/api/orders", (_req, res) => {
  res.json(listOrders());
});

dashboardApiRouter.get("/api/stats", (_req, res) => {
  res.json(getOrderStats());
});

dashboardApiRouter.post("/api/orders/:id/status", (req, res) => {
  const id = Number(req.params.id);
  const { status } = req.body as { status?: string };
  if (!status) {
    res.status(400).json({ error: "status is required" });
    return;
  }
  updateOrderStatus(id, status);
  res.json({ ok: true });
});

dashboardApiRouter.get("/api/customers", (_req, res) => {
  res.json(listCustomers());
});

dashboardApiRouter.get("/api/customers/:id/messages", (req, res) => {
  const id = Number(req.params.id);
  res.json(listMessagesForCustomer(id));
});
