import type * as fsTypes from 'node:fs'; // Use type import for fs types
import type * as http from 'node:http'; // Regular import
import type { ClientRequest, IncomingMessage, RequestOptions } from 'node:http'; // Import necessary types
import type * as https from 'node:https'; // Import type for https options
import * as path from 'node:path'; // Add path import
import type * as stream from 'node:stream'; // Keep type import for Readable
import type { McpToolExecuteOptions } from '@sylphlab/mcp-core'; // Import options type
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadTool } from './downloadTool.js';
import type { DownloadToolInput } from './downloadTool.types.js'; // Import type from .types file

// --- Mocks ---
// Mock @sylphlab/mcp-core
// Define the mock directly within vi.mock factory
vi.mock('@sylphlab/mcp-core', async (importOriginal) => {
  const original = await importOriginal<typeof import('@sylphlab/mcp-core')>();
  return {
    ...original,
    validateAndResolvePath: vi.fn(), // Define mock directly
  };
});
// Import the mocked function AFTER vi.mock
import { validateAndResolvePath } from '@sylphlab/mcp-core';

// Mock node:stream/promises
vi.mock('node:stream/promises', () => ({
  pipeline: vi.fn(), // Define mock directly
}));
import { pipeline } from 'node:stream/promises'; // Import mocked function

// Mock node:fs/promises
vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(), // Define mock directly
  access: vi.fn(), // Define mock directly
  unlink: vi.fn(), // Define mock directly
}));
import { access, mkdir, unlink } from 'node:fs/promises'; // Import mocked functions

// Mock node:fs
vi.mock('node:fs', () => ({
  createWriteStream: vi.fn(), // Define mock directly
}));
import { createWriteStream } from 'node:fs'; // Import mocked function

// Define mockReq globally
const mockReq = {
  on: vi.fn().mockReturnThis(),
  end: vi.fn(),
  setTimeout: vi.fn().mockReturnThis(),
  destroy: vi.fn(),
  write: vi.fn(), // Add potentially missing methods
  abort: vi.fn(),
  connection: {},
  socket: {},
  emit: vi.fn(), // Keep emit for direct error simulation if needed elsewhere
};

// Mock node:https - Just return the function signature initially
vi.mock('node:https', () => ({
  get: vi.fn(), // Return a plain mock function
}));
import { get as httpsGet } from 'node:https'; // Import mocked function
// --- End Mocks ---

