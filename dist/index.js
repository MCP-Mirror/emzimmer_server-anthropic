import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ErrorCode, McpError, ListToolsRequestSchema, CallToolRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import Anthropic from '@anthropic-ai/sdk';

// Load configuration
function loadConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const workspace = process.env.ANTHROPIC_WORKSPACE_ID; // Optional workspace ID for usage segmentation
  
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required. Generate one at https://console.anthropic.com/account/keys");
  }
  
  return { apiKey, workspace };
}

// Set up MCP server
const config = loadConfig();
const client = new Anthropic({
  apiKey: config.apiKey,
  ...(config.workspace && { workspace: config.workspace })
});

const server = new Server({
  name: "server-anthropic",
  version: "0.1.0"
}, {
  capabilities: { tools: {} }
});

// Define available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "list_models",
    description: "List all available Anthropic models and their capabilities. Access requires a valid API key configured through the ANTHROPIC_API_KEY environment variable.",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }, {
    name: "send_message",
    description: "Send a message to an Anthropic model using the Messages API. Requires authentication via ANTHROPIC_API_KEY environment variable. Optionally supports workspace segmentation via ANTHROPIC_WORKSPACE_ID.",
    inputSchema: {
      type: "object",
      properties: {
        messages: {
          type: "array",
          description: "Array of messages to send",
          items: {
            type: "object",
            properties: {
              role: {
                type: "string",
                enum: ["user", "assistant"]
              },
              content: {
                type: "string"
              }
            },
            required: ["role", "content"]
          }
        },
        model: {
          type: "string",
          description: "Model ID to use (e.g., claude-3-opus-20240229)",
          default: "claude-3-opus-20240229"
        },
        max_tokens: {
          type: "number",
          description: "Maximum tokens to generate",
          default: 1024
        }
      },
      required: ["messages"]
    }
  }]
}));

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "list_models": {
        const models = await client.models.list();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(models, null, 2)
          }]
        };
      }
      case "send_message": {
        if (!Array.isArray(args.messages) || args.messages.length === 0) {
          throw new McpError(ErrorCode.InvalidParams, "Messages array is required");
        }

        const result = await client.messages.create({
          model: args.model || "claude-3-opus-20240229",
          max_tokens: args.max_tokens || 1024,
          messages: args.messages
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    // Handle API errors
    if (error instanceof Anthropic.APIError) {
      if (error.status === 401) {
        return {
          content: [{
            type: "text",
            text: "Invalid API key. Please check your ANTHROPIC_API_KEY environment variable."
          }],
          isError: true
        };
      }
      if (error.status === 403) {
        return {
          content: [{
            type: "text",
            text: "Access forbidden. Please verify your API key permissions and workspace access."
          }],
          isError: true
        };
      }
      return {
        content: [{
          type: "text",
          text: `Anthropic API error: ${error.message}`
        }],
        isError: true
      };
    }
    
    // Handle other errors
    console.error(error);
    return {
      content: [{
        type: "text",
        text: error.message
      }],
      isError: true
    };
  }
});

// Start server
const transport = new StdioServerTransport();
server.connect(transport).catch(error => {
  console.error(`Server failed to start: ${error.message}`);
  process.exit(1);
});