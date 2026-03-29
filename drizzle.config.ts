// drizzle-kit runs as a standalone CLI, outside of SvelteKit.
// This means $env/static/private is NOT available here.
// We use dotenv to load the .env file manually instead.
import * as dotenv from 'dotenv';
dotenv.config();

import { defineConfig } from 'drizzle-kit';

export default defineConfig({
	// Where our schema lives — drizzle-kit reads this to generate migrations
	schema: './src/lib/db/schema.ts',

	// Where generated migration SQL files will be saved
	out: './drizzle',

	dialect: 'postgresql',

	dbCredentials: {
		// Use the DIRECT connection (port 5432) for migrations, NOT the pooler.
		// The pooler (port 6543) is for the app runtime. Migrations need a persistent
		// connection that can run DDL statements like CREATE TABLE.
		url: process.env.DATABASE_URL_DIRECT ?? process.env.DATABASE_URL ?? ''
	},

	verbose: true // log each SQL statement being run
	// strict: true would prompt before destructive operations — use --force flag instead
});
