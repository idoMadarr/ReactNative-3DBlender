export type ModelEntry = {
  id: string;
  name: string;
  /** Bundled asset, ready for `<ModelViewer source>` */
  source: number;
  /** Largest side when placed in AR, in meters */
  arSize: number;
};

// Real-world size of each model in AR, by file name; others use the default
const AR_SIZES: Record<string, number> = {
  table: 1.2,
  robot_bluewhite: 0.4,
  app_logo: 0.3,
  "3d_ido_model_colored": 0.3,
};
const DEFAULT_AR_SIZE = 0.5;

// Every .glb in src/blender_repo, picked up automatically: adding or removing
// a file updates this list without touching code
const files = require.context("../blender_repo", false, /\.glb$/);

function toTitle(id: string) {
  return id
    .replace(/\.\d+$/, "")
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase() + word.slice(1))
    .join(" ");
}

export const MODELS: ModelEntry[] = files
  .keys()
  .map((key) => {
    const id = key.replace(/^\.\//, "").replace(/\.glb$/, "");
    return {
      id,
      name: toTitle(id),
      source: files(key) as number,
      arSize: AR_SIZES[id] ?? DEFAULT_AR_SIZE,
    };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
