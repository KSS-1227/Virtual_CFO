#!/usr/bin/env node

/**
 * VirtualCFO AI Streaming Demo
 * 
 * This script demonstrates the real-time AI streaming functionality.
 * Run with: node demo-streaming.js
 */

const readline = require('readline');

// Demo configuration
const API_BASE_URL = 'http://localhost:5001';
const DEMO_TOKEN = 'your-demo-token'; // Replace with actual token

// ANSI colors for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  cyan: '\x1b[36m'
};

async function streamAIDemo(prompt) {
  console.log(`${colors.blue}🤖 AI CFO:${colors.reset} `);
  
  try {
    const response = await fetch(`${API_BASE_URL}/api/ai/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${DEMO_TOKEN}`
      },
      body: JSON.stringify({ prompt })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let tokenCount = 0;
    let currentEvent = '';

    while (true) {
      const { value, done } = await reader.read();
      
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.trim() === '') continue;
        
        if (line.startsWith('event: ')) {
          currentEvent = line.slice(7).trim();
        } else if (line.startsWith('data: ')) {
          try {
            const data = JSON.parse(line.slice(6));
            
            switch (currentEvent) {
              case 'token':
                process.stdout.write(`${colors.green}${data.text}${colors.reset}`);
                tokenCount++;
                break;
                
              case 'meta':
                console.log(`\n\n${colors.cyan}📊 Metadata:${colors.reset}`);
                console.log(`   Total Tokens: ${data.totalTokens}`);
                console.log(`   Model: ${data.model}`);
                console.log(`   Context Used: ${JSON.stringify(data.contextUsed)}`);
                break;
                
              case 'error':
                console.log(`\n${colors.red}❌ Error: ${data.error}${colors.reset}`);
                return;
                
              case 'done':
                console.log(`\n\n${colors.yellow}✅ Stream completed! (${tokenCount} tokens)${colors.reset}\n`);
                return;
            }
          } catch (parseError) {
            // Ignore parsing errors for incomplete chunks
          }
        }
      }
    }
  } catch (error) {
    console.log(`\n${colors.red}❌ Connection Error: ${error.message}${colors.reset}\n`);
  }
}

async function runDemo() {
  console.log(`${colors.bright}${colors.blue}`);
  console.log('╔══════════════════════════════════════════════════════════════╗');
  console.log('║                    VirtualCFO AI Streaming Demo             ║');
  console.log('║                                                              ║');
  console.log('║  Test real-time AI responses with token-level streaming     ║');
  console.log('║  Type your financial questions and see AI respond live!     ║');
  console.log('╚══════════════════════════════════════════════════════════════╝');
  console.log(`${colors.reset}\n`);

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  // Demo prompts
  const demoPrompts = [
    "What are the key financial metrics for a small retail business?",
    "How can I improve my cash flow management?",
    "What are the best practices for expense tracking?",
    "Analyze the profitability of my restaurant business"
  ];

  console.log(`${colors.yellow}💡 Try these sample prompts:${colors.reset}`);
  demoPrompts.forEach((prompt, i) => {
    console.log(`   ${i + 1}. ${prompt}`);
  });
  console.log(`\n${colors.cyan}Or type your own question below:${colors.reset}\n`);

  const askQuestion = () => {
    rl.question(`${colors.bright}You: ${colors.reset}`, async (input) => {
      if (input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        console.log(`${colors.yellow}👋 Thanks for trying VirtualCFO AI Streaming!${colors.reset}`);
        rl.close();
        return;
      }

      if (input.trim() === '') {
        askQuestion();
        return;
      }

      // Check if user entered a number for demo prompts
      const promptIndex = parseInt(input) - 1;
      if (promptIndex >= 0 && promptIndex < demoPrompts.length) {
        input = demoPrompts[promptIndex];
        console.log(`${colors.bright}You: ${colors.reset}${input}`);
      }

      await streamAIDemo(input);
      askQuestion();
    });
  };

  askQuestion();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(`\n${colors.yellow}👋 Goodbye!${colors.reset}`);
  process.exit(0);
});

// Run the demo
if (require.main === module) {
  runDemo().catch(console.error);
}

module.exports = { streamAIDemo, runDemo };