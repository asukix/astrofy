import { z, defineCollection } from "astro:content";
const blogSchema = z.object({
    title: z.string(),
    description: z.string().nullable().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.string().optional(),
    heroImage: z.string().optional(),
    badge: z.string().optional(),
    draft: z.boolean().optional(),
    thinkingArticle: z.string().optional(),
    tags: z.array(z.string()).refine(items => new Set(items).size === items.length, {
        message: 'tags must be unique',
    }).optional(),
});

const thoughtSchema = z.object({
    id: z.number(),
    title: z.string().optional(),
    question: z.string(),
    mine: z.string(),
    image: z.string().optional(),
    mineImage: z.string().optional(),
});

const thinkingArticleSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.string().optional(),
    heroImage: z.string().optional(),
    badge: z.string().optional(),
    draft: z.boolean().optional(),
    tags: z.array(z.string()).refine(items => new Set(items).size === items.length, {
        message: 'tags must be unique',
    }).optional(),
    thoughts: z.array(thoughtSchema).optional(),
    extra: z.string().optional(),
});

const storeSchema = z.object({
    title: z.string(),
    description: z.string(),
    custom_link_label: z.string(),
    custom_link: z.string().optional(),
    updatedDate: z.coerce.date(),
    pricing: z.string().optional(),
    oldPricing: z.string().optional(),
    badge: z.string().optional(),
    checkoutUrl: z.string().optional(),
    heroImage: z.string().optional(),
});

export type BlogSchema = z.infer<typeof blogSchema>;
export type StoreSchema = z.infer<typeof storeSchema>;
export type ThinkingArticleSchema = z.infer<typeof thinkingArticleSchema>;
export type ThoughtSchema = z.infer<typeof thoughtSchema>;

const deepBitsSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.string().optional(),
    badge: z.string().optional(),
    draft: z.boolean().optional(),
    tags: z.array(z.string()).refine(items => new Set(items).size === items.length, {
        message: 'tags must be unique',
    }).optional(),
    thinkingBit: z.string().optional(),
});

export type DeepBitsSchema = z.infer<typeof deepBitsSchema>;

const thinkingBitsSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    pubDate: z.coerce.date(),
    updatedDate: z.string().optional(),
    heroImage: z.string().optional(),
    badge: z.string().optional(),
    draft: z.boolean().optional(),
    tags: z.array(z.string()).refine(items => new Set(items).size === items.length, {
        message: 'tags must be unique',
    }).optional(),
    thoughts: z.array(thoughtSchema).optional(),
    extra: z.string().optional(),
});

export type ThinkingBitsSchema = z.infer<typeof thinkingBitsSchema>;

// Projekt-aloldalak: src/content/projects/<projekt>/<oldal>.md → /projects/<projekt>/<oldal>
// A projekt központi oldala (hub) külön .astro fájl: src/pages/projects/<projekt>/index.astro
const projectsSchema = z.object({
    title: z.string(),
    description: z.string().optional(),
    project: z.string(),       // melyik hubhoz tartozik, pl. "second-thought"
    order: z.number(),         // sorrend a hubon és az előző/következő navigációban
    updatedDate: z.string().optional(),
    draft: z.boolean().optional(), // draft: fejlesztés közben megnyílik, élesben nem épül meg
});

export type ProjectsSchema = z.infer<typeof projectsSchema>;

const blogCollection = defineCollection({ schema: blogSchema });
const storeCollection = defineCollection({ schema: storeSchema });
const thinkingArticleCollection = defineCollection({ schema: thinkingArticleSchema });
const deepBitsCollection = defineCollection({ schema: deepBitsSchema });
const thinkingBitsCollection = defineCollection({ schema: thinkingBitsSchema });
const projectsCollection = defineCollection({ schema: projectsSchema });

export const collections = {
    'blog': blogCollection,
    'store': storeCollection,
    'thinking-articles': thinkingArticleCollection,
    'deep-bits': deepBitsCollection,
    'thinking-bits': thinkingBitsCollection,
    'projects': projectsCollection,
}