import Anthropic from "@anthropic-ai/sdk";
import { env, BusinessConfig } from "./config";
import { Message, createBooking } from "./db";

const anthropic = new Anthropic({ apiKey: env.anthropicApiKey });

const CREATE_BOOKING_TOOL: Anthropic.Tool = {
  name: "create_booking",
  description:
    "Record a confirmed booking request once the customer has given enough " +
    "detail: which service, and a specific date/time. Only call this once " +
    "per booking, after the customer has agreed to the details.",
  input_schema: {
    type: "object",
    properties: {
      service: {
        type: "string",
        description: "The exact service name from the business's service list.",
      },
      requestedTime: {
        type: "string",
        description:
          "The customer's requested date and time, in plain readable text " +
          "(e.g. 'Tomorrow 4pm' or '2026-09-20 16:00'). Use the customer's " +
          "own wording/timezone if a precise time isn't given.",
      },
      customerName: {
        type: "string",
        description: "The customer's name, if they have given it.",
      },
      notes: {
        type: "string",
        description: "Any extra details relevant to the booking.",
      },
    },
    required: ["service", "requestedTime"],
  },
};

function buildSystemPrompt(business: BusinessConfig): string {
  const hours = business.openingHours
    .map((h) =>
      h.closed ? `${h.day}: closed` : `${h.day}: ${h.open}-${h.close}`
    )
    .join("\n");

  const services = business.services
    .map(
      (s) =>
        `- ${s.name}: ${s.description} (duration: ${s.durationMinutes} min, price: ${s.price})`
    )
    .join("\n");

  const policies = business.policies.map((p) => `- ${p}`).join("\n");

  return `You are the WhatsApp booking assistant for "${business.businessName}", ${
    business.location.address
  }.

Your job: answer customer questions and take booking requests, 24/7, warmly and efficiently.

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

SERVICES
${services}

POLICIES
${policies || "(none listed)"}

BOOKING FLOW
1. Understand which service the customer wants.
2. Confirm a specific date and time that falls within opening hours.
3. Once the customer has confirmed both the service and the time, call the
   create_booking tool exactly once to record it.
4. After the tool call, confirm the booking back to the customer in a short,
   friendly message, and remind them the booking is pending confirmation
   from the team (do not claim it is 100% guaranteed).

RULES
- Never invent services, prices, or hours that aren't listed above.
- If you don't know something, say so and offer the business contact info.
- Keep replies short and natural, like a real WhatsApp conversation, not an email.
- If the customer asks for something outside these services, politely say
  it's not offered and suggest contacting the business directly.`;
}

export interface AssistantResult {
  replyText: string;
  bookingCreated: boolean;
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

  let bookingCreated = false;

  // Tool-use loop: keep calling the model until it returns a plain text
  // turn (allowing at most one create_booking call along the way).
  for (let iteration = 0; iteration < 4; iteration++) {
    const response = await anthropic.messages.create({
      model: env.anthropicModel,
      max_tokens: 1024,
      system,
      tools: [CREATE_BOOKING_TOOL],
      messages,
    });

    if (response.stop_reason !== "tool_use") {
      const text = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === "text")
        .map((block) => block.text)
        .join("\n")
        .trim();
      return { replyText: text || "Sorry, could you repeat that?", bookingCreated };
    }

    messages.push({ role: "assistant", content: response.content });

    const toolResults: Anthropic.ToolResultBlockParam[] = [];
    for (const block of response.content) {
      if (block.type !== "tool_use") continue;
      if (block.name === "create_booking") {
        const input = block.input as {
          service: string;
          requestedTime: string;
          customerName?: string;
          notes?: string;
        };
        createBooking(
          customerId,
          input.service,
          input.requestedTime,
          input.notes ?? input.customerName ?? null
        );
        bookingCreated = true;
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: "Booking recorded.",
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
    bookingCreated,
  };
}
