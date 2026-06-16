const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Custom resolver to fix use-sync-external-store resolution issues in Metro
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName === 'use-sync-external-store/with-selector') {
    return {
      type: 'sourceFile',
      filePath: path.resolve(__dirname, 'node_modules/use-sync-external-store/with-selector.js'),
    };
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
