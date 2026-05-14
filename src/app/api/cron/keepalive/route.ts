import { NextResponse, type NextRequest } from "next/server";

import { prisma } from "@/lib/prisma";
import { withCache } from "@/lib/redis";

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await Promise.allSettled([
    prisma.$queryRaw`SELECT 1`,
    // Ping Redis bằng cách set/get một key tạm — giữ connection không bị sleep
    withCache("keepalive:ping", 60, () => Promise.resolve("pong")),
  ]);

  const [db, redis] = results.map((r) => r.status === "fulfilled");

  if (!db) {
    console.error("Keepalive DB ping failed", (results[0] as PromiseRejectedResult).reason);
  }
  if (!redis) {
    console.error("Keepalive Redis ping failed", (results[1] as PromiseRejectedResult).reason);
  }

  return NextResponse.json({
    ok: db,
    redis,
    timestamp: new Date().toISOString(),
  }, { status: db ? 200 : 500 });
}