/**
 * Standalone Production-Ready Node.js Express + OpenAI SDK Backend Server
 * Provides standard completion and Server-Sent Events (SSE) streaming endpoints.
 */

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { OpenAI } = require('openai');

// Load environment variables from .env file
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8000;

// Enable CORS and JSON parsing
app.use(cors());
app.use(express.json());

// Initialize OpenAI client using the official SDK
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Endpoint 1: Standard completion (Non-streaming)
 * POST /api/chat
 */
app.post('/api/chat', async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message field is required.' });
  }

  try {
    // Construct request history payload with system prompt engineering
    const messages = [
      {
        role: 'system',
        content: 'You are ChatGPT, an expert AI assistant with 30+ years of software engineering, database administration (DBA), system architecture, and general problem-solving experience. Provide clear, accurate, complete, and production-ready step-by-step guidance. Use standard Markdown formatting for code snippets.'
      }
    ];

    if (history && Array.isArray(history)) {
      history.forEach(item => {
        const role = item.role || item.sender;
        const normalizedRole = (role === 'bot' || role === 'assistant') ? 'assistant' : 'user';
        const content = item.content || item.text;
        if (content) {
          messages.push({ role: normalizedRole, content });
        }
      });
    }

    // Add final user message
    messages.push({ role: 'user', content: message });

    // Call OpenAI completion
    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 1200,
      temperature: 0.7,
    });

    const reply = response.choices[0]?.message?.content || '';
    return res.json({ response: reply });

  } catch (error) {
    console.error('OpenAI Error:', error);
    return res.status(500).json({
      error: error.message || 'An unexpected error occurred while communicating with OpenAI.'
    });
  }
});

/**
 * Endpoint 2: High-Performance SSE Streaming Response
 * POST /api/chat/stream
 */
app.post('/api/chat/stream', async (req, res) => {
  const { message, history } = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message field is required.' });
  }

  // Set SSE response headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  try {
    const messages = [
      {
        role: 'system',
        content: 'You are ChatGPT, an expert AI assistant with 30+ years of software engineering, database administration (DBA), system architecture, and general problem-solving experience. Provide clear, accurate, complete, and production-ready step-by-step guidance. Use standard Markdown formatting for code snippets.'
      }
    ];

    if (history && Array.isArray(history)) {
      history.forEach(item => {
        const role = item.role || item.sender;
        const normalizedRole = (role === 'bot' || role === 'assistant') ? 'assistant' : 'user';
        const content = item.content || item.text;
        if (content) {
          messages.push({ role: normalizedRole, content });
        }
      });
    }

    messages.push({ role: 'user', content: message });

    // Call OpenAI chat completion with streaming active
    const stream = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      max_tokens: 1200,
      temperature: 0.7,
      stream: true,
    });

    for await (const chunk of stream) {
      const text = chunk.choices[0]?.delta?.content || '';
      if (text) {
        res.write(`data: ${JSON.stringify({ text })}\n\n`);
      }
    }

    // Terminate the SSE stream
    res.write('data: [DONE]\n\n');
    res.end();

  } catch (error) {
    console.error('OpenAI Stream Error:', error);
    res.write(`data: ${JSON.stringify({ error: error.message || 'Stream processing encountered an error.' })}\n\n`);
    res.end();
  }
});

// Start listening
app.listen(PORT, () => {
  console.log(`🚀 Chatbot Node.js Express server is active on port ${PORT}`);
});
