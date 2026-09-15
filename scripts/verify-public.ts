import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_KEY } from "../src/lib/config";
const db = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});
const { data: lists, error } = await db
  .from("wishlists")
  .select("*")
  .order("position");
assert.equal(error, null);
assert.deepEqual(
  lists?.map((l) => l.display_name),
  ["Lista presentes Fer", "Lista presentes Gaby"],
);
const read = await db.from("gifts").select("*");
assert.equal(read.error, null);
const insert = await db.from("gifts").insert({
  wishlist_id: lists![0].id,
  name: "Unauthorized test",
  product_url: "https://example.com",
});
assert.ok(insert.error, "Anonymous INSERT must be denied");
for (const method of ["PATCH", "DELETE"]) {
  const response = await fetch(
    SUPABASE_URL + "/rest/v1/gifts?id=eq.00000000-0000-4000-8000-000000000000",
    {
      method,
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: method === "PATCH" ? JSON.stringify({ name: "Denied" }) : undefined,
    },
  );
  assert.ok(
    response.status === 401 || response.status === 403,
    "Anonymous " + method + " must be denied",
  );
}
const settings = await fetch(SUPABASE_URL + "/auth/v1/settings", {
  headers: { apikey: SUPABASE_KEY },
}).then((r) => r.json());
assert.equal(settings.disable_signup, true);
const invalid = await db.auth.signInWithPassword({
  email: "invalid-test@example.invalid",
  password: "deliberately-invalid-test-password",
});
assert.ok(invalid.error);
const edge = await fetch(SUPABASE_URL + "/functions/v1/extract-product", {
  method: "POST",
  headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ url: "https://example.com" }),
});
assert.equal(edge.status, 401);
const cors = await fetch(SUPABASE_URL + "/functions/v1/extract-product", {
  method: "OPTIONS",
  headers: { Origin: "https://untrusted.example" },
});
assert.equal(cors.status, 403);
console.log(
  "PASS: public reads, denied writes, disabled signup, invalid login, Edge auth and CORS.",
);
