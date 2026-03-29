// Redirect / → /today
// The root URL has no content — always send users to Today view.
import { redirect } from '@sveltejs/kit';

export const load = () => {
	redirect(302, '/today');
};
