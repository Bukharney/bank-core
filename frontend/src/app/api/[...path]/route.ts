import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function handler(
  req: NextRequest,
  { params }: { params: { path?: string[] } }
) {
  const pathSegments = params?.path || [];
  const search = req.nextUrl.search;

  // Read environment variables dynamically at request runtime
  const backendBase = (process.env.BACKEND_URL || "http://backend:8080").replace(/\/$/, "");
  const atm1Base = (process.env.ATM_1_URL || "http://atm:8081/atm").replace(/\/$/, "");
  const atm2Base = (process.env.ATM_2_URL || "http://atm:8082/atm").replace(/\/$/, "");
  const atm3Base = (process.env.ATM_3_URL || "http://atm:8083/atm").replace(/\/$/, "");

  let targetUrl = "";

  // 1. ATM Routes: /api/atm/[1|2|3]/...
  if (pathSegments[0] === "atm" && pathSegments.length >= 2) {
    const atmId = pathSegments[1];
    const subPath = pathSegments.slice(2).join("/");

    let atmBase = atm1Base;
    if (atmId === "2") atmBase = atm2Base;
    if (atmId === "3") atmBase = atm3Base;

    targetUrl = subPath ? `${atmBase}/${subPath}${search}` : `${atmBase}${search}`;
  } else {
    // 2. Core Banking Backend Routes: /api/... -> backendBase/...
    const targetPath = pathSegments.join("/");
    targetUrl = `${backendBase}/${targetPath}${search}`;
  }

  // Forward incoming headers (except host)
  const forwardHeaders = new Headers(req.headers);
  forwardHeaders.delete("host");

  const method = req.method;
  const hasBody = method !== "GET" && method !== "HEAD";

  let body: ArrayBuffer | null = null;
  if (hasBody) {
    try {
      body = await req.arrayBuffer();
    } catch {
      body = null;
    }
  }

  try {
    const backendRes = await fetch(targetUrl, {
      method,
      headers: forwardHeaders,
      body,
      cache: "no-store",
      redirect: "manual",
    });

    const resHeaders = new Headers(backendRes.headers);

    return new Response(backendRes.body, {
      status: backendRes.status,
      statusText: backendRes.statusText,
      headers: resHeaders,
    });
  } catch (err: any) {
    console.error(`[API Proxy] Failed to proxy to ${targetUrl}:`, err?.message || err);
    return NextResponse.json(
      {
        error: "Failed to connect to backend service",
        target: targetUrl,
        message: err?.message || String(err),
      },
      { status: 502 }
    );
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
export const OPTIONS = handler;
