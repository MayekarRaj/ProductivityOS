// See https://svelte.dev/docs/kit/types#app.d.ts

// App.Locals: data attached to every server request (populated in hooks.server.ts)
// We'll add `user` here when we implement auth in a future phase

// App.PageData: data shared across all +layout.server.ts load functions
// App.Error: shape of the error object passed to +error.svelte pages

declare global {
	namespace App {
		// interface Error {}
		// interface Locals { user: User }
		// interface PageData {}
		// interface PageState {}
		// interface Platform {}
	}
}

export {};
