import { describe, expect, it } from 'vitest';

import {
  escapeTelegramHtml,
  formatHourlyDigestChunks,
  formatHourlyDigest,
  formatImmediateFactCheck,
} from '../src/application/fact-checking/FactCheckFormatter';
import type { FactCheckFindingWithSources } from '../src/domain/entities/FactCheckFindingEntity';
import type { FactCheckConfig } from '../src/application/fact-checking/FactCheckConfig';

const now = new Date().toISOString();

function makeDigestFinding(
  overrides: Partial<FactCheckFindingWithSources> = {}
): FactCheckFindingWithSources {
  return {
    id: 1,
    runId: 1,
    chatId: 1,
    messageId: 10,
    telegramMessageId: 555,
    authorUserId: 7,
    authorDisplayName: 'Alice <3',
    normalizedClaimKey: 'claim',
    claimText: 'The sky is green',
    originalQuote: 'The sky is green',
    correctedFact: 'The sky is blue',
    explanation: 'Basic meteorology',
    category: 'external_fact',
    severity: 'low',
    status: 'confirmed',
    confidence: 0.9,
    sourcePolicy: 'reliable_or_media_allowed',
    sourceRequirementsMet: true,
    shouldNotifyImmediately: false,
    messageUrl: 'https://t.me/c/123/555',
    immediateNotifiedAt: null,
    digestNotifiedAt: null,
    notificationError: null,
    createdAt: '2026-06-12T10:00:00.000Z',
    checkedAt: '2026-06-12T10:00:00.000Z',
    sources: [],
    ...overrides,
  };
}

function makeFinding(
  status: 'confirmed' | 'uncertain' = 'confirmed',
  overrides: Partial<FactCheckFindingWithSources> = {}
): FactCheckFindingWithSources {
  return {
    id: 1,
    runId: 1,
    chatId: 1,
    messageId: 1,
    telegramMessageId: null,
    authorUserId: null,
    authorDisplayName: 'User',
    normalizedClaimKey: 'key',
    claimText: 'claim',
    originalQuote: 'original <quote>',
    correctedFact: 'correct & fact',
    explanation: 'why > it matters',
    category: 'external_fact',
    severity: 'low',
    status,
    confidence: 0.9,
    sourcePolicy: 'reliable_or_media_allowed',
    sourceRequirementsMet: true,
    shouldNotifyImmediately: false,
    messageUrl: null,
    immediateNotifiedAt: null,
    digestNotifiedAt: null,
    notificationError: null,
    createdAt: now,
    checkedAt: now,
    sources: [
      {
        id: 1,
        findingId: 1,
        url: 'https://example.com?a=1&b=2',
        title: 'Example "source"',
        publisher: null,
        snippet: 'snippet',
        reliability: 'authoritative',
        retrievedAt: now,
      },
    ],
    ...overrides,
  };
}

const defaultConfig: FactCheckConfig = {
  enabled: false,
  hourlyCron: '0 0 * * * *',
  dailyStatsCron: '0 0 9 * * *',
  weeklyStatsCron: '0 0 9 * * 1',
  monthlyStatsCron: '0 0 9 1 * *',
  timezone: 'Europe/Warsaw',
  maxMessagesPerBatch: 200,
  maxClaimsPerBatch: 40,
  maxHistoryContextMessages: 100,
  maxSourceSearchesPerBatch: 20,
  maxSourcesPerFinding: 5,
  maxDisplayedSourcesPerFinding: 3,
  maxFindingsPerDigestMessage: 10,
  verificationConfidenceThreshold: 0.75,
};

