const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const threeModule = path.resolve(__dirname, 'node_modules/three/build/three.module.js');

const config = getDefaultConfig(__dirname);

// Bundle 3D model files as assets so they can be required/imported
config.resolver.assetExts.push('glb', 'gltf', 'bin');

// drei's native build require()s three (-> three.cjs) while fiber imports it
// (-> three.module.js), which would bundle two separate copies of three.
// Always use the single ESM build instead.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'three') {
    return { type: 'sourceFile', filePath: threeModule };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
