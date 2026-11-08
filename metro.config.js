const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Browser test harness only: replaces the native keystore with an in-memory mock.
if (process.env.NEXO_WEB_PREVIEW === '1') {
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    if (platform === 'web' && moduleName === 'expo-secure-store') {
      return { type: 'sourceFile', filePath: path.join(__dirname, 'tools/web-preview/secure-store-mock.js') };
    }
    return (upstream ?? context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
