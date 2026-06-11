import { getCollection } from "astro:content";
import createSlug from "../../../lib/createSlug";

export async function getStaticPaths() {
  const entries = await getCollection("blog");
  return entries.map((entry) => ({
    params: { slug: createSlug(entry.data.title, entry.slug) },
    props: { entry },
  }));
}

export async function GET({ props }: { props: any }) {
  const { entry } = props;
  const data = entry.data;

  const post = {
    slug: createSlug(data.title, entry.slug),
    title: data.title,
    description: data.description ?? null,
    pubDate: data.pubDate.toISOString(),
    updatedDate: data.updatedDate ?? null,
    heroImage: data.heroImage ?? null,
    badge: data.badge ?? null,
    tags: data.tags ?? [],
    body: entry.body,
  };

  return new Response(JSON.stringify(post), {
    headers: { "Content-Type": "application/json" },
  });
}
