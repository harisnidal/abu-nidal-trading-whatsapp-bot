import { Router } from "express";
import { env, loadBusinessConfig } from "./config";
import { parseIncomingMessage, sendWhatsappText } from "./whatsapp";
import { addMessage, getOrCreateCustomer, getRecentMessages } from "./db";
import { runAssistant } from "./ai";

export const webhookRouter = Router();

// Meta calls this once, at setup time, to verify you control the endpoint.
webhookRouter.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === env.whatsappVerifyToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// Meta calls this for every inbound message / status update.
webhookRouter.post("/webhook", async (req, res) => {
  // Ack immediately: WhatsApp expects a fast 200, and will retry on timeout.
  res.sendStatus(200);

  const incoming = parseIncomingMessage(req.body);
  if (!incoming) return;

  try {
    const customer = getOrCreateCustomer(incoming.from);
    addMessage(customer.id, "in", incoming.text);

    const business = loadBusinessConfig();
    const history = getRecentMessages(customer.id, 20);
    const { replyText } = await runAssistant(business, customer.id, history);

    addMessage(customer.id, "out", replyText);
    await sendWhatsappText(incoming.from, replyText);
  } catch (err) {
    console.error("Failed to handle incoming WhatsApp message:", err);
  }
});
