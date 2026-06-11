import { getCollection } from "astro:content";
import createSlug from "../../../lib/createSlug";

function parseBody(body: string): { intro: string; summary: string } {
  // Strip the H1 title line
  const withoutTitle = body.replace(/^#\s+.+$/m, "").trim();
  const summaryMatch = withoutTitle.split(/^##\s+Summary/m);
  return {
    intro: summaryMatch[0].trim(),
    summary: summaryMatch[1]?.trim() ?? "",
  };
}

export async function getStaticPaths() {
  const entries = await getCollection("thinking-articles");
  return entries.map((entry) => ({
    params: { slug: createSlug(entry.data.title, entry.slug) },
    props: { entry },
  }));
}

export async function GET({ props }: { props: any }) {
  const { entry } = props;
  const data = entry.data;
  const { intro, summary } = parseBody(entry.body);

  const article = {
    slug: createSlug(data.title, entry.slug),
    title: data.title,
    description: data.description ?? null,
    pubDate: data.pubDate.toISOString(),
    updatedDate: data.updatedDate ?? null,
    heroImage: data.heroImage ?? null,
    badge: data.badge ?? null,
    tags: data.tags ?? [],
    intro,
    summary,
    thoughts: (data.thoughts ?? []).map((t: any) => ({
      id: t.id,
      title: t.title ?? null,
      question: t.question.trim(),
      mine: t.mine.trim(),
      image: t.image ?? null,
    })),
    extra: data.extra?.trim() ?? null,
  };

  return new Response(JSON.stringify(article), {
    headers: { "Content-Type": "application/json" },
  });
}
