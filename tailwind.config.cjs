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
					"primary": "#3B82F6",
					"primary-content": "#FFFFFF",
					"secondary": "#374151",
					"secondary-content": "#FFFFFF",
					"accent": "#3B82F6",
					"accent-content": "#FFFFFF",
					"neutral": "#374151",
					"neutral-content": "#FFFFFF",
					"base-100": "#FFFFFF",
					"base-200": "#F3F4F6",
					"base-300": "#E5E7EB",
					"base-content": "#1F2937",
				},
			},
			// Surpriser web app (/apps/surpriser): colours of the app icon. The page picks light or dark itself.
			{
				surpriser: {
					"color-scheme": "light",
					"primary": "#6A4BD1",
					"primary-content": "#FFFFFF",
					"secondary": "#E8506E",
					"secondary-content": "#FFFFFF",
					"accent": "#F5B83D",
					"accent-content": "#2A1F05",
					"neutral": "#2A2340",
					"neutral-content": "#FFFFFF",
					"base-100": "#FFFFFF",
					"base-200": "#F6F3FD",
					"base-300": "#E6E0F5",
					"base-content": "#231C3A",
					"info": "#3B82F6",
					"success": "#1F9D63",
					"success-content": "#FFFFFF",
					"warning": "#D98E04",
					"error": "#D33A4F",
					"error-content": "#FFFFFF",
					"--rounded-box": "1.25rem",
					"--rounded-btn": "0.85rem",
					"--rounded-badge": "1rem",
				},
			},
			{
				"surpriser-dark": {
					"color-scheme": "dark",
					"primary": "#A893FF",
					"primary-content": "#17122B",
					"secondary": "#FF7A93",
					"secondary-content": "#2A0A12",
					"accent": "#FFCC5C",
					"accent-content": "#2A1F05",
					"neutral": "#E6E0F5",
					"neutral-content": "#17122B",
					"base-100": "#1B1630",
					"base-200": "#141024",
					"base-300": "#2E2650",
					"base-content": "#ECE8F7",
					"info": "#7AA7FF",
					"success": "#4CC98E",
					"success-content": "#0B2418",
					"warning": "#F2B33D",
					"error": "#FF6B7F",
					"error-content": "#2A0A12",
					"--rounded-box": "1.25rem",
					"--rounded-btn": "0.85rem",
					"--rounded-badge": "1rem",
				},
			},
		],
		darkTheme: "dark", // name of one of the included themes for dark mode
		logs: false, // Shows info about daisyUI version and used config in the console when building your CSS
	  }
}
