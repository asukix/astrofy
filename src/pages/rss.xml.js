import rss from "@astrojs/rss";
import { SITE_TITLE, SITE_DESCRIPTION } from "../config";
import { getCollection } from "astro:content";
import createSlug from "../lib/createSlug";

const sections = [
  { collection: "blog", path: "blog" },
  { collection: "deep-bits", path: "deep-bits" },
  { collection: "thinking-bits", path: "thinking-bits" },
  { collection: "thinking-articles", path: "thinking-articles" },
];

export async function GET(context) {
  const items = (
    await Promise.all(
      sections.map(async ({ collection, path }) => {
        const entries = (await getCollection(collection)).filter((p) => !p.data.draft);
        return entries.map((entry) => ({
          title: entry.data.title,
          pubDate: entry.data.pubDate,
          description: entry.data.description,
          link: `/${path}/${createSlug(entry.data.title, entry.slug)}/`,
        }));
      })
    )
  )
    .flat()
    .sort((a, b) => b.pubDate.valueOf() - a.pubDate.valueOf());

  return rss({
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    site: import.meta.env.SITE,
    items,
  });
}
