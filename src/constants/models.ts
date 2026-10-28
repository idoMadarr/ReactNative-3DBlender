export type ModelEntry = {
  id: string;
  name: string;
  /** Bundled asset, ready for `<ModelViewer source>` */
  source: number;
};

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
    return { id, name: toTitle(id), source: files(key) as number };
  })
  .sort((a, b) => a.name.localeCompare(b.name));
