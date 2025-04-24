import { describe, expect, it, vi, beforeEach, beforeAll, type Mock } from 'vitest'; // Added beforeAll
import { z } from 'zod';
// Use import type for types
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'; // Import type
// Import the actual functions to test
import { registerTools, startMcpServer, type McpServerOptions } from './index.js';
import type { Tool as SylphTool, ToolExecuteOptions, TextPart, JsonPart, ImagePart, AudioPart, FileRefPart } from '@sylphlab/tools-core';

// --- Mocking Setup ---
const mockMcpToolMethod = vi.fn();
const mockMcpConnectMethod = vi.fn();

// Mock the external dependencies
vi.mock('@modelcontextprotocol/sdk/server/mcp.js', async (importOriginal) => {
    const actual = await importOriginal() as typeof import('@modelcontextprotocol/sdk/server/mcp.js');
    return {
        ...actual,
        McpServer: vi.fn().mockImplementation((opts) => ({
            tool: mockMcpToolMethod,
            server: {
                connect: mockMcpConnectMethod,
            },
            options: opts,
        })),
    };
});

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', async (importOriginal) => {
    const actual = await importOriginal() as typeof import('@modelcontextprotocol/sdk/server/stdio.js');
    // Return a simple object inline, avoiding external variables
    return {
        ...actual,
        StdioServerTransport: vi.fn().mockImplementation(() => ({
             __isMockStdioTransport: true // Simple identifier
        })),
    };
});
// --- End Mocking Setup ---


// Helper to create mock Sylph tools (Unchanged)
const createMockTool = (
    name: string,
    description: string,
    inputSchema: z.ZodTypeAny,
    executeResult: TextPart | JsonPart | ImagePart | AudioPart | FileRefPart | Error
): SylphTool<z.ZodTypeAny> => {
    const executeMock = vi.fn().mockImplementation(async () => {
        if (executeResult instanceof Error) {
            throw executeResult;
        }
        if (executeResult.type === 'json') {
            const jsonResultWithSchema: JsonPart = {
                ...executeResult,
                schema: z.any(),
            };
            return [jsonResultWithSchema];
        }
        return [executeResult];
    });
    return { name, description, inputSchema, execute: executeMock };
};


