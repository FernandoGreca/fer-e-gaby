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
const gallery = await db.from("gallery_photos").select("*");
assert.equal(gallery.error, null);
const admin = await db.rpc("is_admin");
assert.equal(admin.data, false);
for (const table of ["gallery_photos", "gallery_cleanup"]) {
  const result = await db.from(table).insert({
    object_path: "00000000-0000-4000-8000-000000000001.webp",
    photo_date: "2026-09-15",
  });
  assert.ok(result.error, "Public gallery writes must be denied");
}
const upload = await db.storage
  .from("couple-gallery")
  .upload(
    "00000000-0000-4000-8000-000000000001.webp",
    new Blob(["denied"], { type: "image/webp" }),
  );
assert.ok(upload.error, "Anonymous storage upload must be denied");
console.log(
  "PASS: public lists/gallery, denied writes/storage upload, admin RPC false, signup disabled, invalid login.",
);
