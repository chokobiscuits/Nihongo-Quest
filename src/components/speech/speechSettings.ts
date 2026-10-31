/// Kept out of SpeechSettingsProvider (a client module) so server components
/// can read the default as a plain value rather than a client reference.
///
/// On by default: it is the main point of having pronunciation audio, and
/// the browser only allows playback after the user has interacted anyway.
export const DEFAULT_SPEECH_AUTOPLAY = true;

export interface SpeechSettings {
  /// Play a subject's pronunciation after every submitted quiz answer.
  autoplay: boolean;
}
