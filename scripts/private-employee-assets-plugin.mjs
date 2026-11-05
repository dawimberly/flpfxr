import { writeFileSync } from "node:fs";
import { resolve } from "node:path";

/** Identify confidential employee chunks from their actual module graph. */
export function privateEmployeeAssetsPlugin() {
  let root;
  return {
    name: "flipfixer:private-employee-assets",
    apply: "build",
    configResolved(config) { root = config.root; },
    generateBundle(_options, bundle) {
      if (this.environment?.name !== "client") return;
      const sensitiveModule = /\/src\/(?:data\/(?:catalog|northville(?:-[^/]+)?|room-types)|components\/(?:estimator-app|cabinet-picker|finish-card|estimate-rail|roof-tracer-app|roof-penetration-picker|roof-photo-lab|roof-public-quote)|lib\/(?:estimator(?:-store)?|cabinets|estimate-pdf|estimate-log|roof-math|roof-auto|roof-code|roof-public-quote|roof-trace|trade-groups|op|selections))\.(?:tsx?|json)$/;
      const privateFiles = Object.values(bundle).filter(chunk =>
        chunk.type === "chunk" && Object.keys(chunk.modules).some(id => sensitiveModule.test(id.replaceAll("\\", "/").split("?")[0])),
      ).map(chunk => chunk.fileName);
      if (!privateFiles.length) throw new Error("No employee chunks identified; refusing an unverified public build");
      writeFileSync(resolve(root, ".private-employee-assets.json"), JSON.stringify(privateFiles));
    },
  };
}
