/** @type {import('tailwindcss').Config} */
export default {
	// content: tells Tailwind which files to scan for class names
	// In production, any class NOT found in these files gets removed from the bundle
	content: ['./src/**/*.{html,js,svelte,ts}'],

	theme: {
		extend: {
			// Register our custom fonts so we can use font-mono and font-display
			// These match the Google Fonts we load in app.html
			fontFamily: {
				mono: ['DM Mono', 'Courier New', 'monospace'],
				display: ['Space Grotesk', 'sans-serif']
			},
			colors: {
				accent: '#8B5CF6',
				'accent-hover': '#7C3AED'
			}
		}
	},

	plugins: []
};
