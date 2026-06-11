import { getCollection } from "astro:content";
import createSlug from "../../../lib/createSlug";

export async function GET() {
  const entries = await getCollection("blog", ({ data }) => !data.draft);

  const posts = entries
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
    }));

  return new Response(JSON.stringify(posts), {
    headers: { "Content-Type": "application/json" },
  });
}
