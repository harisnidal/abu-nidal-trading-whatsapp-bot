import Anthropic from "@anthropic-ai/sdk";
import { env, BusinessConfig } from "./config";
import { Message, createOrder } from "./db";

const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

const CREATE_ORDER_TOOL: Anthropic.Tool = {
  name: "create_order_inquiry",
  description:
    "Record a customer's order/quote request once they've told you which " +
    "product and how much they want. Only call this once per request, " +
    "after the customer has confirmed the product and quantity.",
  input_schema: {
    type: "object",
    properties: {
      product: {
        type: "string",
        description: "The exact product name from the business's product list.",
      },
      quantity: {
        type: "string",
        description:
          "The quantity requested, in the customer's own words, including " +
          "unit if given (e.g. '20 rolls', '50 pieces').",
      },
      customerName: {
        type: "string",
        description: "The customer's name or company name, if given.",
      },
      notes: {
        type: "string",
        description:
          "Any extra details: delivery vs pickup, delivery address, specs " +
          "requested, urgency, etc.",
      },
    },
    required: ["product", "quantity"],
  },
};

function buildSystemPrompt(business: BusinessConfig): string {
  const hours = business.openingHours
    .map((h) =>
      h.closed ? `${h.day}: closed` : `${h.day}: ${h.open}-${h.close}`
    )
    .join("\n");

  const products = business.products
    .map(
      (p) =>
        `- ${p.name}: ${p.description} (sold per ${p.unit}, price: ${p.price})`
    )
    .join("\n");

  const policies = business.policies.map((p) => `- ${p}`).join("\n");

  return `You are the WhatsApp sales assistant for "${business.businessName}", a ${
    business.businessType
  } based at ${business.location.address}.

Your job: answer customer questions and take order/quote requests, 24/7, warmly and efficiently.

LANGUAGE: Always reply in the same language the customer is writing in. You support at least: ${business.supportedLanguages.join(
    ", "
  )}, and should do your best in any other language a customer uses. Default to ${
    business.defaultLanguage
  } only if you cannot detect the customer's language.

BUSINESS INFO
Timezone: ${business.timezone}
Contact: ${business.contact.phoneDisplay} / ${business.contact.email}
Location: ${business.location.address} (${business.location.googleMapsUrl})

OPENING HOURS
${hours}

PRODUCTS
${products}

POLICIES
${policies || "(none listed)"}

ORDER FLOW
1. Understand which product(s) the customer wants, and the quantity.
2. If they ask for a price, quote what's listed above; if a price says
   "on request" or similar, tell them the team will confirm pricing.
3. Once the customer has confirmed a specific product and quantity, call
   the create_order_inquiry tool exactly once to record it.
4. After the tool call, confirm back to the customer in a short, friendly
   message, and let them know the team will follow up to confirm final
   price, stock availability, and delivery/pickup details (do not promise
   a price or delivery time is 100% final).

RULES
- Never invent products, prices, specs, or hours that aren't listed above.
- If a product isn't in the list, say it's not something you carry and
  suggest contacting the business directly.
- If you don't know something, say so and offer the business contact info.
- Keep replies short and natural, like a real WhatsApp conversation, not an email.`;
}

export interface AssistantResult {
  replyText: string;
  orderCreated: boolean;
}

export async function runAssistant(
  business: BusinessConfig,
  customerId: number,
  history: Message[]
): Promise<AssistantResult> {
  const system = buildSystemPrompt(business);

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.direction === "in" ? "user" : "assistant",
    content: m.body,
  }));

  let orderCreated = false;

  // Tool-use loop: keep calling the model until it returns a plain text
  // turn (allowing at most one create_order_inquiry call along the way).
  for (let iteration = 0; iteration < 4; iteration++) {
    const response = await anthropic.messages.create({
      model: env.anthropicModel,
      max_tokens: 1024,
      system,
      tools: [CREATE_ORDER_TOOL],
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      return { replyText: text || "Sorry, could you repeat that?", orderCreated };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      if (block.name === "create_order_inquiry") {
        const input = block.input as {
          product: string;
          quantity: string;
          customerName?: string;
          notes?: string;
        };
        createOrder(
          customerId,
          input.product,
          input.quantity,
          input.notes ?? input.customerName ?? null
        );
        orderCreated = true;
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: "Order inquiry recorded.",
        });
      } else {
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: "Unknown tool.",
          is_error: true,
        });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return {
    replyText:
      "Thanks for your message! Let me get back to you shortly, or feel free to call us directly.",
    orderCreated,
  };
}