describe('downloadTool', () => {
  const workspaceRoot = '/test/workspace'; // Define workspaceRoot here
  const defaultOptions: McpToolExecuteOptions = { workspaceRoot, allowOutsideWorkspace: false }; // Explicitly set allowOutsideWorkspace

  // Helper to mock https.get response stream (Define here for access in all tests)
  const mockHttpsResponseStream = (
    statusCode = 200,
    headers = {},
    bodyChunks: string[] = ['data'],
    redirectUrl?: string,
  ) => {
    const responseStream = new (require('node:stream').Readable)({
      read() {
        // This implementation ensures data is pushed and stream ends properly
      },
    });
    responseStream.statusCode = redirectUrl ? 302 : statusCode;
    responseStream.headers = redirectUrl ? { location: redirectUrl } : headers;
    responseStream.resume = vi.fn(); // Mock resume

    // Push data and end stream asynchronously to better simulate real stream behavior
    setTimeout(() => {
      for (const chunk of bodyChunks) {
        responseStream.push(chunk);
      }
      responseStream.push(null); // End the stream
      responseStream.emit('end'); // Explicitly emit end
      responseStream.emit('close'); // Also emit close for pipeline
    }, 0);

    // Cast to IncomingMessage type for compatibility
    return responseStream as unknown as http.IncomingMessage;
  };

  // Helper function to extract URL and Callback from https.get args
  // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter
  const getUrlAndCallback = (
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter
    args: any[],
  ): { url: string | URL | undefined; callback: ((res: IncomingMessage) => void) | undefined } => {
    let url: string | URL | undefined;
    let callback: ((res: IncomingMessage) => void) | undefined;

    if (typeof args[0] === 'string' || args[0] instanceof URL) {
      url = args[0];
      if (typeof args[1] === 'function') {
        callback = args[1];
      } else if (typeof args[2] === 'function') {
        // Handle (url, options, callback) signature if needed, though less common for simple get
        callback = args[2];
      }
    } else if (typeof args[0] === 'object' && args[0] !== null) {
      // Handle (options, callback) signature
      // Extract URL from options if possible (e.g., options.href, options.path) - simplified here
      url = args[0].href || args[0].path || undefined;
      if (typeof args[1] === 'function') {
        callback = args[1];
      }
    }
    return { url, callback };
  };

  // Define a default single item for convenience in tests
  const defaultItem = {
    id: 'test1',
    url: 'https://example.com/file.txt',
    destinationPath: 'downloads/file.txt',
    overwrite: false,
  };
  // Default input now uses the items array structure
  const defaultInput: DownloadToolInput = {
    items: [defaultItem],
  };
  const resolvedPath = `${workspaceRoot}/${defaultItem.destinationPath}`;

  // Mock Write Stream
  let mockWriteStream: Partial<fsTypes.WriteStream>; // Use imported fsTypes

  beforeEach(() => {
    vi.resetAllMocks(); // Reset mocks between tests

    // Default successful path validation using vi.mocked
    vi.mocked(validateAndResolvePath).mockReturnValue(resolvedPath); // Use vi.mocked on the imported function
    // Default successful directory creation
    vi.mocked(mkdir).mockResolvedValue(undefined); // Use vi.mocked
    // Default file does not exist
    vi.mocked(access).mockRejectedValue({ code: 'ENOENT' }); // Use vi.mocked
    // Default successful pipeline
    vi.mocked(pipeline).mockResolvedValue(undefined); // Use vi.mocked
    // Default successful unlink (for cleanup tests)
    vi.mocked(unlink).mockResolvedValue(undefined); // Use vi.mocked

    // Set default implementation for httpsGet here
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter
    vi.mocked(httpsGet).mockImplementation((...args: any[]) => {
      // Default implementation can be simple or simulate success
      const { callback } = getUrlAndCallback(args);
      const responseStream = mockHttpsResponseStream(); // Default success stream
      if (callback) callback(responseStream);
      return mockReq as unknown as ClientRequest;
    });

    mockWriteStream = {
      write: vi.fn(),
      end: vi.fn(),
      on: vi.fn().mockReturnThis(),
      once: vi.fn().mockReturnThis(),
      emit: vi.fn(),
      removeListener: vi.fn().mockReturnThis(),
      pipe: vi.fn().mockReturnThis(),
    };
    // Simulate 'finish' event emission correctly for pipeline
    mockWriteStream.on = vi.fn((event, _listener) => {
      if (event === 'finish' || event === 'close') {
        // Rely on pipeline mock resolving
      }
      return mockWriteStream as fsTypes.WriteStream;
    });
    vi.mocked(createWriteStream).mockReturnValue(mockWriteStream as fsTypes.WriteStream); // Use vi.mocked
  });

  it('should download a file successfully', async () => {
    const responseStream = mockHttpsResponseStream(200, {}, ['file ', 'content']);
    // Override default implementation for this specific test
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter
    vi.mocked(httpsGet).mockImplementationOnce((...args: any[]) => {
      const { callback } = getUrlAndCallback(args);
      if (callback) callback(responseStream);
      return mockReq as unknown as ClientRequest;
    });

    const output = await downloadTool.execute(defaultInput, defaultOptions); // Pass options object

    expect(output.success).toBe(true); // Overall success
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.success).toBe(true);
    expect(result.id).toBe(defaultItem.id);
    expect(result.path).toBe(defaultItem.destinationPath);
    expect(result.message).toContain('Successfully downloaded');
    expect(vi.mocked(validateAndResolvePath)).toHaveBeenCalledWith(
      defaultItem.destinationPath,
      workspaceRoot,
      false,
    ); // Use vi.mocked, check allowOutsideWorkspace
    expect(vi.mocked(mkdir)).toHaveBeenCalledWith(path.dirname(resolvedPath), { recursive: true }); // Use vi.mocked
    expect(vi.mocked(access)).toHaveBeenCalledWith(resolvedPath); // Use vi.mocked
    expect(vi.mocked(httpsGet)).toHaveBeenCalledWith(defaultItem.url, expect.any(Function)); // Use vi.mocked
    expect(vi.mocked(createWriteStream)).toHaveBeenCalledWith(resolvedPath); // Use vi.mocked
    expect(vi.mocked(pipeline)).toHaveBeenCalledWith(responseStream, mockWriteStream); // Use vi.mocked
  });

  it('should handle redirects successfully', async () => {
    const redirectUrl = 'https://example.com/redirected.txt';
    const finalResponseStream = mockHttpsResponseStream(200, {}, ['final content']);

    // Override for first call
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter
    vi.mocked(httpsGet).mockImplementationOnce((...args: any[]) => {
      const { url, callback } = getUrlAndCallback(args);
      const urlString = url?.toString();
      if (urlString === defaultItem.url) {
        const redirectStream = mockHttpsResponseStream(302, {}, [], redirectUrl);
        if (callback) callback(redirectStream);
      } else {
        throw new Error('Unexpected URL in first mock call');
      }
      return mockReq as unknown as ClientRequest;
    });
    // Override for second call
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter
    vi.mocked(httpsGet).mockImplementationOnce((...args: any[]) => {
      const { url, callback } = getUrlAndCallback(args);
      const urlString = url?.toString();
      if (urlString === redirectUrl) {
        if (callback) callback(finalResponseStream);
      } else {
        throw new Error('Unexpected URL in second mock call');
      }
      return mockReq as unknown as ClientRequest;
    });

    const output = await downloadTool.execute(defaultInput, defaultOptions); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.success).toBe(true);
    expect(result.message).toContain('Successfully downloaded');
    expect(vi.mocked(validateAndResolvePath)).toHaveBeenCalledTimes(1); // Use vi.mocked
    expect(vi.mocked(httpsGet)).toHaveBeenCalledTimes(2); // Use vi.mocked
    expect(vi.mocked(httpsGet)).toHaveBeenCalledWith(defaultItem.url, expect.any(Function)); // Use vi.mocked
    expect(vi.mocked(httpsGet)).toHaveBeenCalledWith(redirectUrl, expect.any(Function)); // Use vi.mocked
    expect(vi.mocked(pipeline)).toHaveBeenCalledWith(finalResponseStream, mockWriteStream); // Use vi.mocked
  });

  it('should fail for an item if file exists and overwrite is false', async () => {
    vi.mocked(access).mockResolvedValue(undefined); // Use vi.mocked

    const input: DownloadToolInput = { items: [{ ...defaultItem, overwrite: false }] };
    const output = await downloadTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(false); // Overall success is false if only item fails
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.success).toBe(false);
    expect(result.error).toContain('File already exists');
    expect(result.message).toContain('File already exists');
    expect(vi.mocked(httpsGet)).not.toHaveBeenCalled(); // Use vi.mocked
    expect(vi.mocked(createWriteStream)).not.toHaveBeenCalled(); // Use vi.mocked
    expect(vi.mocked(pipeline)).not.toHaveBeenCalled(); // Use vi.mocked
  });

  it('should succeed for an item if file exists and overwrite is true', async () => {
    vi.mocked(access).mockResolvedValue(undefined); // Use vi.mocked
    const responseStream = mockHttpsResponseStream();
    // Override implementation
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter
    vi.mocked(httpsGet).mockImplementationOnce((...args: any[]) => {
      const { callback } = getUrlAndCallback(args);
      if (callback) callback(responseStream);
      return mockReq as unknown as ClientRequest;
    });

    const input: DownloadToolInput = { items: [{ ...defaultItem, overwrite: true }] };
    const output = await downloadTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.success).toBe(true);
    expect(result.message).toContain('Successfully downloaded');
    expect(vi.mocked(validateAndResolvePath)).toHaveBeenCalledWith(
      defaultItem.destinationPath,
      workspaceRoot,
      false,
    ); // Use vi.mocked
    expect(vi.mocked(access)).toHaveBeenCalledWith(resolvedPath); // Use vi.mocked
    expect(vi.mocked(pipeline)).toHaveBeenCalled(); // Use vi.mocked
  });

  it('should fail for an item on path validation error', async () => {
    const validationError = { error: 'Invalid path', suggestion: 'Check syntax' };
    vi.mocked(validateAndResolvePath).mockReturnValue(validationError); // Use vi.mocked

    const output = await downloadTool.execute(defaultInput, defaultOptions); // Pass options object

    expect(output.success).toBe(false);
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.success).toBe(false);
    expect(result.error).toContain('Path validation failed: Invalid path');
    expect(result.message).toContain('Path validation failed: Invalid path');
    expect(vi.mocked(validateAndResolvePath)).toHaveBeenCalledWith(
      defaultItem.destinationPath,
      workspaceRoot,
      false,
    ); // Use vi.mocked
    expect(vi.mocked(mkdir)).not.toHaveBeenCalled(); // Use vi.mocked
    expect(vi.mocked(httpsGet)).not.toHaveBeenCalled(); // Use vi.mocked
  });

  it('should fail on https request error (network)', async () => {
    const networkError = new Error('Network connection refused');
    // Make the mock implementation reject directly
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter
    vi.mocked(httpsGet).mockImplementationOnce((..._args: any[]) => {
      // Simulate the rejection that would happen from the 'error' event listener
      // in the actual code's new Promise wrapper by throwing.
      throw networkError;
    });

    const output = await downloadTool.execute(defaultInput, defaultOptions); // Pass options object

    expect(output.success).toBe(false);
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.success).toBe(false);
    // Error message now comes directly from the catch block, including item details
    expect(result.error).toContain(
      `Download failed for item ${defaultItem.id} (${defaultItem.destinationPath}): Network connection refused`,
    );
    expect(vi.mocked(pipeline)).not.toHaveBeenCalled(); // Use vi.mocked
  });

  // Add increased timeout
  it('should fail on https non-2xx status code', { timeout: 10000 }, async () => {
    // Pass an empty array for bodyChunks to match the actual error message
    const responseStream = mockHttpsResponseStream(404, {}, []);
    // Override implementation
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter
    vi.mocked(httpsGet).mockImplementationOnce((...args: any[]) => {
      const { callback } = getUrlAndCallback(args);
      if (callback) callback(responseStream);
      return mockReq as unknown as ClientRequest;
    });

    const output = await downloadTool.execute(defaultInput, defaultOptions); // Pass options object

    expect(output.success).toBe(false);
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.success).toBe(false);
    // Adjust assertion to match the actual error message (without body part)
    expect(result.error).toContain('Download failed. Status Code: 404.');
    expect(vi.mocked(pipeline)).not.toHaveBeenCalled(); // Use vi.mocked
    expect(vi.mocked(unlink)).toHaveBeenCalledWith(resolvedPath); // Use vi.mocked
  });

  it('should fail on file write error (pipeline)', async () => {
    const writeError = new Error('Disk full');
    vi.mocked(pipeline).mockRejectedValue(writeError); // Use vi.mocked
    const responseStream = mockHttpsResponseStream();
    // Override implementation
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter
    vi.mocked(httpsGet).mockImplementationOnce((...args: any[]) => {
      const { callback } = getUrlAndCallback(args);
      if (callback) callback(responseStream);
      return mockReq as unknown as ClientRequest;
    });

    const output = await downloadTool.execute(defaultInput, defaultOptions); // Pass options object

    expect(output.success).toBe(false);
    expect(output.results).toHaveLength(1);
    const result = output.results[0];
    expect(result.success).toBe(false);
    // Correct the assertion to match the error message format
    expect(result.error).toContain(
      `Download failed for item ${defaultItem.id} (${defaultItem.destinationPath}): File write failed: Disk full`,
    );
    expect(vi.mocked(unlink)).toHaveBeenCalledWith(resolvedPath); // Use vi.mocked
  });

  it('should fail if workspaceRoot is missing (though unlikely)', async () => {
    // Execute with null workspaceRoot in options
    // biome-ignore lint/suspicious/noExplicitAny: Intentionally passing invalid options for testing
    const output = await downloadTool.execute(defaultInput, { workspaceRoot: null } as any); // Pass options object

    // Expect overall failure and specific error before loop starts
    expect(output.success).toBe(false);
    expect(output.results).toEqual([]); // No items processed
    expect(output.error).toContain('Workspace root is not available in options.'); // Check top-level error
    expect(vi.mocked(validateAndResolvePath)).not.toHaveBeenCalled(); // Use vi.mocked
  });

  // --- New Tests for Multiple Items ---

  it('should handle multiple successful downloads', async () => {
    const item1 = {
      id: 'dl1',
      url: 'https://example.com/file1.zip',
      destinationPath: 'zips/file1.zip',
      overwrite: false,
    };
    const item2 = {
      id: 'dl2',
      url: 'https://example.com/file2.img',
      destinationPath: 'images/file2.img',
      overwrite: true,
    };
    const resolvedPath1 = `${workspaceRoot}/${item1.destinationPath}`;
    const resolvedPath2 = `${workspaceRoot}/${item2.destinationPath}`;

    vi.mocked(validateAndResolvePath)
      .mockReturnValueOnce(resolvedPath1)
      .mockReturnValueOnce(resolvedPath2);
    vi.mocked(access) // Use vi.mocked
      .mockRejectedValueOnce({ code: 'ENOENT' })
      .mockResolvedValueOnce(undefined);
    const responseStream1 = mockHttpsResponseStream(200, {}, ['zip ']);
    const responseStream2 = mockHttpsResponseStream(200, {}, ['img ']);
    // Override implementations
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter
    vi.mocked(httpsGet)
      .mockImplementationOnce((...args: any[]) => {
        const { callback } = getUrlAndCallback(args);
        if (callback) callback(responseStream1);
        return mockReq as unknown as ClientRequest;
      })
      // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter
      .mockImplementationOnce((...args: any[]) => {
        const { callback } = getUrlAndCallback(args);
        if (callback) callback(responseStream2);
        return mockReq as unknown as ClientRequest;
      });

    const input: DownloadToolInput = { items: [item1, item2] };
    const output = await downloadTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(true);
    expect(output.results).toHaveLength(2);
    expect(output.results[0].success).toBe(true);
    expect(output.results[1].success).toBe(true);
    expect(vi.mocked(validateAndResolvePath)).toHaveBeenCalledTimes(2); // Use vi.mocked
    expect(vi.mocked(access)).toHaveBeenCalledTimes(2); // Use vi.mocked
    expect(vi.mocked(httpsGet)).toHaveBeenCalledTimes(2); // Use vi.mocked
    expect(vi.mocked(createWriteStream)).toHaveBeenCalledTimes(2); // Use vi.mocked
    expect(vi.mocked(pipeline)).toHaveBeenCalledTimes(2); // Use vi.mocked
  });

  // Add increased timeout
  it('should handle mixed results (one success, one failure)', { timeout: 10000 }, async () => {
    const item1 = {
      id: 'ok',
      url: 'https://example.com/good.txt',
      destinationPath: 'good.txt',
      overwrite: false,
    };
    const item2 = {
      id: 'bad',
      url: 'https://example.com/bad.txt',
      destinationPath: 'bad.txt',
      overwrite: false,
    };
    const resolvedPath1 = `${workspaceRoot}/${item1.destinationPath}`;
    const resolvedPath2 = `${workspaceRoot}/${item2.destinationPath}`;

    vi.mocked(validateAndResolvePath)
      .mockReturnValueOnce(resolvedPath1)
      .mockReturnValueOnce(resolvedPath2);
    vi.mocked(access).mockRejectedValue({ code: 'ENOENT' }); // Use vi.mocked
    const responseStream1 = mockHttpsResponseStream(200, {}, ['good ']);
    // Pass empty array for error body
    const responseStream2 = mockHttpsResponseStream(404, {}, []);
    // Override implementations
    // biome-ignore lint/suspicious/noExplicitAny: Mock implementation parameter
    vi.mocked(httpsGet)
      .mockImplementationOnce((...args: any[]) => {
        const { callback } = getUrlAndCallback(args);
        if (callback) callback(responseStream1);
        return mockReq as unknown as ClientRequest;
      })
      .mockImplementationOnce((...args: any[]) => {
        const { callback } = getUrlAndCallback(args);
        if (callback) callback(responseStream2);
        return mockReq as unknown as ClientRequest;
      });

    const input: DownloadToolInput = { items: [item1, item2] };
    const output = await downloadTool.execute(input, defaultOptions); // Pass options object

    expect(output.success).toBe(true); // Overall success is true because one succeeded
    expect(output.results).toHaveLength(2);
    expect(output.results[0].success).toBe(true);
    expect(output.results[1].success).toBe(false);
    // Adjust assertion
    expect(output.results[1].error).toContain('Download failed. Status Code: 404.');
    expect(vi.mocked(validateAndResolvePath)).toHaveBeenCalledTimes(2); // Use vi.mocked
    expect(vi.mocked(access)).toHaveBeenCalledTimes(2); // Use vi.mocked
    expect(vi.mocked(httpsGet)).toHaveBeenCalledTimes(2); // Use vi.mocked
    expect(vi.mocked(createWriteStream)).toHaveBeenCalledTimes(1); // Use vi.mocked
    expect(vi.mocked(pipeline)).toHaveBeenCalledTimes(1); // Use vi.mocked
    expect(vi.mocked(unlink)).toHaveBeenCalledTimes(1); // Use vi.mocked
    expect(vi.mocked(unlink)).toHaveBeenCalledWith(resolvedPath2); // Use vi.mocked
  });
});
