// Seed script: creates a set of trip groups with overlapping members,
// complete user profiles (incl. IBAN) and randomised expenses.
//
// Needs the Supabase SERVICE ROLE key (bypasses RLS + can create auth users).
// Add it to .env.local as SUPABASE_SERVICE_ROLE_KEY=... (Dashboard →
// Project Settings → API → service_role secret), then run:
//   node scripts/seed-test-data.mjs
//
// Re-running is safe: the 5 groups below are dropped and rebuilt each time,
// and users are reused if they already exist. Every seeded account uses the
// password  demo12345  and logs in with its username (alice, ben, ...).

import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// env
// ---------------------------------------------------------------------------
const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trimStart().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY =
  env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!URL_ || !SERVICE_KEY) {
  console.error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local",
  );
  process.exit(1);
}

const db = createClient(URL_, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = "demo12345";

// deterministic PRNG so re-runs produce the same numbers
let _s = 20260902;
const rnd = () => {
  _s = (_s * 1664525 + 1013904223) % 4294967296;
  return _s / 4294967296;
};
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const between = (lo, hi) => lo + Math.floor(rnd() * (hi - lo + 1));
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// ---------------------------------------------------------------------------
// people
// ---------------------------------------------------------------------------
const PEOPLE = [
  { username: "alice", name: "Alice Martin", cur: "EUR", iban: "FR7630006000011234567890189", note: "Compte courant BNP" },
  { username: "ben", name: "Ben Carter", cur: "GBP", iban: "GB29NWBK60161331926819", note: "Revolut · @bencarter" },
  { username: "chloe", name: "Chloé Dubois", cur: "EUR", iban: "FR1420041010050500013M02606", note: "La Banque Postale" },
  { username: "david", name: "David Kim", cur: "EUR", iban: "DE89370400440532013000", note: "N26" },
  { username: "emma", name: "Emma Rossi", cur: "EUR", iban: "IT60X0542811101000000123456", note: "Intesa Sanpaolo" },
  { username: "felix", name: "Felix Weber", cur: "EUR", iban: "DE75512108001245126199", note: "Sparkasse" },
  { username: "gina", name: "Gina Lopez", cur: "EUR", iban: "ES9121000418450200051332", note: "CaixaBank · Bizum 600123123" },
  { username: "hugo", name: "Hugo Bernard", cur: "EUR", iban: "FR7612548029989876543210917", note: "Crédit Agricole" },
  { username: "iris", name: "Iris Nguyen", cur: "EUR", iban: "BE68539007547034", note: "KBC" },
  { username: "jack", name: "Jack O'Brien", cur: "EUR", iban: "IE29AIBK93115212345678", note: "AIB · Revolut @jackob" },
  { username: "karim", name: "Karim Haddad", cur: "EUR", iban: "FR7630003035409876543210925", note: "Société Générale" },
  { username: "lena", name: "Lena Schmidt", cur: "EUR", iban: "DE21500105171234567890", note: "DKB" },
  { username: "mia", name: "Mia Andersson", cur: "EUR", iban: "SE4550000000058398257466", note: "Swish 070 123 45 67" },
  { username: "noah", name: "Noah Silva", cur: "EUR", iban: "PT50000201231234567890154", note: "Millennium BCP · MB WAY" },
  { username: "omar", name: "Omar Farouk", cur: "EUR", iban: "NL91ABNA0417164300", note: "ABN AMRO · Tikkie" },
  { username: "paula", name: "Paula Costa", cur: "EUR", iban: "PT50003300004567890123405", note: "Novo Banco" },
];

// existing real dev account — folded into a couple of groups so you see data
const REAL_USER_EMAIL = "myloreb+dev@gmail.com";

// ---------------------------------------------------------------------------
// groups  (members[0] is the owner)
// ---------------------------------------------------------------------------
const GROUPS = [
  {
    name: "Lisbon City Break",
    currency: "EUR",
    members: ["alice", "ben", "chloe", "david", "emma", "__real__"],
    items: [
      ["Airbnb in Alfama (3 nights)", 46200],
      ["Flights leftover — bag fees", 8400],
      ["Time Out Market dinner", 9750],
      ["Tram 28 day passes", 3000],
      ["Pastéis de Belém", 1840],
      ["Fado night + drinks", 12600],
      ["Uber to Sintra", 4200],
      ["Pena Palace tickets", 8500],
      ["Groceries for breakfasts", 3620],
      ["Ginjinha crawl", 2700],
      ["Seafood lunch in Cascais", 11480],
      ["Airport taxi home", 3900],
    ],
  },
  {
    name: "Alps Ski Trip",
    currency: "EUR",
    members: ["ben", "alice", "felix", "gina", "hugo", "iris"],
    items: [
      ["Chalet rental (week)", 168000],
      ["6-day lift passes", 174000],
      ["Ski + boot hire", 96000],
      ["Supermarket run — Annecy", 21450],
      ["Raclette night", 8600],
      ["Vin chaud on the slopes", 4200],
      ["Diesel for the van", 15800],
      ["Highway tolls", 6740],
      ["Mountain restaurant lunch", 13900],
      ["Après-ski bar tab", 9100],
      ["Pharmacy — someone's knee", 2380],
      ["Cheese to bring home", 4750],
    ],
  },
  {
    name: "Tokyo Adventure",
    currency: "EUR",
    members: ["chloe", "david", "jack", "karim", "lena", "alice"],
    items: [
      ["Hotel Shinjuku (5 nights)", 71000],
      ["7-day JR passes", 128000],
      ["Robot Restaurant show", 22000],
      ["Sushi omakase — Tsukiji", 30800],
      ["Konbini snacks & coffee", 5400],
      ["teamLab Planets tickets", 13600],
      ["Karaoke night in Shibuya", 8900],
      ["Ramen in Kyoto", 4620],
      ["Shinkansen reserved seats", 9800],
      ["Izakaya crawl", 15200],
      ["Pocket wifi rental", 3500],
      ["Souvenirs from Nakamise", 6100],
      ["Onsen day trip — Hakone", 11700],
    ],
  },
  {
    name: "Barcelona Weekend",
    currency: "EUR",
    members: ["emma", "felix", "mia", "noah", "gina", "__real__"],
    items: [
      ["Apartment near Gràcia (2 nights)", 28800],
      ["Sagrada Família tickets", 11200],
      ["Tapas + vermut in El Born", 9640],
      ["Beach club sunbeds", 6000],
      ["Metro T-Casual cards", 4480],
      ["Paella lunch in Barceloneta", 13100],
      ["Park Güell entry", 4000],
      ["Brunch in Gràcia", 5220],
      ["Club entry Saturday", 8000],
      ["Airport aerobus", 2380],
      ["Late-night pizza", 3160],
    ],
  },
  {
    name: "Iceland Road Trip",
    currency: "EUR",
    members: ["hugo", "iris", "karim", "omar", "paula", "ben", "jack"],
    items: [
      ["4x4 camper rental (8 days)", 246000],
      ["Fuel — full ring road", 38600],
      ["Blue Lagoon entry", 27000],
      ["Bónus groceries x4", 41200],
      ["Glacier hike guide", 34500],
      ["Campsite fees", 12600],
      ["Whale watching — Húsavík", 29800],
      ["Soup in a bread bowl x7", 8750],
      ["Hot dogs at Bæjarins Beztu", 3080],
      ["Icelandic wool sweaters", 22400],
      ["Road tunnel toll", 1900],
      ["Firewood + gas refill", 4300],
      ["Farewell dinner Reykjavík", 19600],
    ],
  },
];

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
async function findUserByEmail(email) {
  // paginate through auth users (small project, a couple pages max)
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const hit = data.users.find(
      (u) => (u.email || "").toLowerCase() === email.toLowerCase(),
    );
    if (hit) return hit;
    if (data.users.length < 200) return null;
  }
  return null;
}

