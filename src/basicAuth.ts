import type { NextFunction, Request, Response } from "express";
import crypto from "node:crypto";
import { env } from "./config";

function timingSafeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export function basicAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (header?.startsWith("Basic ")) {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
    const separatorIndex = decoded.indexOf(":");
    const user = decoded.slice(0, separatorIndex);
    const pass = decoded.slice(separatorIndex + 1);
    if (
      timingSafeEqual(user, env.dashboardUsername) &&
      timingSafeEqual(pass, env.dashboardPassword)
    ) {
      next();
      return;
    }
  }
  res.set("WWW-Authenticate", 'Basic realm="Dashboard"');
  res.sendStatus(401);
}
