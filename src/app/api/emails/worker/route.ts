import { NextResponse } from "next/server";
import { obterIp, rateLimit } from "@/lib/rate-limit";
import { acordarWorkerServer } from "@/lib/fila-emails";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * R15 FASE 4 — caminho rápido do browser até ao worker (a "segunda rota" do
 * R15: o segredo do worker fica server-side, na env var WORKER_SECRET da
 * Vercel — nunca no bundle). O browser não envia emails nem decide
 * destinatários: só "acorda" a drenagem da fila. O worker em si valida o
 * x-worker-secret na Edge Function e a fila é idempotente (skip locked +
 * índice único), pelo que acordos repetidos são inofensivos; o cron da
 * FASE 5 é a garantia de drenagem se este caminho falhar.
 *
 * Resposta: 204 sempre (o browser não deve aprender nada da fila).
 */
export async function POST(request: Request): Promise<NextResponse> {
  const ip = obterIp(request.headers);
  const limite = rateLimit(`emails-worker:${ip}`);
  if (!limite.permitido) return new NextResponse(null, { status: 204 });

  acordarWorkerServer();
  return new NextResponse(null, { status: 204 });
}

export async function GET(): Promise<NextResponse> {
  return NextResponse.json({ ok: false, mensagem: "Método não permitido." }, { status: 405 });
}