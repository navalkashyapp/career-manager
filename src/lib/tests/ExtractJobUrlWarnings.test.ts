import { describe, it, expect } from 'vitest';

describe('Extract Job URL Warning Aggregation', () => {
  it('combines AI warning messages with the base error message', () => {
    const error = new Error(
      'This link points to a job listing board or search results, not an individual job vacancy.',
    );
    const extractedAiResponse = {
      pageType: 'listing-page',
      warnings: [
        'Search listing page detected with 12 open roles.',
        'No individual job description found.',
      ],
      rejectionReason: 'Page represents a search list',
    };

    const rawWarnings: any[] = [];
    if (extractedAiResponse) {
      if (Array.isArray(extractedAiResponse.warnings)) {
        rawWarnings.push(...extractedAiResponse.warnings);
      } else if (typeof extractedAiResponse.warnings === 'string') {
        rawWarnings.push(extractedAiResponse.warnings);
      }
      if (
        typeof extractedAiResponse.rejectionReason === 'string' &&
        extractedAiResponse.rejectionReason.trim()
      ) {
        rawWarnings.push(extractedAiResponse.rejectionReason.trim());
      }
    }

    const warningMessages: string[] = Array.from(
      new Set(
        rawWarnings
          .map((w) => (typeof w === 'string' ? w.trim() : JSON.stringify(w)))
          .filter(Boolean),
      ),
    );

    const baseMessage = error.message;
    let combinedMessage = baseMessage;

    if (warningMessages.length > 0) {
      const warningsText = warningMessages.join('; ');
      if (!baseMessage.toLowerCase().includes(warningsText.toLowerCase())) {
        combinedMessage = `${baseMessage} (AI Warnings: ${warningsText})`;
      }
    }

    expect(combinedMessage).toContain(baseMessage);
    expect(combinedMessage).toContain('AI Warnings:');
    expect(combinedMessage).toContain('Search listing page detected with 12 open roles.');
    expect(combinedMessage).toContain('Page represents a search list');
  });

  it('keeps base error message intact when no warnings exist', () => {
    const error = new Error('Unable to extract sufficient text from this URL.');
    const extractedAiResponse = null;

    const rawWarnings: any[] = [];
    if (extractedAiResponse) {
      if (Array.isArray((extractedAiResponse as any).warnings)) {
        rawWarnings.push(...(extractedAiResponse as any).warnings);
      }
    }

    const warningMessages: string[] = Array.from(
      new Set(
        rawWarnings
          .map((w) => (typeof w === 'string' ? w.trim() : JSON.stringify(w)))
          .filter(Boolean),
      ),
    );

    const baseMessage = error.message;
    let combinedMessage = baseMessage;

    if (warningMessages.length > 0) {
      const warningsText = warningMessages.join('; ');
      if (!baseMessage.toLowerCase().includes(warningsText.toLowerCase())) {
        combinedMessage = `${baseMessage} (AI Warnings: ${warningsText})`;
      }
    }

    expect(combinedMessage).toBe('Unable to extract sufficient text from this URL.');
  });
});
