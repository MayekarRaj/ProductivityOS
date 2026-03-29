import adapter from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	// vitePreprocess enables TypeScript + PostCSS (Tailwind) inside .svelte files
	preprocess: vitePreprocess(),

	kit: {
		// adapter-vercel packages the app as Vercel serverless functions
		// Each +server.ts route becomes its own serverless function
		adapter: adapter({ runtime: 'nodejs22.x' })
	}
};

export default config;
