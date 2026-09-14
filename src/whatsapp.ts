import { env } from "./config";

const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

export async function sendWhatsappText(to: string, body: string): Promise<void> {
  const url = `${GRAPH_API_BASE}/${env.whatsappPhoneNumberId}/messages`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.whatsappToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`WhatsApp send failed (${res.status}): ${errText}`);
  }
}

export interface IncomingWhatsappMessage {
  from: string;
  text: string;
  waMessageId: string;
}

/**
 * Parses a WhatsApp Cloud API webhook payload, returning the first text
 * message found, or null if the payload isn't an inbound text message
 * (e.g. a delivery/read status update, which the caller should ignore).
 */
export function parseIncomingMessage(
  payload: unknown
): IncomingWhatsappMessage | null {
  try {
    const body = payload as any;
    const change = body?.entry?.[0]?.changes?.[0]?.value;
    const message = change?.messages?.[0];
    if (!message || message.type !== "text") return null;
    return {
      from: message.from,
      text: message.text.body,
      waMessageId: message.id,
    };
  } catch {
    return null;
  }
}
