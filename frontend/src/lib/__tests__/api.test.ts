import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchApi, ApiError } from '../api';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

beforeEach(() => {
  vi.clearAllMocks();
});

describe('fetchApi', () => {
  it('constructs the correct URL', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
    });

    await fetchApi('/pokemon');
    expect(mockFetch).toHaveBeenCalledWith(
      'http://localhost:3001/api/v1/pokemon'
    );
  });

  it('appends query parameters', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await fetchApi('/pokemon', { search: 'pika', limit: 10 });
    const url = mockFetch.mock.calls[0][0];
    expect(url).toContain('search=pika');
    expect(url).toContain('limit=10');
  });

  it('strips undefined and empty params', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve([]),
    });

    await fetchApi('/pokemon', { search: undefined, type: '', limit: 5 });
    const url = mockFetch.mock.calls[0][0];
    expect(url).not.toContain('search');
    expect(url).not.toContain('type');
    expect(url).toContain('limit=5');
  });

  it('throws ApiError on non-OK response', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve('Not found'),
    });

    await expect(fetchApi('/pokemon/99999')).rejects.toThrow(ApiError);
    await expect(
      fetchApi('/pokemon/99999').catch((e) => {
        expect(e).toBeInstanceOf(ApiError);
        expect(e.status).toBe(404);
        throw e;
      })
    ).rejects.toThrow();
  });

  it('parses JSON response correctly', async () => {
    const data = { id: 25, name: 'pikachu' };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(data),
    });

    const result = await fetchApi('/pokemon/25');
    expect(result).toEqual(data);
  });
});
