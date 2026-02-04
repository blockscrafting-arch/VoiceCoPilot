/**
 * Shared logic for building suggestion request history from transcript.
 * Used by useLiveStreaming (request) and SuggestionsPanel (can request).
 */

import type { Message } from "../stores/appStore";

/** Max last messages sent to suggestions API. */
export const SUGGESTION_HISTORY_SIZE = 6;
/** Min message length to include in suggestions history (chars). */
export const SUGGESTION_MIN_MESSAGE_CHARS = 12;

/**
 * Build history array suitable for suggestions API from transcript.
 * Filters drafts, takes last N messages, drops too short and consecutive duplicates.
 */
export function buildSuggestionHistory(transcript: Message[]): Message[] {
  let raw = transcript
    .filter((m) => !m.isDraft)
    .slice(-SUGGESTION_HISTORY_SIZE);
  raw = raw.filter(
    (m) => m.text.trim().length >= SUGGESTION_MIN_MESSAGE_CHARS
  );
  return raw.filter(
    (m, i) =>
      i === 0 || m.text !== raw[i - 1].text || m.role !== raw[i - 1].role
  );
}

/** True if transcript has enough content to request a suggestion. */
export function canRequestSuggestion(transcript: Message[]): boolean {
  return buildSuggestionHistory(transcript).length > 0;
}