describe('tools-adaptor-mcp', () => {
    // Remove mockServerInstance from here, it's created implicitly by the mock in registerTools tests
    const mockToolExecuteOptions: ToolExecuteOptions = { workspaceRoot: '/mock/workspace' };

    // Define mock tools (Unchanged)
    const mockTextTool = createMockTool('textTool', 'desc1', z.object({ p1: z.string() }), { type: 'text', value: 'result1' });
    const mockJsonTool = createMockTool('jsonTool', 'desc2', z.object({ p2: z.number() }), { type: 'json', value: { data: 'result2' }, schema: z.any() });
    const mockImageTool = createMockTool('imageTool', 'desc3', z.object({ p3: z.boolean() }), { type: 'image', mimeType: 'image/png', data: 'base64data' });
    const mockAudioTool = createMockTool('audioTool', 'desc4', z.object({ p4: z.array(z.string()) }), { type: 'audio', mimeType: 'audio/mpeg', data: 'base64data' });
    const mockFileRefTool = createMockTool('fileRefTool', 'desc5', z.object({ p5: z.string() }), { type: 'fileRef', path: '/path/to/file' });
    const mockErrorTool = createMockTool('errorTool', 'errorDesc', z.object({}), new Error('Tool execution failed'));
    const mockPrimitiveSchemaTool = createMockTool('primitiveSchemaTool', 'primitiveDesc', z.string(), { type: 'text', value: 'primitive result' });
    const mockNonErrorThrowTool = {
        name: 'nonErrorTool',
        description: 'Throws non-error',
        inputSchema: z.object({}),
        execute: vi.fn().mockImplementation(async () => { throw 'Something bad happened'; }),
    } as unknown as SylphTool;

    const allMockTools = [ mockTextTool, mockJsonTool, mockImageTool, mockAudioTool, mockFileRefTool, mockErrorTool, mockPrimitiveSchemaTool, mockNonErrorThrowTool ];


    beforeEach(async () => {
        vi.clearAllMocks(); // Ensure mocks are cleared before each test
    });

    // Test the actual registerTools function
    describe('registerTools', () => {
        // Need a mock server instance for these tests
        let localMockServerInstance: McpServer;
        beforeEach(async () => {
             // Create instance specifically for this suite
             const { McpServer: MockedMcpServerConstructor } = await import('@modelcontextprotocol/sdk/server/mcp.js');
             localMockServerInstance = new MockedMcpServerConstructor({ name: 'reg-test', version: '1', description: 'reg-test' }) as any;
        });

        it('should register each tool with the McpServer', () => {
            registerTools(localMockServerInstance, allMockTools, mockToolExecuteOptions); // Use actual function

            expect(mockMcpToolMethod).toHaveBeenCalledTimes(allMockTools.length);
            allMockTools.forEach((tool, index) => {
                const expectedSchemaShape = tool.inputSchema instanceof z.ZodObject ? tool.inputSchema.shape : tool.inputSchema;
                expect(mockMcpToolMethod).toHaveBeenNthCalledWith(
                    index + 1,
                    tool.name,
                    tool.description,
                    expectedSchemaShape,
                    expect.any(Function)
                );
            });
        });

        it('should register tool with primitive schema correctly', () => {
            registerTools(localMockServerInstance, [mockPrimitiveSchemaTool], mockToolExecuteOptions); // Use actual function
            expect(mockMcpToolMethod).toHaveBeenCalledWith(
                mockPrimitiveSchemaTool.name,
                mockPrimitiveSchemaTool.description,
                mockPrimitiveSchemaTool.inputSchema,
                expect.any(Function)
            );
        });

        it('should call the original tool execute function with correct arguments', async () => {
            registerTools(localMockServerInstance, [mockTextTool], mockToolExecuteOptions); // Use actual function
            const toolCallback = (mockMcpToolMethod as Mock).mock.calls[0][3];
            const args = { p1: 'test' };
            await toolCallback(args);
            expect(mockTextTool.execute).toHaveBeenCalledWith(args, mockToolExecuteOptions);
        });

        // --- Mapping tests remain the same ---
        it('should map text result correctly', async () => {
            registerTools(localMockServerInstance, [mockTextTool], mockToolExecuteOptions);
            const callback = (mockMcpToolMethod as Mock).mock.calls[0][3];
            const result = await callback({ p1: 'test' });
            expect(result).toEqual({ content: [{ type: 'text', text: 'result1' }], isError: false });
        });

        it('should map json result correctly', async () => {
            registerTools(localMockServerInstance, [mockJsonTool], mockToolExecuteOptions);
            const callback = (mockMcpToolMethod as Mock).mock.calls[0][3];
            const result = await callback({ p2: 123 });
            expect(result).toEqual({ content: [{ type: 'text', text: JSON.stringify({ data: 'result2' }, null, 2) }], isError: false });
        });

        it('should map image result correctly', async () => {
            registerTools(localMockServerInstance, [mockImageTool], mockToolExecuteOptions);
            const callback = (mockMcpToolMethod as Mock).mock.calls[0][3];
            const result = await callback({ p3: true });
            expect(result).toEqual({ content: [{ type: 'image', mimeType: 'image/png', data: 'base64data' }], isError: false });
        });

        it('should map audio result correctly', async () => {
            registerTools(localMockServerInstance, [mockAudioTool], mockToolExecuteOptions);
            const callback = (mockMcpToolMethod as Mock).mock.calls[0][3];
            const result = await callback({ p4: ['a', 'b'] });
            expect(result).toEqual({ content: [{ type: 'audio', mimeType: 'audio/mpeg', data: 'base64data' }], isError: false });
        });

        it('should map fileRef result correctly', async () => {
            registerTools(localMockServerInstance, [mockFileRefTool], mockToolExecuteOptions);
            const callback = (mockMcpToolMethod as Mock).mock.calls[0][3];
            const result = await callback({ p5: 'test' });
            expect(result).toEqual({ content: [{ type: 'text', text: 'File reference: /path/to/file' }], isError: false });
        });

        it('should handle errors from tool execution', async () => {
            registerTools(localMockServerInstance, [mockErrorTool], mockToolExecuteOptions);
            const callback = (mockMcpToolMethod as Mock).mock.calls[0][3];
            const result = await callback({});
            expect(result).toEqual({ content: [{ type: 'text', text: 'Error: Tool execution failed' }], isError: true });
            expect(mockErrorTool.execute).toHaveBeenCalledWith({}, mockToolExecuteOptions);
        });

         it('should handle non-Error throws from tool execution', async () => {
            registerTools(localMockServerInstance, [mockNonErrorThrowTool], mockToolExecuteOptions);
            const callback = (mockMcpToolMethod as Mock).mock.calls[0][3];
            const result = await callback({});
            expect(result).toEqual({ content: [{ type: 'text', text: 'Error: Something bad happened' }], isError: true });
            expect(mockNonErrorThrowTool.execute).toHaveBeenCalledWith({}, mockToolExecuteOptions);
        });
    });

    // Test the actual startMcpServer function
    describe('startMcpServer', () => {
        const mockServerOptions: McpServerOptions = {
            name: 'test-server',
            version: '1.0.0',
            description: 'Test MCP Server',
            tools: [mockTextTool], // Use one defined tool
        };

        // Import the constructor here for checks within this suite
        let MockedMcpServerConstructor: ReturnType<typeof vi.fn>;
        let MockedStdioTransport: ReturnType<typeof vi.fn>;

        beforeAll(async () => { // Use beforeAll to import mocks once for the suite
            // Import mocks once for the suite
            const mcpModule = await import('@modelcontextprotocol/sdk/server/mcp.js');
            MockedMcpServerConstructor = mcpModule.McpServer;
            const stdioModule = await import('@modelcontextprotocol/sdk/server/stdio.js');
            MockedStdioTransport = stdioModule.StdioServerTransport;
        });


        it('should initialize McpServer with correct options', async () => {
            await startMcpServer(mockServerOptions, mockToolExecuteOptions);
            // Check constructor call after the function runs
            expect(MockedMcpServerConstructor).toHaveBeenCalledWith({
                name: mockServerOptions.name,
                version: mockServerOptions.version,
                description: mockServerOptions.description,
            });
            expect(MockedMcpServerConstructor).toHaveBeenCalledTimes(1); // Ensure it's called exactly once for this test
        });

        it('should call registerTools (implicitly via mockMcpToolMethod)', async () => {
            await startMcpServer(mockServerOptions, mockToolExecuteOptions);
            expect(mockMcpToolMethod).toHaveBeenCalledTimes(mockServerOptions.tools.length);
            expect(mockMcpToolMethod).toHaveBeenCalledWith(
                mockTextTool.name,
                mockTextTool.description,
                mockTextTool.inputSchema.shape,
                expect.any(Function)
            );
        });

        it('should initialize StdioServerTransport', async () => {
            await startMcpServer(mockServerOptions, mockToolExecuteOptions);
            expect(MockedStdioTransport).toHaveBeenCalledTimes(1);
        });

        it('should connect the server transport', async () => {
            await startMcpServer(mockServerOptions, mockToolExecuteOptions);
            expect(mockMcpConnectMethod).toHaveBeenCalledTimes(1);
            // Remove the unreliable expect.any() check
            // Rely on the objectContaining check
            expect(mockMcpConnectMethod).toHaveBeenCalledWith(expect.objectContaining({ __isMockStdioTransport: true }));
        });

        it('should return the created McpServer instance', async () => {
            const serverInstance = await startMcpServer(mockServerOptions, mockToolExecuteOptions);
            // Check constructor was called (implicitly ensures instance was created)
            expect(MockedMcpServerConstructor).toHaveBeenCalledTimes(1);
            expect(serverInstance).toBeDefined();
            // Check if the returned object has the expected mocked methods
            expect(serverInstance.tool).toBe(mockMcpToolMethod);
            expect(serverInstance.server.connect).toBe(mockMcpConnectMethod);
        });
    });
});