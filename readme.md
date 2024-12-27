# Anthropic MCP Server

A [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol) server that provides intelligent access to Anthropic's API with smart model selection, parallel processing, and configurable defaults. Enables parallel processing and context management while maintaining separate API quotas from Claude Desktop. [More about MCP](https://modelcontextprotocol.io/introduction).

## Features
- Smart model selection based on task complexity
- Parallel processing with configurable concurrency
- Configurable defaults via JSON configuration file
- Separate API quota from Claude Desktop
- Full support for all Anthropic API parameters
- Automatic token estimation and batch processing

## Why Use This Server?
While Claude Desktop uses Anthropic's API internally, this server provides several advantages:
- Separate API quota from Claude Desktop
- Parallel processing capabilities
- Configurable defaults across conversations
- Smart model selection for cost optimization
- Ability to offload heavy processing from main conversation

## Installation
```bash
npm install server-anthropic
```

## Configuration
Create an optional `anthropic-config.json` with your preferred defaults:

```json
{
  "max_tokens": 4096,
  "temperature": 0.7,
  "top_p": 1,
  "metadata": {
    "user_id": "user_123",
    "session_id": "default_session"
  },
  "system": "You are a helpful AI assistant focused on accuracy and clarity.",
  "stop_sequences": ["\n###\n"]
}
```

All configuration parameters are optional. Invalid parameters are ignored with a warning.

## Tool Reference

### `anthropic__create_message`
Create a message using Anthropic's API with smart model selection.

**Arguments:**
```json
{
  "model": {
    "type": "string",
    "description": "Model ID to use (e.g., claude-3-opus-20240229)",
    "optional": true
  },
  "messages": {
    "type": "array",
    "description": "Array of messages for the conversation",
    "required": true,
    "items": {
      "type": "object",
      "properties": {
        "role": {
          "type": "string",
          "enum": ["user", "assistant"]
        },
        "content": {
          "type": "string"
        }
      }
    }
  },
  "system": {
    "type": "string",
    "description": "Optional system prompt",
    "optional": true
  },
  "max_tokens": {
    "type": "number",
    "description": "Maximum number of tokens to generate",
    "optional": true
  },
  "temperature": {
    "type": "number",
    "description": "Temperature for response generation (0.0-1.0)",
    "optional": true
  }
}
```

### `anthropic__batch_process`
Process multiple messages in parallel with automatic model selection.

**Arguments:**
```json
{
  "tasks": {
    "type": "array",
    "description": "Array of message creation tasks",
    "required": true,
    "items": {
      "type": "object",
      "properties": {
        "messages": {
          "type": "array",
          "items": {
            "type": "object",
            "properties": {
              "role": { "type": "string", "enum": ["user", "assistant"] },
              "content": { "type": "string" }
            }
          }
        },
        "system": { "type": "string", "optional": true }
      }
    }
  },
  "concurrency": {
    "type": "number",
    "description": "Number of concurrent API calls (default: 3)",
    "minimum": 1,
    "maximum": 5,
    "optional": true
  }
}
```

### `anthropic__list_models`
List available Anthropic models.

**Arguments:** None required

## Usage with Claude Desktop
Add to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "anthropic": {
      "command": "npx",
      "args": ["-y", "server-anthropic"],
      "env": {
        "ANTHROPIC_API_KEY": "your-api-key-here",
        "ANTHROPIC_CONFIG_PATH": "/path/to/your/anthropic-config.json"  // Optional
      }
    }
  }
}
```

## Usage Patterns

### Research Assistant Pattern
```javascript
// Main Claude conversation delegates research tasks
const researchTasks = [
  { messages: [{ role: "user", content: "Summarize paper X" }] },
  { messages: [{ role: "user", content: "Analyze methodology of Y" }] },
  { messages: [{ role: "user", content: "Compare findings of Z" }] }
];

// Process in parallel via API while main conversation continues
await batchProcess(researchTasks);
```

### Data Processing Pattern
```javascript
// Process large datasets without cluttering main context
const dataChunks = data.map(chunk => ({
  messages: [{
    role: "user",
    content: `Analyze this data: ${JSON.stringify(chunk)}`
  }]
}));

await batchProcess(dataChunks, 5); // Higher concurrency for data processing
```

### Hierarchical Processing Pattern
```javascript
// Main Claude conversation handles high-level logic
// API handles granular tasks with appropriate models
const tasks = subtasks.map(task => ({
  messages: [{ role: "user", content: task }],
  system: "You are focusing only on this specific subtask"
}));
```

## Smart Model Selection
The server automatically selects the most appropriate model based on task complexity:
- Simple tasks (complexity < 10): claude-3-haiku
- Medium tasks (complexity < 30): claude-3-sonnet
- Complex tasks: claude-3-opus

Complexity is calculated based on:
- Text length
- Number of questions
- Presence of code blocks
- Structured data complexity

## Dependencies
- @modelcontextprotocol/sdk - MCP implementation
- axios - HTTP client

## Environment Variables
- `ANTHROPIC_API_KEY` (required) - Your Anthropic API key
- `ANTHROPIC_CONFIG_PATH` (optional) - Path to your configuration JSON file
- `ANTHROPIC_API_URL` (optional) - Custom API endpoint (defaults to https://api.anthropic.com)

## License
MIT