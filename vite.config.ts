import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
	plugins: [
		sveltekit(),
		VitePWA({
			// Automatically update the service worker when a new version is deployed
			registerType: 'autoUpdate',

			// Web app manifest — defines how the app looks when installed on a device
			manifest: {
				name: 'Planner',
				short_name: 'Planner',
				description: 'Personal productivity OS',
				theme_color: '#161620',
				background_color: '#0c0c0f',
				display: 'standalone',
				orientation: 'portrait',
				scope: '/',
				start_url: '/today',
				icons: [
					{
						src: '/icons/icon-192.png',
						sizes: '192x192',
						type: 'image/png'
					},
					{
						src: '/icons/icon-512.png',
						sizes: '512x512',
						type: 'image/png',
						purpose: 'any maskable'
					},
					{
						src: '/icons/icon.svg',
						sizes: 'any',
						type: 'image/svg+xml'
					}
				]
			},

			// Workbox config:
			//   - Pre-cache all built assets (JS, CSS, HTML, fonts, images)
			//   - Google Fonts: CacheFirst with a 1-year expiry
			workbox: {
				globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-cache',
							expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
						}
					},
					{
						urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'gstatic-fonts-cache',
							expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 }
						}
					}
				]
			},

			// Disable service worker in dev — avoids stale cache confusion during development
			devOptions: { enabled: false }
		})
	],
	server: {
		// Allow ngrok and other tunnels to forward requests to the dev server.
		// Vite 5+ blocks requests whose Host header doesn't match localhost — this disables that check.
		// Safe for local dev; never set this in production.
		allowedHosts: true
	}
});
