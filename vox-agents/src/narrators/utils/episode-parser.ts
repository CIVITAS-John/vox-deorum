/**
 * @module narrators/utils/episode-parser
 *
 * Pure functions for parsing segments.jsonl and decomposing segments into episodes.
 * No DB access — only string parsing and time conversion.
 */

import { createLogger } from '../../utils/logger.js';
import type { SegmentEntry, Segment, Episode } from '../types.js';

const logger = createLogger('EpisodeParser');

// ---------------------------------------------------------------------------
// Segment parsing — JSONL string → validated Segment groups
// ---------------------------------------------------------------------------

/**
 * Parse segments.jsonl content into validated segment groups.
 * Each segment is a `start → switch* → stop` sequence.
 * Malformed sequences are discarded with warnings.
 */
export function parseSegments(content: string): Segment[] {
  const lines = content.split('\n');
  const segments: Segment[] = [];

  let accumulating = false;
  let currentEntries: SegmentEntry[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    let entry: SegmentEntry;
    try {
      entry = JSON.parse(line) as SegmentEntry;
    } catch {
      logger.warn(`Skipping unparseable line ${i + 1}`);
      continue;
    }

    if (!entry.event || typeof entry.at !== 'number') {
      logger.warn(`Skipping invalid entry at line ${i + 1}: missing event or at`);
      continue;
    }

    if (entry.event === 'start') {
      if (accumulating) {
        logger.warn(
          `Discarding incomplete segment (${currentEntries.length} entries) — new start at line ${i + 1}`
        );
      }
      accumulating = true;
      currentEntries = [entry];
    } else if (entry.event === 'switch') {
      if (!accumulating) {
        logger.warn(`Ignoring orphaned switch at line ${i + 1}`);
        continue;
      }
      currentEntries.push(entry);
    } else if (entry.event === 'stop') {
      if (!accumulating) {
        logger.warn(`Ignoring orphaned stop at line ${i + 1}`);
        continue;
      }
      currentEntries.push(entry);

      if (!entry.file) {
        logger.warn(
          `Discarding segment ending at line ${i + 1} — stop entry has no file`
        );
      } else {
        const startEntry = currentEntries[0];
        segments.push({
          entries: currentEntries,
          startAt: startEntry.at,
          stopAt: entry.at,
          sourceFile: entry.file,
        });
      }

      accumulating = false;
      currentEntries = [];
    }
  }

  if (accumulating) {
    logger.warn(
      `Discarding trailing segment (${currentEntries.length} entries) — no stop before EOF`
    );
  }

  return segments;
}

// ---------------------------------------------------------------------------
// Episode decomposition — Segment[] → Episode[]
// ---------------------------------------------------------------------------

/**
 * Convert parsed segments into episodes with file-relative timing.
 * Minor civ players (in the provided set) get playerID rewritten to -1.
 */
export function segmentsToEpisodes(
  segments: Segment[],
  minorCivPlayerIDs: Set<number>,
): Episode[] {
  const episodes: Episode[] = [];

  for (const segment of segments) {
    // Collect boundary points: each entry that starts an episode
    // First entry (start) begins episode 1; each switch begins a new episode
    const boundaries: { at: number; turn: number; playerID: number }[] = [];
    for (const entry of segment.entries) {
      if (entry.event === 'start' || entry.event === 'switch') {
        boundaries.push({ at: entry.at, turn: entry.turn, playerID: entry.playerID });
      }
    }

    for (let i = 0; i < boundaries.length; i++) {
      const boundary = boundaries[i];
      const offset = boundary.at - segment.startAt;
      const endAt = i < boundaries.length - 1
        ? boundaries[i + 1].at - segment.startAt
        : segment.stopAt - segment.startAt;
      let duration = endAt - offset;

      if (duration < 0) {
        logger.warn(
          `Negative duration for episode at turn ${boundary.turn}, player ${boundary.playerID} — clamping to 0`
        );
        duration = 0;
      }

      const isMinor = minorCivPlayerIDs.has(boundary.playerID);

      episodes.push({
        turn: boundary.turn,
        playerID: isMinor ? -1 : boundary.playerID,
        sourceFile: segment.sourceFile,
        offset,
        duration,
        eventCounts: {},
      });
    }
  }

  return episodes;
}

// ---------------------------------------------------------------------------
// Convenience
// ---------------------------------------------------------------------------

/** Parse segments.jsonl content and decompose into episodes in one step */
export function parseAndDecompose(
  content: string,
  minorCivPlayerIDs: Set<number>,
): Episode[] {
  const segments = parseSegments(content);
  return segmentsToEpisodes(segments, minorCivPlayerIDs);
}
