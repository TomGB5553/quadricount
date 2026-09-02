// One shareable demo group: "Trip to Brazil", 7 members, ~7 days of expenses.
// Tom = the owner (the myloreb+dev account); the other 6 are placeholder
// members your friends claim when they open the invite link.
//
//   node scripts/seed-brazil-trip.mjs
//
// Needs SUPABASE_SERVICE_ROLE_KEY in .env.local. Re-running drops and
// rebuilds the group. Prints the invite URL at the end.

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const db = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const GROUP_NAME = "Trip to Brazil";
const CURRENCY = "EUR";
const OWNER_EMAIL = "myloreb+dev@gmail.com";
const OWNER_NAME = "Tom";
const PLACEHOLDERS = ["Louna", "Nathan", "Andy", "Justin", "Julia", "Nicolas"];
const SHARE_ORIGIN = "https://quadricount.vercel.app";

// deterministic PRNG
let _s = 424242;
const rnd = () => ((_s = (_s * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = (a) => a[Math.floor(rnd() * a.length)];
const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// day (0-6), description, total (cents), who splits it, [optional payers]
//   who:    "all" = everyone; or a list of names
//   payers: names who fronted it (split equally); omitted -> round-robin
const ITEMS = [
  [0, "Airbnb Copacabana (7 nights)", 154000, "all", ["Nathan", "Julia"]],
  [0, "Taxi from GIG airport (2 cars)", 8600, "all"],
  [0, "Supermarket run — water, snacks, beer", 5240, "all"],
  [0, "Welcome caipirinhas on the beach", 4200, "all"],
  [1, "Sugarloaf cable car tickets", 15400, "all"],
  [1, "Lunch at Praia Vermelha", 9800, "all"],
  [1, "Beach chairs, umbrella & coconuts", 3600, "all"],
  [2, "Christ the Redeemer — van + tickets", 18900, "all"],
  [2, "Açaí bowls in Ipanema", 3150, ["Louna", "Julia", "Tom", "Nathan"]],
  [2, "Feijoada dinner + caipirinhas", 21600, "all"],
  [3, "Favela walking tour (guide)", 14000, "all"],
  [3, "Uber rides around Zona Sul", 4780, "all"],
  [3, "Lapa bar crawl", 12300, ["Nathan", "Andy", "Justin", "Nicolas", "Tom"]],
  [4, "Bus tickets Rio → Paraty", 16800, "all"],
  [4, "Pousada in Paraty (2 nights)", 44000, "all", ["Andy"]],
  [4, "Seafood moqueca dinner", 15900, "all"],
  [5, "Schooner boat trip + snorkeling", 26600, "all", ["Louna"]],
  [5, "Cachaça distillery tasting", 5600, ["Andy", "Justin", "Nicolas", "Tom", "Julia"]],
  [5, "Beach picnic supplies", 3900, "all"],
  [6, "Bus back to Rio", 16800, "all"],
  [6, "Farewell rooftop dinner", 28400, "all"],
  [6, "Airport taxi + snacks", 7300, "all"],
];

function isoDaysAgo(base, offset) {
  const d = new Date(base);
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function equalSplit(total, ids) {
  const n = ids.length;
  const base = Math.floor(total / n);
  let rem = total - base * n;
  return [...ids]
    .sort()
    .map((id) => ({ member_id: id, amount: base + (rem-- > 0 ? 1 : 0) }));
}

// ---------------------------------------------------------------------------

const { data: userList, error: ulErr } = await db.auth.admin.listUsers({
  page: 1,
  perPage: 200,
});
if (ulErr) throw ulErr;
const owner = userList.users.find(
  (u) => (u.email || "").toLowerCase() === OWNER_EMAIL,
);
if (!owner) throw new Error(`owner account ${OWNER_EMAIL} not found`);

// fresh start — drop any existing group(s) with this name.
// expense_allocations.member_id -> group_members has no cascade, so clear
// expenses (cascades to payers/allocations/components) before the group.
const { data: stale } = await db
  .from("groups")
  .select("id")
  .eq("name", GROUP_NAME);
for (const s of stale ?? []) {
  await db.from("expenses").delete().eq("group_id", s.id);
  await db.from("settlements").delete().eq("group_id", s.id);
  const { error: de } = await db.from("groups").delete().eq("id", s.id);
  if (de) throw new Error(`cleanup: ${de.message}`);
}

const { data: grp, error: gErr } = await db
  .from("groups")
  .insert({ name: GROUP_NAME, default_currency: CURRENCY, created_by: owner.id })
  .select("id")
  .single();
if (gErr) throw gErr;

// members: owner first
const { data: ownerMember, error: omErr } = await db
  .from("group_members")
  .insert({
    group_id: grp.id,
    user_id: owner.id,
    display_name: OWNER_NAME,
    role: "owner",
    status: "active",
  })
  .select("id")
  .single();
if (omErr) throw omErr;

const { data: placeholders, error: phErr } = await db
  .from("group_members")
  .insert(
    PLACEHOLDERS.map((name) => ({
      group_id: grp.id,
      display_name: name,
      role: "member",
      status: "active",
    })),
  )
  .select("id, display_name");
if (phErr) throw phErr;

const idByName = { [OWNER_NAME]: ownerMember.id };
for (const p of placeholders) idByName[p.display_name] = p.id;
const allNames = [OWNER_NAME, ...PLACEHOLDERS];

// round-robin payer order (shuffled once) so everyone fronts a fair share
const payerOrder = shuffle(allNames);
let payerCursor = 0;

// tripStart = 9 days ago so all dates are in the past
const tripStart = isoDaysAgo(new Date(), -9);

for (const [day, desc, total, who, explicitPayers] of ITEMS) {
  const spentAt = isoDaysAgo(tripStart, day);
  const participantNames = who === "all" ? allNames : who;
  const participantIds = participantNames.map((n) => idByName[n]);

  // who fronted the money
  let payerNames;
  if (explicitPayers) {
    payerNames = explicitPayers;
  } else {
    // next person in the rotation who's actually part of this expense
    for (let k = 0; k < payerOrder.length; k++) {
      const cand = payerOrder[(payerCursor + k) % payerOrder.length];
      if (participantNames.includes(cand)) {
        payerNames = [cand];
        payerCursor = (payerCursor + k + 1) % payerOrder.length;
        break;
      }
    }
  }
  const payerRows = equalSplit(
    total,
    payerNames.map((n) => idByName[n]),
  );

  const { data: exp, error: eErr } = await db
    .from("expenses")
    .insert({
      group_id: grp.id,
      description: desc,
      total_amount: total,
      currency: CURRENCY,
      spent_at: spentAt,
      created_by: owner.id,
    })
    .select("id")
    .single();
  if (eErr) throw new Error(`${desc}: ${eErr.message}`);

  const { error: pErr } = await db
    .from("expense_payers")
    .insert(payerRows.map((p) => ({ expense_id: exp.id, ...p })));
  if (pErr) throw new Error(`${desc} payer: ${pErr.message}`);

  const { error: aErr } = await db
    .from("expense_allocations")
    .insert(equalSplit(total, participantIds).map((a) => ({ expense_id: exp.id, ...a })));
  if (aErr) throw new Error(`${desc} alloc: ${aErr.message}`);

  const { data: comp, error: cErr } = await db
    .from("expense_split_components")
    .insert({ expense_id: exp.id, method: "equal", basis: "remainder", amount: null, seq: 1 })
    .select("id")
    .single();
  if (cErr) throw new Error(`${desc} component: ${cErr.message}`);

  const { error: seErr } = await db.from("expense_split_entries").insert(
    participantIds.map((member_id) => ({
      component_id: comp.id,
      member_id,
      weight: null,
      percent: null,
      exact_amount: null,
    })),
  );
  if (seErr) throw new Error(`${desc} entries: ${seErr.message}`);
}

// reusable group-level invite link
const { data: invite, error: iErr } = await db
  .from("group_invitations")
  .insert({ group_id: grp.id, member_id: null, invited_by: owner.id })
  .select("token")
  .single();
if (iErr) throw iErr;

console.log(`\n"${GROUP_NAME}" created — ${ITEMS.length} expenses over 7 days.`);
console.log(`Members: ${allNames.join(", ")} (Tom = you)`);
console.log(`\nShare this link with your friends:`);
console.log(`  ${SHARE_ORIGIN}/invite/${invite.token}`);
console.log(
  `\nThey sign up (any username + password), open the link, and pick which\nname they are ("I'm Louna", etc.).`,
);
