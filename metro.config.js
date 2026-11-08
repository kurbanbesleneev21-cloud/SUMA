const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Browser test harness only: replaces native-only modules (keystore, LiveKit) with web mocks.
if (process.env.NEXO_WEB_PREVIEW === '1') {
  const upstream = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const mocks = {
      'expo-secure-store': 'tools/web-preview/secure-store-mock.js',
      '@livekit/react-native': 'tools/web-preview/livekit-react-native-mock.js',
    };
    if (platform === 'web' && mocks[moduleName]) {
      return { type: 'sourceFile', filePath: path.join(__dirname, mocks[moduleName]) };
    }
    return (upstream ?? context.resolveRequest)(context, moduleName, platform);
  };
}

module.exports = config;
