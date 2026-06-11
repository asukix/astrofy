import { getCollection } from "astro:content";
import createSlug from "../../../lib/createSlug";

export async function GET() {
  const entries = await getCollection("thinking-articles", ({ data }) => !data.draft);

  const articles = entries
    .sort((a, b) => b.data.pubDate.valueOf() - a.data.pubDate.valueOf())
    .map((entry) => ({
      slug: createSlug(entry.data.title, entry.slug),
      title: entry.data.title,
      description: entry.data.description ?? null,
      pubDate: entry.data.pubDate.toISOString(),
      updatedDate: entry.data.updatedDate ?? null,
      heroImage: entry.data.heroImage ?? null,
      badge: entry.data.badge ?? null,
      tags: entry.data.tags ?? [],
      thoughtCount: (entry.data.thoughts ?? []).length,
    }));

  return new Response(JSON.stringify(articles), {
    headers: { "Content-Type": "application/json" },
  });
}
