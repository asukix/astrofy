/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
	theme: {
		extend: {},
	},
	plugins: [require("@tailwindcss/typography"),require("daisyui")],
	daisyui: {
		themes: [
			{
				lofi: {
					...require("daisyui/src/theming/themes")["lofi"],
					"primary": "#2563EB",
					"primary-content": "#FFFFFF",
					"secondary": "#4B5563",
					"secondary-content": "#FFFFFF",
					"accent": "#2563EB",
					"accent-content": "#FFFFFF",
					"neutral": "#4B5563",
					"neutral-content": "#FFFFFF",
					"base-100": "#FFFFFF",
					"base-200": "#F3F4F6",
					"base-300": "#E5E7EB",
					"base-content": "#1F2937",
				},
			},
		],
		darkTheme: "dark", // name of one of the included themes for dark mode
		logs: false, // Shows info about daisyUI version and used config in the console when building your CSS
	  }
}
