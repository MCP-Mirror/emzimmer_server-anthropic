# Anthropic API MCP Server
A [Model Context Protocol (MCP)](https://github.com/modelcontextprotocol) server that provides access to Anthropic's AI models through their official API. List available models and send messages to Claude using a secure, standardized interface. [More about MCP](https://modelcontextprotocol.io/introduction).

[![Anthropic API MCP Server](https://glama.ai/mcp/servers/badge)]()

## Features
* List all available Anthropic models
* Send messages to any Anthropic model
* Secure API key management
* Support for workspace segmentation
* Automatic API versioning
* Comprehensive error handling
* Experimental context window management

## Why Use This Server?
Unlike direct API integration, this server:
* Provides a standardized MCP interface for Anthropic's API
* Handles authentication and versioning automatically
* Supports workspace isolation for different use cases
* Integrates seamlessly with Claude Desktop and other MCP clients
* Includes detailed error messages and validation
* Potentially extends conversation context windows through distributed processing

## Context Window Management Hypothesis
This server explores efficient context window management through distributed processing:

**Claim:** Offloading processing to separate API calls through the MCP server may reduce context window pressure on the main Claude Desktop conversation.

**Primary Hypothesis:** By branching conversation processing across multiple isolated API instances, the total effective context window of a conversation can be extended beyond standard limitations.

**Key Mechanisms:**
* Main conversation (trunk) retains only final outputs and discussion
* Individual API calls maintain isolated contexts
* Processing can be distributed across multiple model instances

**Testing Scenarios:**
1. Context Window Extension
   * Compare context limits with and without API offloading
   * Measure conversation longevity in both scenarios
   * Track rate limit encounters

2. Processing Distribution
   * Haiku for rapid initial processing
   * Sonnet for medium-sized aggregation
   * Opus for comprehensive analysis

## Installation
```bash
npm install server-anthropic
```

## Tool Reference

### `list_models`
Lists all available Anthropic models and their capabilities.

**Arguments:**
```json
{
  // No arguments required
}
```

**Returns:**
```json
{
  "models": [
    {
      "name": "claude-3-opus-20240229",
      "description": "Most powerful model for highly complex tasks",
      ...
    },
    ...
  ]
}
```

### `send_message`
Send a message to an Anthropic model using the Messages API.

**Arguments:**
```json
{
  "messages": {
    "type": "array",
    "description": "Array of messages to send",
    "items": {
      "role": "user | assistant",
      "content": "string"
    },
    "required": true
  },
  "model": {
    "type": "string",
    "description": "Model ID to use",
    "default": "claude-3-opus-20240229"
  },
  "max_tokens": {
    "type": "number",
    "description": "Maximum tokens to generate",
    "default": 1024
  }
}
```

**Returns:**
```json
{
  "content": [
    {
      "type": "text",
      "text": "Model response..."
    }
  ]
}
```

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
        "ANTHROPIC_WORKSPACE_ID": "optional-workspace-id"
      }
    }
  }
}
```

## Environment Variables
| Variable | Required | Description |
|----------|----------|-------------|
| ANTHROPIC_API_KEY | Yes | Your Anthropic API key from [console.anthropic.com](https://console.anthropic.com/account/keys) |
| ANTHROPIC_WORKSPACE_ID | No | Optional workspace ID for usage segmentation |

## Dependencies
* @modelcontextprotocol/sdk - Core MCP functionality
* @anthropic-ai/sdk - Official Anthropic API client

## Error Handling
The server provides detailed error messages for common issues:
* Invalid API key
* Missing required parameters
* Rate limiting
* Model-specific errors
* Network connectivity issues

## Development
1. Clone the repository
2. Install dependencies: `npm install`
3. Set up environment variables in `.env`:
   ```
   ANTHROPIC_API_KEY=your-api-key
   ANTHROPIC_WORKSPACE_ID=optional-workspace
   ```
4. Start the server: `npm start`

## Version Notes (0.1.0-beta)
Current beta version focuses on:
* Core MCP server functionality
* Context window management testing
* API integration stability
* Initial hypothesis validation

Known limitations:
* Context window behavior requires further testing
* Rate limiting patterns under investigation
* Workspace segmentation impact on context management undefined

## License
MIT