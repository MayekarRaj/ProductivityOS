import { defineConfig } from '@trigger.dev/sdk/v3';

export default defineConfig({
	project: 'proj_gxuozazefbkeumohfuzy',
	dirs: ['./trigger/jobs'],
	// Required in v3.3.17+ — max time a single task run is allowed to execute
	maxDuration: 300 // 5 minutes
});
