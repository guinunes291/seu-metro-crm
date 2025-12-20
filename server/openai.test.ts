import { describe, it, expect } from 'vitest';

describe('OpenAI API Key Validation', () => {
  it('should have OPENAI_API_KEY configured', () => {
    const apiKey = process.env.OPENAI_API_KEY;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe('');
    expect(apiKey?.startsWith('sk-')).toBe(true);
  });

  it('should be able to call OpenAI API', async () => {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    expect(response.ok).toBe(true);
    const data = await response.json();
    expect(data.data).toBeDefined();
    expect(Array.isArray(data.data)).toBe(true);
  });
});