describe('FactCheckFormatter', () => {
  describe('escapeTelegramHtml', () => {
    it('escapes special HTML chars', () => {
      expect(escapeTelegramHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;'
      );
      expect(escapeTelegramHtml('a & b')).toBe('a &amp; b');
    });
  });

  describe('formatImmediateFactCheck', () => {
    it('escapes user text', () => {
      const result = formatImmediateFactCheck(makeFinding());
      expect(result).toContain('original &lt;quote&gt;');
      expect(result).toContain('correct &amp; fact');
      expect(result).toContain('why &gt; it matters');
    });

    it('does not double-escape source links', () => {
      const result = formatImmediateFactCheck(makeFinding());
      // URL & in href must be escaped, link tag itself should be valid HTML
      expect(result).toContain('<a href="https://example.com?a=1&amp;b=2">');
    });
  });

  describe('formatHourlyDigest', () => {
    it('separates confirmed and uncertain sections', () => {
      const findings = [
        makeFinding('confirmed'),
        makeFinding('uncertain', { id: 2, normalizedClaimKey: 'key2' }),
      ];
      const chunks = formatHourlyDigest(findings, defaultConfig);
      const combined = chunks.join('\n\n');
      expect(combined).toContain('Фактические ошибки');
      expect(combined).toContain('Возможные неточности');
    });

    it('returns empty array for no findings', () => {
      expect(formatHourlyDigest([], defaultConfig)).toEqual([]);
    });

    it('splits chunks when maxFindingsPerDigestMessage is exceeded', () => {
      const smallConfig: FactCheckConfig = {
        ...defaultConfig,
        maxFindingsPerDigestMessage: 1,
      };
      const findings = [
        makeFinding('confirmed'),
        makeFinding('confirmed', { id: 2, normalizedClaimKey: 'k2' }),
      ];
      const chunks = formatHourlyDigest(findings, smallConfig);
      expect(chunks.length).toBeGreaterThan(1);
    });

    it('returns finding ids for each digest chunk', () => {
      const smallConfig: FactCheckConfig = {
        ...defaultConfig,
        maxFindingsPerDigestMessage: 1,
      };
      const chunks = formatHourlyDigestChunks(
        [
          makeFinding('confirmed', { id: 10 }),
          makeFinding('confirmed', { id: 11, normalizedClaimKey: 'k2' }),
        ],
        smallConfig
      );

      expect(chunks.map((c) => c.findingIds)).toEqual([[10], [11]]);
      expect(formatHourlyDigest([], defaultConfig)).toEqual([]);
    });

    it('splits chunk when content would exceed ~4000 chars', () => {
      const longConfig: FactCheckConfig = {
        ...defaultConfig,
        maxFindingsPerDigestMessage: 100,
      };
      const longFinding = makeFinding('confirmed', {
        originalQuote: 'x'.repeat(1000),
        correctedFact: 'y'.repeat(1000),
        explanation: 'z'.repeat(1000),
      });
      const longFinding2 = makeFinding('confirmed', {
        id: 2,
        normalizedClaimKey: 'k2',
        originalQuote: 'x'.repeat(1000),
        correctedFact: 'y'.repeat(1000),
        explanation: 'z'.repeat(1000),
      });
      const chunks = formatHourlyDigest(
        [longFinding, longFinding2],
        longConfig
      );
      // Each chunk must be under 4000 chars
      for (const chunk of chunks) {
        expect(chunk.length).toBeLessThanOrEqual(4000);
      }
    });
  });

  describe('section header carry-over', () => {
    it('moves a section header to the chunk that contains its findings', () => {
      const smallConfig = { ...defaultConfig, maxFindingsPerDigestMessage: 2 };
      const confirmed = [1, 2].map((id) =>
        makeDigestFinding({ id, status: 'confirmed' })
      );
      const uncertain = [makeDigestFinding({ id: 3, status: 'uncertain' })];
      const chunks = formatHourlyDigestChunks(
        [...confirmed, ...uncertain],
        smallConfig
      );

      expect(chunks).toHaveLength(2);
      // header must NOT dangle at the end of chunk 0
      expect(chunks[0].text).not.toContain('Возможные неточности');
      expect(chunks[1].text).toContain('Возможные неточности');
      expect(chunks[0].findingIds).toEqual([1, 2]);
      expect(chunks[1].findingIds).toEqual([3]);
    });
  });

  describe('digest entry header', () => {
    it('links the original message and names the author', () => {
      const chunks = formatHourlyDigestChunks([makeDigestFinding()], defaultConfig);
      expect(chunks[0].text).toContain(
        '<a href="https://t.me/c/123/555">Сообщение</a>'
      );
      expect(chunks[0].text).toContain('Alice &lt;3');
    });

    it('falls back to author-only header without a message url', () => {
      const chunks = formatHourlyDigestChunks(
        [makeDigestFinding({ messageUrl: null })],
        defaultConfig
      );
      expect(chunks[0].text).not.toContain('<a href=""');
      expect(chunks[0].text).toContain('Alice &lt;3');
    });
  });
});
