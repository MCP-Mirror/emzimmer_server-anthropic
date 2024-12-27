import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  ErrorCode,
  McpError,
  ListToolsRequestSchema,
  CallToolRequestSchema
} from "@modelcontextprotocol/sdk/types.js";
import axios from 'axios';

// Load config from environment variables and optional config file
function loadConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is required");
  }

  let userPreferences = {};
  const configPath = process.env.ANTHROPIC_CONFIG_PATH;
  
  if (configPath) {
    try {
      userPreferences = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      console.error(`Loaded user preferences from ${configPath}`);
    } catch (error) {
      console.error(`Warning: Failed to load config file: ${error.message}`);
    }
  }

  // Validate userPreferences against known Anthropic parameters
  const validParameters = new Set([
    'max_tokens',
    'metadata',
    'stop_sequences',
    'system',
    'temperature',
    'top_p',
    'top_k'
  ]);

  // Remove any invalid parameters but don't error
  Object.keys(userPreferences).forEach(key => {
    if (!validParameters.has(key)) {
      console.error(`Warning: Ignoring invalid parameter in config: ${key}`);
      delete userPreferences[key];
    }
  });

  return {
    apiKey,
    baseURL: process.env.ANTHROPIC_API_URL || "https://api.anthropic.com",
    preferences: userPreferences
  };
}

// Anthropic API client
// Task complexity estimation helper
function estimateComplexity(text) {
  // Basic heuristics for task complexity
  const factors = {
    length: text.length,
    questionMarks: (text.match(/\?/g) || []).length,
    codeBlocks: (text.match(/```/g) || []).length,
    structuredData: (text.match(/[{[].*[}\]]/g) || []).length
  };
  
  const score = factors.length / 100 + 
                factors.questionMarks * 2 + 
                factors.codeBlocks * 5 +
                factors.structuredData * 3;
                
  return score;
}

import fs from 'fs';

class AnthropicClient {
  constructor(config) {
    this.client = axios.create({
      baseURL: config.baseURL,
      headers: {
        'x-api-key': config.apiKey,
        'anthropic-version': '2024-02-29',
        'content-type': 'application/json'
      }
    });
    this.preferences = config.preferences;
  }

  async createMessage(params) {
    // Smart model selection based on task complexity
    if (!params.model) {
      const complexity = params.messages.reduce((acc, msg) => 
        acc + estimateComplexity(msg.content), 0);
      
      params.model = complexity < 10 ? 'claude-3-haiku-20240307' :
                    complexity < 30 ? 'claude-3-sonnet-20240229' :
                    'claude-3-opus-20240229';
    }
    
    // Auto-batch for large requests
    const tokenEstimate = params.messages.reduce((acc, msg) => 
      acc + msg.content.length / 4, 0);
      
    if (tokenEstimate > 150000) { // Large context
      throw new Error('Message too large - use batch processing endpoint');
    }
    try {
      // Merge user preferences with request params, letting request params take precedence
      const requestBody = {
        model: params.model || 'claude-3-opus-20240229',
        messages: params.messages,
        ...this.preferences,  // Apply user preferences from config
        ...params,  // Request params override preferences
        
        // Special handling for metadata to allow merging instead of overriding
        metadata: {
          ...this.preferences.metadata,
          ...params.metadata
        }
      };
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Anthropic API error: ${error.response.data.error?.message || error.message}`);
      }
      throw error;
    }
  }

  async batchProcess(tasks, concurrency = 3) {
    const results = [];
    const errors = [];
    
    // Process in chunks based on concurrency
    for (let i = 0; i < tasks.length; i += concurrency) {
      const chunk = tasks.slice(i, i + concurrency);
      const promises = chunk.map(async (task) => {
        try {
          return await this.createMessage(task);
        } catch (error) {
          errors.push({ taskIndex: i, error: error.message });
          return null;
        }
      });
      
      const chunkResults = await Promise.all(promises);
      results.push(...chunkResults.filter(r => r !== null));
    }
    
    return { results, errors };
  }

  async listModels() {
    try {
      const response = await this.client.get('/v1/models');
      return response.data;
    } catch (error) {
      if (error.response) {
        throw new Error(`Anthropic API error: ${error.response.data.error?.message || error.message}`);
      }
      throw error;
    }
  }
}

// MCP Server setup
const config = loadConfig();
const client = new AnthropicClient(config);

const server = new Server({
  name: "anthropic-mcp-server",
  version: "1.0.0"
}, {
  capabilities: { tools: {} }
});

// Tool definitions
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [{
    name: "anthropic__batch_process",
    description: "Process multiple messages in parallel with automatic model selection",
    inputSchema: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          items: {
            type: "object",
            properties: {
              messages: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    role: { type: "string", enum: ["user", "assistant"] },
                    content: { type: "string" }
                  },
                  required: ["role", "content"]
                }
              },
              system: { type: "string" }
            },
            required: ["messages"]
          }
        },
        concurrency: {
          type: "number",
          description: "Number of concurrent API calls (default: 3)",
          minimum: 1,
          maximum: 5
        }
      },
      required: ["tasks"]
    }
  }, {
    name: "anthropic__create_message",
    description: "Create a message using Anthropic's API",
    inputSchema: {
      type: "object",
      properties: {
        model: {
          type: "string",
          description: "Model ID to use (e.g., claude-3-opus-20240229)"
        },
        messages: {
          type: "array",
          description: "Array of messages for the conversation",
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
        system: {
          type: "string",
          description: "Optional system prompt"
        },
        max_tokens: {
          type: "number",
          description: "Maximum number of tokens to generate"
        },
        temperature: {
          type: "number",
          description: "Temperature for response generation (0.0-1.0)"
        }
      },
      required: ["messages"]
    }
  }, {
    name: "anthropic__list_models",
    description: "List available Anthropic models",
    inputSchema: {
      type: "object",
      properties: {}
    }
  }]
}));

// Tool handlers
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "anthropic__create_message": {
        const result = await client.createMessage(args);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      case "anthropic__batch_process": {
        const { tasks, concurrency } = args;
        const result = await client.batchProcess(tasks, concurrency);
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      case "anthropic__list_models": {
        const result = await client.listModels();
        return {
          content: [{
            type: "text",
            text: JSON.stringify(result, null, 2)
          }]
        };
      }
      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
    }
  } catch (error) {
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