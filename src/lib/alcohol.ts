// Spots expenses that are (probably) alcohol, from the description or a
// receipt line, so members who said they don't drink are unticked by default.
// Same matching rules as categories.ts: accent-free, lower-case, words under
// 5 letters must match whole ("vin" but not "vinted"), longer ones are stems.
import { normalize } from "./categories";

const WORDS = [
  // generic FR / EN
  "alcool", "alcohol", "biere", "beer", "pinte", "pint", "demi", "vin", "vins",
  "wine", "vino", "pinard", "champagne", "cremant", "prosecco", "cava",
  "cidre", "cider", "apero", "aperitif", "digestif", "cocktail", "spritz",
  "mojito", "sangria", "kir", "punch", "shot", "shots", "whisky", "whiskey",
  "vodka", "rhum", "rum", "gin", "tequila", "mezcal", "liqueur", "cognac",
  "armagnac", "calvados", "pastis", "absinthe", "sake", "soju", "caviste",
  "cave a vin", "happy hour", "rose pamplemousse",
  // beers sold in France
  "kronenbourg", "kro", "1664", "heineken", "leffe", "grimbergen", "affligem",
  "pelforth", "desperados", "carlsberg", "tourtel twist", "jupiler", "stella artois",
  "corona", "guinness", "hoegaarden", "chouffe", "duvel", "chimay", "karmeliet",
  "delirium", "goudale", "amstel", "budweiser", "brewdog",
  "paulaner", "cubanisto", "skoll", "edelweiss", "mort subite", 
  // aperitifs / spirits
  "ricard", "pernod", "casanis", "suze", "lillet", "martini", "aperol",
  "campari", "get 27", "chartreuse", "cointreau", "grand marnier", "bailey",
  "jagermeister", "jager", "hennessy", "remy martin", "martell", "courvoisier",
  "absolut", "smirnoff", "grey goose", "poliakov", "eristoff", "bacardi",
  "havana club", "captain morgan", "diplomatico", "kraken", "jack daniel",
  "label 5", "clan campbell", "ballantine", "chivas", "jameson", "johnnie walker",
  "william lawson", "grant s", "glenfiddich", "nikka", "gordon s",
  "hendrick", "tanqueray", "citadelle", "passoa", 
  "get 31", "picon", "byrrh", "dubonnet", "noilly", "st germain", "limoncello",
  // champagne / wine houses and regions
  "moet", "veuve clicquot", "dom perignon", "ruinart", "taittinger", "mumm",
  "laurent perrier", "bollinger", "nicolas feuillatte", "piper heidsieck",
  "pommery", "lanson", "krug", "beaujolais", "muscadet", "sancerre", "chablis",
  "saint emilion", "st emilion", "medoc", "pomerol", "cotes du rhone",
  "chateauneuf", "gewurztraminer", "riesling", "sauternes", "chardonnay",
  "merlot", "cabernet", "pinot", "sauvignon", "syrah", "grenache", "jurancon",
  "monbazillac", "vouvray", "gaillac", "cahors", "picpoul",
  // shops
  "v and b", "v&b", "cavavin", "repaire de bacchus",
];

const RE = new RegExp(
  `(?:^| )(?:${WORDS.map(
    (w) => w.replace(/[&]/g, "\\&") + (w.length < 5 ? "(?= |$)" : ""),
  ).join("|")})`,
);

export function isAlcohol(text: string | null | undefined): boolean {
  const t = normalize(text ?? "");
  return !!t && RE.test(t);
}
