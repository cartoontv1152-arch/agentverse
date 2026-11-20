import { SourceRegistry, wikipediaSearch, hackerNewsSearch } from "@/lib/ai/research";
const r = new SourceRegistry();
console.time("wiki");
console.log(JSON.stringify(await wikipediaSearch(process.argv[2] ?? "Lisbon tram 28", r).catch((e) => ({ err: String(e) })), null, 1).slice(0, 1500));
console.timeEnd("wiki");
console.time("hn");
console.log(JSON.stringify(await hackerNewsSearch("Lisbon", r).catch((e) => ({ err: String(e) }))).slice(0, 500));
console.timeEnd("hn");
