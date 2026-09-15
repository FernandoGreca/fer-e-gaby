import { extractMetadata } from "./metadata.ts";
import { safeFetch } from "./safe-fetch.ts";
const ADMIN_ID = "8d1f2d09-d1c2-4c7c-ac31-edac11ca8226";
const origins = new Set([
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "https://fernandogreca.github.io",
]);
Deno.serve(async (req: Request) => {
  const origin = req.headers.get("origin") ?? "";
  const allowed = origins.has(origin);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Vary: "Origin",
    "Cache-Control": "no-store",
  };
  if (allowed)
    Object.assign(headers, {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    });
  const reply = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers });
  if (origin && !allowed) return reply({ error: "Origem não permitida." }, 403);
  if (req.method === "OPTIONS")
    return new Response(null, { status: 204, headers });
  if (req.method !== "POST")
    return reply({ error: "Método não permitido." }, 405);
  const token = req.headers.get("authorization");
  if (!token?.startsWith("Bearer "))
    return reply({ error: "Autenticação obrigatória." }, 401);
  // Auth validates the signed JWT on every request; never trust decoded claims.
  try {
    const auth = await fetch(Deno.env.get("SUPABASE_URL") + "/auth/v1/user", {
      headers: {
        Authorization: token,
        apikey: "sb_publishable_h9DYDI5tNHP6m70uGZgs-g_ZKdiPleX",
      },
      signal: AbortSignal.timeout(5000),
    });
    if (!auth.ok) return reply({ error: "Sessão inválida." }, 401);
    const user = await auth.json();
    if (user.id !== ADMIN_ID) return reply({ error: "Acesso restrito." }, 403);
  } catch {
    return reply({ error: "Não foi possível validar a sessão." }, 503);
  }
  try {
    const reader = req.body?.getReader();
    if (!reader) return reply({ error: "Informe o link." }, 400);
    let size = 0;
    const parts: Uint8Array[] = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > 4096) {
        await reader.cancel();
        return reply({ error: "Requisição muito grande." }, 413);
      }
      parts.push(value);
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const p of parts) {
      bytes.set(p, offset);
      offset += p.length;
    }
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (typeof body.url !== "string")
      return reply({ error: "Informe o link." }, 400);
    const page = await safeFetch(body.url);
    return reply(extractMetadata(page.html, page.url));
  } catch {
    return reply({
      warnings: [
        "Não foi possível ler esta loja. Preencha os dados manualmente.",
      ],
    });
  }
});
