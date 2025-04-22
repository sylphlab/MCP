import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as https from 'node:https';
import * as path from 'node:path';
import { PassThrough } from 'node:stream';
import { pipeline } from 'node:stream/promises'; // Keep the import
import type { McpToolExecuteOptions, Part } from '@sylphlab/mcp-core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadTool } from './downloadTool.js';
import type { DownloadResultItem, DownloadToolInput } from './downloadTool.types.js';

// Mock dependencies
vi.mock('node:fs');
vi.mock('node:fs/promises');
vi.mock('node:https');
vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn(),
}));

// Mock workspace root
const mockWorkspaceRoot = '/mock/workspace';
const defaultOptions: McpToolExecuteOptions = { workspaceRoot: mockWorkspaceRoot };

// Helper to extract JSON result from parts
// Use generics to handle different result types
function getJsonResult<T>(parts: Part[]): T[] | undefined {
  const jsonPart = parts.find((part) => part.type === 'json');
  if (jsonPart && jsonPart.value !== undefined) {
    try {
      return jsonPart.value as T[];
    } catch (_e) {
      return undefined;
    }
  }
  return undefined;
}

describe('downloadTool.execute', () => {
  let mockWriteStream: PassThrough;
  let mockIncomingMessage: PassThrough;
  let mockClientRequest: { on: Function; setTimeout: Function; end: Function; destroy: Function };
  const mockPipeline = vi.mocked(pipeline); // Get mocked pipeline

  beforeEach(() => {
    // No longer async
    vi.resetAllMocks();

    // Mock fs.createWriteStream
    mockWriteStream = new PassThrough();
    vi.mocked(fs.createWriteStream).mockReturnValue(mockWriteStream as any);

    // Mock fs/promises
    vi.mocked(fsp.mkdir).mockResolvedValue(undefined);
    vi.mocked(fsp.access).mockRejectedValue({ code: 'ENOENT' });
    vi.mocked(fsp.unlink).mockResolvedValue(undefined);

    // Mock https.get
    mockIncomingMessage = new PassThrough();
    mockClientRequest = {
      on: vi.fn(),
      setTimeout: vi.fn(),
      end: vi.fn(() => {
        const getCallback = vi.mocked(https.get).mock.calls[0]?.[1];
        if (getCallback) {
          (mockIncomingMessage as any).statusCode = 200;
          (mockIncomingMessage as any).headers = { 'content-type': 'text/plain' };
          getCallback(mockIncomingMessage);
        }
      }),
      destroy: vi.fn(),
    };
    vi.mocked(https.get).mockReturnValue(mockClientRequest as any);

    // Mock pipeline default behavior
    mockPipeline.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should download a file successfully', async () => {
    const input: DownloadToolInput = {
      items: [
        { id: '1', url: 'https://example.com/file.txt', destinationPath: 'downloads/file.txt' },
      ],
    };

    const parts = await downloadTool.execute(input, defaultOptions);
    const results = getJsonResult<DownloadResultItem>(parts); // Added generic type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0]; // Define itemResult here

    expect(itemResult.success).toBe(true);
    expect(itemResult.id).toBe('1');
    expect(itemResult.path).toBe('downloads/file.txt');
    expect(itemResult.message).toContain('Successfully downloaded');
    expect(itemResult.error).toBeUndefined();

    expect(fsp.mkdir).toHaveBeenCalledWith(path.join(mockWorkspaceRoot, 'downloads'), {
      recursive: true,
    });
    expect(https.get).toHaveBeenCalledOnce();
    expect(fs.createWriteStream).toHaveBeenCalledWith(
      path.join(mockWorkspaceRoot, 'downloads/file.txt'),
    );
    expect(mockPipeline).toHaveBeenCalledOnce();
  });

  it('should handle overwrite: true when file exists', async () => {
    const input: DownloadToolInput = {
      items: [
        {
          id: '2',
          url: 'https://example.com/file.txt',
          destinationPath: 'downloads/existing.txt',
          overwrite: true,
        },
      ],
    };
    vi.mocked(fsp.access).mockResolvedValue(undefined);

    const parts = await downloadTool.execute(input, defaultOptions);
    const results = getJsonResult<DownloadResultItem>(parts); // Added generic type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    expect(results?.[0].success).toBe(true);
    expect(fsp.unlink).toHaveBeenCalledWith(path.join(mockWorkspaceRoot, 'downloads/existing.txt'));
    expect(mockPipeline).toHaveBeenCalledOnce();
  });

  it('should fail if file exists and overwrite is false', async () => {
    const input: DownloadToolInput = {
      items: [
        {
          id: '3',
          url: 'https://example.com/file.txt',
          destinationPath: 'downloads/exists.txt',
          overwrite: false,
        },
      ],
    };
    vi.mocked(fsp.access).mockResolvedValue(undefined);

    const parts = await downloadTool.execute(input, defaultOptions);
    const results = getJsonResult<DownloadResultItem>(parts); // Added generic type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    expect(results?.[0].success).toBe(false);
    expect(results?.[0].error).toContain('File already exists');
    expect(results?.[0].suggestion).toContain('Set overwrite: true');

    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it('should fail on network error', async () => {
    const input: DownloadToolInput = {
      items: [
        {
          id: '4',
          url: 'https://example.com/file.txt',
          destinationPath: 'downloads/network_error.txt',
        },
      ],
    };
    const networkError = new Error('ENOTFOUND');
    vi.mocked(https.get).mockImplementation(
      (_url: string | URL, _options: any, _callback?: (res: any) => void) => {
        const req = {
          on: (event: string, listener: (err: Error) => void) => {
            if (event === 'error') {
              process.nextTick(() => listener(networkError));
            }
            return req;
          },
          setTimeout: vi.fn(),
          end: vi.fn(),
          destroy: vi.fn(),
        };
        return req as any;
      },
    );

    const parts = await downloadTool.execute(input, defaultOptions);
    const results = getJsonResult<DownloadResultItem>(parts); // Added generic type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    expect(results?.[0].success).toBe(false);
    expect(results?.[0].error).toContain('Network request failed: ENOTFOUND');
    expect(results?.[0].suggestion).toContain('Check the URL and network connectivity');

    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it('should fail on HTTP error status', async () => {
    const input: DownloadToolInput = {
      items: [
        {
          id: '5',
          url: 'https://example.com/notfound.txt',
          destinationPath: 'downloads/http_error.txt',
        },
      ],
    };
    vi.mocked(https.get).mockImplementation(
      (_url: string | URL, _options: any, callback?: (res: any) => void) => {
        const req = {
          on: vi.fn(),
          setTimeout: vi.fn(),
          end: vi.fn(() => {
            const res = new PassThrough();
            (res as any).statusCode = 404;
            (res as any).statusText = 'Not Found';
            (res as any).headers = {};
            if (callback) callback(res);
            res.emit('data', Buffer.from('Resource not available'));
            res.emit('end');
          }),
          destroy: vi.fn(),
        };
        return req as any;
      },
    );

    const parts = await downloadTool.execute(input, defaultOptions);
    const results = getJsonResult<DownloadResultItem>(parts); // Added generic type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    expect(results?.[0].success).toBe(false);
    expect(results?.[0].error).toContain('Download failed. Status Code: 404');
    expect(results?.[0].error).toContain('Resource not available');
    expect(results?.[0].suggestion).toContain('Check the URL and network connectivity');

    expect(mockPipeline).not.toHaveBeenCalled();
  });

  it('should fail on file write error', async () => {
    const input: DownloadToolInput = {
      items: [
        {
          id: '6',
          url: 'https://example.com/file.txt',
          destinationPath: 'downloads/write_error.txt',
        },
      ],
    };
    const writeError = new Error('Disk full');
    mockPipeline.mockRejectedValue(writeError); // Simulate pipeline failing

    const parts = await downloadTool.execute(input, defaultOptions);
    const results = getJsonResult<DownloadResultItem>(parts); // Added generic type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    expect(results?.[0].success).toBe(false);
    expect(results?.[0].error).toContain('File write failed: Disk full');
    expect(results?.[0].suggestion).toContain('Check disk space');

    expect(fsp.unlink).toHaveBeenCalledWith(
      path.join(mockWorkspaceRoot, 'downloads/write_error.txt'),
    );
    expect(mockPipeline).toHaveBeenCalledOnce();
  });

  it('should handle redirects', async () => {
    const finalUrl = 'https://example.com/final/file.txt';
    const input: DownloadToolInput = {
      items: [
        {
          id: '7',
          url: 'https://example.com/redirect',
          destinationPath: 'downloads/redirected.txt',
        },
      ],
    };
    let requestCount = 0;
    vi.mocked(https.get).mockImplementation(
      (url: string | URL, _options: any, callback?: (res: any) => void) => {
        requestCount++;
        const req = {
          on: vi.fn(),
          setTimeout: vi.fn(),
          end: vi.fn(() => {
            const res = new PassThrough();
            if (url === 'https://example.com/redirect') {
              (res as any).statusCode = 302;
              (res as any).headers = { location: finalUrl };
            } else if (url === finalUrl) {
              (res as any).statusCode = 200;
              (res as any).headers = {};
            } else {
              (res as any).statusCode = 404;
              (res as any).headers = {};
            }
            if (callback) callback(res);
            if ((res as any).statusCode === 200) {
              res.emit('data', Buffer.from('final content'));
              res.emit('end');
            } else {
              res.emit('end');
            }
          }),
          destroy: vi.fn(),
        };
        return req as any;
      },
    );

    const parts = await downloadTool.execute(input, defaultOptions);
    const results = getJsonResult<DownloadResultItem>(parts); // Added generic type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    const itemResult = results?.[0]; // Define itemResult here

    expect(itemResult.success).toBe(true);
    expect(itemResult.message).toContain('Successfully downloaded');
    expect(requestCount).toBe(2);
    expect(https.get).toHaveBeenCalledWith('https://example.com/redirect', expect.any(Function));
    expect(https.get).toHaveBeenCalledWith(finalUrl, expect.any(Function));
    expect(mockPipeline).toHaveBeenCalledOnce();
  });

  it('should fail after exceeding max redirects', async () => {
    const input: DownloadToolInput = {
      items: [
        {
          id: '8',
          url: 'https://example.com/redirect1',
          destinationPath: 'downloads/max_redirect.txt',
        },
      ],
    };
    vi.mocked(https.get).mockImplementation(
      (url: string | URL, _options: any, callback?: (res: any) => void) => {
        const req = {
          on: vi.fn(),
          setTimeout: vi.fn(),
          end: vi.fn(() => {
            const res = new PassThrough();
            const currentNum = Number.parseInt(url.toString().slice(-1), 10) || 0;
            (res as any).statusCode = 302;
            (res as any).headers = { location: `https://example.com/redirect${currentNum + 1}` };
            if (callback) callback(res);
            res.emit('end');
          }),
          destroy: vi.fn(),
        };
        return req as any;
      },
    );

    const parts = await downloadTool.execute(input, defaultOptions);
    const results = getJsonResult<DownloadResultItem>(parts); // Added generic type

    expect(results).toBeDefined();
    expect(results).toHaveLength(1);
    expect(results?.[0].success).toBe(false);
    expect(results?.[0].error).toContain('Exceeded maximum redirects');

    expect(https.get).toHaveBeenCalledTimes(6);
    expect(mockPipeline).not.toHaveBeenCalled();
  });
});
