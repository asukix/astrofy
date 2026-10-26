import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import tailwind from "@astrojs/tailwind";
import preact from "@astrojs/preact";

// https://astro.build/config
export default defineConfig({
  site: 'https://sengdev.com',
  integrations: [
    mdx(),
    // The Surpriser web app (/apps/surpriser) is Hungarian and lives outside the blog: keep it out of the sitemap.
    sitemap({ filter: (page) => !page.includes('/apps/surpriser') }),
    tailwind(),
    // Only the Surpriser island uses Preact.
    preact({ include: ['**/surpriser/**/*.tsx'] }),
  ]
});
