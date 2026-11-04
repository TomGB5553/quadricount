// Optional expense categories. A group turns them on by storing a list of
// category keys (groups.categories); null means the feature is asleep.
// Expenses without a chosen category get one guessed from their description
// with a small keyword list — free, instant, no AI call.

export const CATEGORIES = {
  food: "🍽️",
  groceries: "🛒",
  drinks: "🍻",
  lodging: "🏨",
  transport: "🚕",
  fuel: "⛽",
  activities: "🎟️",
  shopping: "🛍️",
  rent: "🏠",
  bills: "💡",
  household: "🧽",
  health: "💊",
  gifts: "🎁",
  other: "📦",
} as const;

export type CategoryKey = keyof typeof CATEGORIES;

export const isCategory = (k: unknown): k is CategoryKey =>
  typeof k === "string" && k in CATEGORIES;

export const GROUP_TYPES = {
  trip: {
    emoji: "✈️",
    categories: ["food", "drinks", "lodging", "transport", "activities", "groceries", "shopping", "other"],
  },
  home: {
    emoji: "🏠",
    categories: ["rent", "bills", "groceries", "household", "food", "other"],
  },
  couple: {
    emoji: "💞",
    categories: ["groceries", "food", "rent", "bills", "activities", "transport", "other"],
  },
  event: {
    emoji: "🎉",
    categories: ["food", "drinks", "activities", "gifts", "transport", "other"],
  },
  other: {
    emoji: "✨",
    categories: ["food", "groceries", "transport", "activities", "shopping", "other"],
  },
} as const satisfies Record<string, { emoji: string; categories: CategoryKey[] }>;

export type GroupType = keyof typeof GROUP_TYPES;

export const isGroupType = (k: unknown): k is GroupType =>
  typeof k === "string" && k in GROUP_TYPES;

// Lower-case, accent-free word stems (FR + EN). Matched against the start of
// each word in the description, so "restau" catches "restaurant", "restaurants".
const KEYWORDS: Record<Exclude<CategoryKey, "other">, string[]> = {
  groceries: [
    "course", "supermarch", "supermarket", "grocer", "carrefour", "leclerc",
    "auchan", "lidl", "aldi", "intermarche", "monoprix", "franprix", "casino",
    "picard", "biocoop", "marche", "market", "epicerie", "spar", "tesco",
    "mercadona", "continente", "pingo doce", "whole foods",
  ],
  food: [
    "restau", "resto", "dinner", "diner", "dejeuner", "lunch", "breakfast",
    "brunch", "petit dej", "pizza", "burger", "sushi", "kebab", "tacos",
    "mcdo", "mcdonald", "kfc", "boulang", "bakery", "croissant", "sandwich",
    "creperie", "crepe", "brasserie", "bistro", "cafe", "coffee", "starbucks",
    "glace", "ice cream", "snack", "food", "repas", "meal", "uber eats",
    "deliveroo", "takeaway", "ramen", "tapas", "poke", "bouffe",
  ],
  drinks: [
    "bar", "biere", "beer", "pint", "pinte", "vin", "wine", "cocktail",
    "apero", "drink", "boisson", "pub", "club", "boite", "soiree", "shots",
    "champagne", "alcool",
  ],
  lodging: [
    "hotel", "airbnb", "booking", "hostel", "auberge", "gite", "camping",
    "logement", "chambre", "room", "nuit", "night", "appart", "apartment",
    "chalet", "motel", "lodging", "accommodation", "hebergement",
  ],
  transport: [
    "taxi", "uber", "bolt", "train", "sncf", "tgv", "ouigo", "eurostar",
    "flight", "vol", "avion", "plane", "ryanair", "easyjet", "air france",
    "bus", "flixbus", "blablacar", "metro", "tram", "ticket transport",
    "navigo", "ferry", "bateau", "parking", "peage", "toll", "location voiture",
    "car rental", "rental car", "scooter", "velo", "bike", "transport",
  ],
  fuel: ["essence", "carburant", "gasoil", "diesel", "fuel", "petrol", "gas station", "total energies", "station service"],
  activities: [
    "musee", "museum", "cinema", "movie", "film", "concert", "spectacle",
    "show", "theatre", "theater", "ski", "forfait", "excursion", "tour",
    "visite", "visit", "entree", "ticket", "billet", "parc", "park", "zoo",
    "aquarium", "bowling", "karaoke", "escape", "surf", "plongee", "diving",
    "randonnee", "hike", "activite", "activity", "festival", "match",
  ],
  shopping: [
    "shopping", "vetement", "clothes", "souvenir", "zara", "h&m", "decathlon",
    "fnac", "amazon", "ikea", "boutique", "shop",
  ],
  rent: ["loyer", "rent", "caution", "deposit", "charges locatives"],
  bills: [
    "electricite", "electricity", "edf", "engie", "gaz", "eau", "water bill",
    "internet", "wifi", "box", "free", "orange", "sfr", "bouygues", "netflix",
    "spotify", "disney", "abonnement", "subscription", "facture", "bill",
    "assurance", "insurance", "telephone", "phone",
  ],
  household: [
    "menage", "cleaning", "produit", "lessive", "detergent", "papier toilette",
    "toilet paper", "sopalin", "eponge", "vaisselle", "meuble", "furniture",
    "bricolage", "leroy merlin", "castorama", "maison", "household",
  ],
  health: ["pharmacie", "pharmacy", "medecin", "doctor", "docteur", "dentiste", "dentist", "hopital", "hospital", "medicament", "medicine"],
  gifts: ["cadeau", "gift", "present", "anniversaire", "birthday", "fleur", "flower"],
};

const normalize = (s: string) =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9&\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

// Short words must match whole ("bar" not "barcelona"); longer ones are stems.
const MATCHERS = (Object.entries(KEYWORDS) as [CategoryKey, string[]][]).map(
  ([cat, words]) =>
    [
      cat,
      new RegExp(
        `(?:^| )(?:${words
          .map((w) => w.replace(/[&]/g, "\\&") + (w.length < 5 ? "(?= |$)" : ""))
          .join("|")})`,
      ),
    ] as const,
);

// Best guess for a description, limited to the group's categories when given.
export function guessCategory(
  description: string,
  allowed?: readonly string[] | null,
): CategoryKey | null {
  const text = normalize(description);
  if (!text) return null;
  for (const [cat, re] of MATCHERS) {
    if (allowed && !allowed.includes(cat)) continue;
    if (re.test(text)) return cat;
  }
  return null;
}

// The category shown for an expense: the chosen one, else the guess, else "other".
export function categoryOf(
  e: { category?: string | null; description: string },
  allowed?: readonly string[] | null,
): CategoryKey {
  if (isCategory(e.category)) return e.category;
  return guessCategory(e.description, allowed) ?? "other";
}
