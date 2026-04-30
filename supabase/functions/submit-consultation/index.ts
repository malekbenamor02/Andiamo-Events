import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGIN = "https://business.andiamoevents.com";

type ConsultationPayload = {
  full_name?: unknown;
  company?: unknown;
  service?: unknown;
  vision?: unknown;
  contact_email?: unknown;
  contact_phone?: unknown;
  /** Optional anti-bot field; must be empty (not stored). */
  honeypot?: unknown;
  client_elapsed_ms?: unknown;
  user_agent?: unknown;
};

function corsHeaders(origin: string | null): HeadersInit {
  const safeOrigin = origin === ALLOWED_ORIGIN ? origin : ALLOWED_ORIGIN;
  return {
    "Access-Control-Allow-Origin": safeOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
  };
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  return value.trim();
}

function asOptionalTrimmedString(value: unknown): string | null {
  const v = asTrimmedString(value);
  if (!v) return null;
  return v;
}

function isValidEmail(value: string): boolean {
  return /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(value);
}

function isValidTunisiaPhone(value: string): boolean {
  return /^\+216[2459][0-9]{7}$/.test(value);
}

function normalizeTunisiaPhone(value: string | null): string | null {
  if (!value) return null;
  const digitsOnly = value.replace(/\s+/g, "");
  if (/^[2459][0-9]{7}$/.test(digitsOnly)) {
    return `+216${digitsOnly}`;
  }
  return digitsOnly;
}

function sanitizePayload(body: ConsultationPayload) {
  const fullName = asTrimmedString(body.full_name);
  const company = asOptionalTrimmedString(body.company);
  const service = asTrimmedString(body.service);
  const vision = asOptionalTrimmedString(body.vision);
  const contactEmail = asOptionalTrimmedString(body.contact_email);
  const contactPhone = normalizeTunisiaPhone(asOptionalTrimmedString(body.contact_phone));
  const honeypot = asTrimmedString(body.honeypot) ?? "";
  const clientElapsedMsRaw = Number(body.client_elapsed_ms ?? 0);
  const userAgent = asOptionalTrimmedString(body.user_agent);

  if (!fullName || fullName.length < 2 || fullName.length > 120) {
    throw new Error("Invalid full_name");
  }
  if (company && (company.length < 2 || company.length > 220)) {
    throw new Error("Invalid company");
  }
  if (!service || service.length < 2 || service.length > 120) {
    throw new Error("Invalid service");
  }
  if (vision && (vision.length < 10 || vision.length > 4000)) {
    throw new Error("Invalid vision");
  }
  if (contactEmail && !isValidEmail(contactEmail)) {
    throw new Error("Invalid contact_email");
  }
  if (contactPhone && !isValidTunisiaPhone(contactPhone)) {
    throw new Error("Invalid contact_phone");
  }
  if (honeypot.length !== 0) {
    throw new Error("Spam detected");
  }
  if (!Number.isFinite(clientElapsedMsRaw) || clientElapsedMsRaw < 1500 || clientElapsedMsRaw > 1800000) {
    throw new Error("Invalid client_elapsed_ms");
  }
  if (userAgent && userAgent.length > 512) {
    throw new Error("Invalid user_agent");
  }

  return {
    full_name: fullName,
    company,
    service,
    vision,
    contact_email: contactEmail,
    contact_phone: contactPhone,
    client_elapsed_ms: Math.round(clientElapsedMsRaw),
    user_agent: userAgent,
  };
}

Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const headers = corsHeaders(origin);

  if (origin && origin !== ALLOWED_ORIGIN) {
    return new Response(JSON.stringify({ error: "Origin not allowed" }), {
      status: 403,
      headers,
    });
  }

  if (req.method === "OPTIONS") {
    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Server configuration error" }), {
        status: 500,
        headers,
      });
    }

    const body = (await req.json()) as ConsultationPayload;
    const payload = sanitizePayload(body);

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { error } = await adminClient.from("consultation_inquiries").insert(payload);
    if (error) {
      return new Response(JSON.stringify({ error: "Database insert failed" }), {
        status: 500,
        headers,
      });
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers,
    });
  }
});
