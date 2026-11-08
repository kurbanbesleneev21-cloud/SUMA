// Signs local release builds with the keystore given in NEXO_KEYSTORE / NEXO_KEYSTORE_PASS.
// Without those variables the build is left as generated (EAS manages its own credentials).
const { withAppBuildGradle } = require('expo/config-plugins');

const RELEASE_SIGNING = `
        release {
            storeFile file(System.getenv("NEXO_KEYSTORE"))
            storePassword System.getenv("NEXO_KEYSTORE_PASS")
            keyAlias "nexo"
            keyPassword System.getenv("NEXO_KEYSTORE_PASS")
        }`;

module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (!process.env.NEXO_KEYSTORE) return cfg;
    let gradle = cfg.modResults.contents;
    if (!gradle.includes('System.getenv("NEXO_KEYSTORE")')) {
      gradle = gradle.replace(/signingConfigs\s*\{/, (m) => m + RELEASE_SIGNING);
      gradle = gradle.replace(/(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?)signingConfig signingConfigs\.debug/, '$1signingConfig signingConfigs.release');
    }
    cfg.modResults.contents = gradle;
    return cfg;
  });
};
