import {
  defineConfig
} from "../../../chunk-KZ52IAF7.mjs";
import "../../../chunk-C5DL5I2P.mjs";
import {
  init_esm
} from "../../../chunk-SKOTX2MW.mjs";

// trigger.config.ts
init_esm();
var trigger_config_default = defineConfig({
  project: "proj_gxuozazefbkeumohfuzy",
  dirs: ["./trigger/jobs"],
  // Required in v3.3.17+ — max time a single task run is allowed to execute
  // 5 minutes
  maxDuration: 300,
  build: {}
});
var resolveEnvVars = void 0;
export {
  trigger_config_default as default,
  resolveEnvVars
};
//# sourceMappingURL=trigger.config.mjs.map
