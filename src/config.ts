import "dotenv/config";
import fs from "node:fs";
import path from "node:path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 3000),

  whatsappToken: required("WHATSAPP_TOKEN"),
  whatsappPhoneNumberId: required("WHATSAPP_PHONE_NUMBER_ID"),
  whatsappVerifyToken: required("WHATSAPP_VERIFY_TOKEN"),

  anthropicApiKey: required("ANTHROPIC_API_KEY"),
  anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",

  dashboardUsername: process.env.DASHBOARD_USERNAME ?? "admin",
  dashboardPassword: process.env.DASHBOARD_PASSWORD ?? "change-me",

  databaseFile: process.env.DATABASE_FILE ?? "./data/orders.sqlite",
};

export interface OpeningHour {
  day: string;
  open?: string;
  close?: string;
  closed?: boolean;
}

export interface Product {
  name: string;
  description: string;
  unit: string;
  price: string;
}

export interface BusinessConfig {
  businessName: string;
  businessType: string;
  defaultLanguage: string;
  supportedLanguages: string[];
  timezone: string;
  location: { address: string; googleMapsUrl: string };
  contact: { phoneDisplay: string; email: string };
  openingHours: OpeningHour[];
  products: Product[];
  policies: string[];
  greetingMessage: string;
}

const businessConfigPath = path.resolve(process.cwd(), "business.config.json");

export function loadBusinessConfig(): BusinessConfig {
  const raw = fs.readFileSync(businessConfigPath, "utf-8");
  return JSON.parse(raw) as BusinessConfig;
}
