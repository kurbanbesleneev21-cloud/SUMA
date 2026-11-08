// Web preview only (NEXO_WEB_PREVIEW=1): the native LiveKit module cannot load in a browser.
// Call screens are exercised on devices; this keeps the rest of the app testable on the web.
const React = require('react');
const noop = async () => {};
class RNKeyProvider { async setSharedKey() {} dispose() {} }
class RNE2EEManager { constructor() { this.isEnabled = false; } }
module.exports = {
  registerGlobals: () => {},
  AudioSession: { configureAudio: noop, startAudioSession: noop, stopAudioSession: noop, getAudioOutputs: async () => [], selectAudioOutput: noop },
  RNKeyProvider,
  RNE2EEManager,
  RoomContext: React.createContext(undefined),
  VideoTrack: () => null,
  useTracks: () => [],
  isTrackReference: () => false,
};