async function ensureUser(p) {
  const email = `${p.username}@quadricount.app`;
  let user = await findUserByEmail(email);
  if (!user) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { username: p.username, display_name: p.name },
    });
    if (error) throw new Error(`create ${p.username}: ${error.message}`);
    user = data.user;
    console.log(`  + created ${p.username}`);
  } else {
    console.log(`  · reusing ${p.username}`);
  }

  // profile: make sure the display name / currency / username are set
  const { error: pe } = await db
    .from("profiles")
    .update({
      display_name: p.name,
      username: p.username,
      preferred_currency: p.cur,
    })
    .eq("id", user.id);
  if (pe) throw new Error(`profile ${p.username}: ${pe.message}`);

  // payout details (IBAN + note)
  const { error: oe } = await db
    .from("payout_details")
    .upsert({ user_id: user.id, iban: p.iban, payment_note: p.note });
  if (oe) throw new Error(`payout ${p.username}: ${oe.message}`);

  return user.id;
}

// even split with largest-remainder rounding (mirrors create_expense)
function equalSplit(total, memberIds) {
  const n = memberIds.length;
  const base = Math.floor(total / n);
  let rem = total - base * n;
  // deterministic: give the extra cents to a stable ordering
  const ordered = [...memberIds].sort();
  return ordered.map((id) => ({
    member_id: id,
    amount: base + (rem-- > 0 ? 1 : 0),
  }));
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
console.log("1. users + profiles + IBANs");
const idByUsername = {};
for (const p of PEOPLE) idByUsername[p.username] = await ensureUser(p);

const real = await findUserByEmail(REAL_USER_EMAIL);
if (real) {
  idByUsername.__real__ = real.id;
  console.log(`  · found real account ${REAL_USER_EMAIL} → in 2 groups`);
} else {
  console.log(`  ! ${REAL_USER_EMAIL} not found — skipping __real__ slots`);
}

const nameByUsername = Object.fromEntries(
  PEOPLE.map((p) => [p.username, p.name]),
);
nameByUsername.__real__ = "Moi";

console.log("2. groups + members + expenses");
const today = new Date();
const daysAgo = (d) => {
  const x = new Date(today);
  x.setDate(x.getDate() - d);
  return x.toISOString().slice(0, 10);
};

for (const g of GROUPS) {
  const usernames = g.members.filter((u) => idByUsername[u]);
  const ownerUsername = usernames[0];
  const ownerId = idByUsername[ownerUsername];

  // fresh start: drop any existing group with this name (cascades to members,
  // expenses, payers, allocations, settlements)
  const { data: existing } = await db
    .from("groups")
    .select("id")
    .eq("name", g.name);
  for (const row of existing ?? []) {
    await db.from("groups").delete().eq("id", row.id);
  }

  const { data: grp, error: ge } = await db
    .from("groups")
    .insert({
      name: g.name,
      default_currency: g.currency,
      created_by: ownerId,
    })
    .select("id")
    .single();
  if (ge) throw new Error(`group ${g.name}: ${ge.message}`);

  // members
  const memberIdByUsername = {};
  const memberRows = usernames.map((u, i) => ({
    group_id: grp.id,
    user_id: idByUsername[u],
    display_name: nameByUsername[u],
    role: i === 0 ? "owner" : "member",
    status: "active",
  }));
  const { data: mem, error: me } = await db
    .from("group_members")
    .insert(memberRows)
    .select("id, user_id");
  if (me) throw new Error(`members ${g.name}: ${me.message}`);
  for (const m of mem) {
    const un = usernames.find((u) => idByUsername[u] === m.user_id);
    memberIdByUsername[un] = m.id;
  }
  const allMemberIds = mem.map((m) => m.id);

  // expenses
  let dayCursor = between(20, 40);
  for (const [desc, amount] of g.items) {
    dayCursor -= between(1, 3);
    const spentAt = daysAgo(Math.max(dayCursor, 1));

    const payerUsername = pick(usernames);
    const payerMemberId = memberIdByUsername[payerUsername];

    // most expenses hit everyone; some hit a random subset of 3+
    let participants = allMemberIds;
    if (rnd() < 0.35 && allMemberIds.length > 3) {
      const k = between(3, allMemberIds.length - 1);
      participants = shuffle(allMemberIds).slice(0, k);
      if (!participants.includes(payerMemberId)) participants.push(payerMemberId);
    }

    const { data: exp, error: ee } = await db
      .from("expenses")
      .insert({
        group_id: grp.id,
        description: desc,
        total_amount: amount,
        currency: g.currency,
        spent_at: spentAt,
        created_by: idByUsername[payerUsername],
      })
      .select("id")
      .single();
    if (ee) throw new Error(`expense "${desc}" in ${g.name}: ${ee.message}`);

    const { error: pae } = await db
      .from("expense_payers")
      .insert({ expense_id: exp.id, member_id: payerMemberId, amount });
    if (pae) throw new Error(`payer "${desc}": ${pae.message}`);

    const { error: ale } = await db.from("expense_allocations").insert(
      equalSplit(amount, participants).map((a) => ({
        expense_id: exp.id,
        ...a,
      })),
    );
    if (ale) throw new Error(`alloc "${desc}": ${ale.message}`);
  }

  // one or two part-payments already made back
  const settleCount = between(1, 2);
  for (let i = 0; i < settleCount; i++) {
    const [a, b] = shuffle(usernames).slice(0, 2);
    if (!a || !b) break;
    await db.from("settlements").insert({
      group_id: grp.id,
      from_member: memberIdByUsername[a],
      to_member: memberIdByUsername[b],
      amount: between(1500, 9000),
      currency: g.currency,
      settled_at: daysAgo(between(1, 6)),
      note: "Virement",
      source: "manual_payment",
      created_by: idByUsername[a],
    });
  }

  console.log(
    `  + ${g.name}: ${usernames.length} members, ${g.items.length} expenses`,
  );
}

console.log("\nDone. Log in with any username below · password: demo12345");
console.log("  " + PEOPLE.map((p) => p.username).join(", "));
