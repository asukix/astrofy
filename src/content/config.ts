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

const blogCollection = defineCollection({ schema: blogSchema });
const storeCollection = defineCollection({ schema: storeSchema });
const thinkingArticleCollection = defineCollection({ schema: thinkingArticleSchema });
const deepBitsCollection = defineCollection({ schema: deepBitsSchema });
const thinkingBitsCollection = defineCollection({ schema: thinkingBitsSchema });

export const collections = {
    'blog': blogCollection,
    'store': storeCollection,
    'thinking-articles': thinkingArticleCollection,
    'deep-bits': deepBitsCollection,
    'thinking-bits': thinkingBitsCollection,
}