import React, { useState, useEffect, useRef } from 'react';
import { X, Send, Bot, RotateCcw, Sparkles } from 'lucide-react';
import { marked } from 'marked';
import './Chatbot.css'; // Import strict pixel-perfect stylesheet

// Configure marked for smooth rendering
marked.setOptions({
  breaks: true,
  gfm: true
});

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [inputValue, setInputValue] = useState('');
  
  // Load conversation history from localStorage
  const [messages, setMessages] = useState(() => {
    const saved = localStorage.getItem('chatbot_history');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      } catch (e) {
        console.error("Error loading chat history:", e);
      }
    }
    return [
      {
        id: 'welcome',
        sender: 'bot',
        text: 'Hello! I am GeoBot, your expert Technology & Telemetry Advisor. Ask me anything about software development, database systems, data engineering, or the GeoMon capacity metrics, and I will provide professional, data-driven insights.',
        time: new Date().toISOString(),
      }
    ];
  });

  const messagesEndRef = useRef(null);
  const chatInputRef = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    localStorage.setItem('chatbot_history', JSON.stringify(messages));
    scrollToBottom();
  }, [messages]);

  // Focus input when chat opens
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        chatInputRef.current?.focus();
        scrollToBottom();
      }, 100);
    }
  }, [isOpen]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleClearHistory = () => {
    if (window.confirm("Are you sure you want to clear the conversation history?")) {
      const initialMsg = [
        {
          id: 'welcome',
          sender: 'bot',
          text: 'Hello! I am GeoBot, your expert Technology & Telemetry Advisor. Ask me anything about software development, database systems, data engineering, or the GeoMon capacity metrics, and I will provide professional, data-driven insights.',
          time: new Date().toISOString(),
        }
      ];
      setMessages(initialMsg);
      localStorage.setItem('chatbot_history', JSON.stringify(initialMsg));
    }
  };

  const handleSendMessage = async (e) => {
    e?.preventDefault();
    if (!inputValue.trim() || isTyping) return;

    const userMessageText = inputValue.trim();
    setInputValue('');

    const userMsg = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: userMessageText,
      time: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsTyping(true);

    const token = localStorage.getItem('token');
    
    // Construct request history payload
    const historyPayload = messages
      .filter(msg => msg.id !== 'welcome' && !msg.text.startsWith('⚠️'))
      .map(msg => ({
        role: msg.sender === 'user' ? 'user' : 'assistant',
        content: msg.text
      }));

    // Placeholder bot message for streaming text
    const botMsgId = `bot-${Date.now()}`;
    const botMsgPlaceholder = {
      id: botMsgId,
      sender: 'bot',
      text: '',
      time: new Date().toISOString(),
    };

    setMessages(prev => [...prev, botMsgPlaceholder]);

    const getClientNameFromUrl = () => {
      const hash = window.location.hash || '';
      const match = hash.match(/\/(telemetry-client-details|telemetry-client-databases|telemetry-client-tables)\/([^/?#]+)/);
      return match ? decodeURIComponent(match[2]) : null;
    };
    const currentClient = getClientNameFromUrl();

    try {
      const response = await fetch('/api/new-features/chat/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : ''
        },
        body: JSON.stringify({
          message: userMessageText,
          history: historyPayload,
          client_name: currentClient
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let streamBuffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        streamBuffer += chunk;

        // Process SSE lines
        const lines = streamBuffer.split('\n');
        streamBuffer = lines.pop() || ''; // Keep partial line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const dataStr = line.slice(6).trim();
            if (dataStr === '[DONE]') continue;
            
            try {
              const data = JSON.parse(dataStr);
              if (data.error) {
                // Propagate actual backend errors to the outer catch block
                throw new Error(data.error);
              }
              if (data.text) {
                // Update bot message state incrementally
                setMessages(prev => {
                  return prev.map(msg => {
                    if (msg.id === botMsgId) {
                      return { ...msg, text: msg.text + data.text };
                    }
                    return msg;
                  });
                });
              }
            } catch (err) {
              console.error("Stream parse error:", err);
              // Bubble the error up to the outer catch block to gracefully update typing state
              throw err;
            }
          }
        }
      }
    } catch (err) {
      console.error("Streaming error:", err);
      setMessages(prev => {
        return prev.map(msg => {
          if (msg.id === botMsgId) {
            return {
              ...msg,
              text: `⚠️ Error: ${err.message || 'Unable to connect to OpenAI service.'}`
            };
          }
          return msg;
        });
      });
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // Safe Markdown parser
  const renderMarkdown = (text) => {
    try {
      return { __html: marked.parse(text) };
    } catch (e) {
      return { __html: text };
    }
  };

  return (
    <div className="chatbot-widget-root">
      {/* Floating Toggle Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="chatbot-toggle-btn"
        title="Chat with GeoBot"
      >
        {isOpen ? (
          <X className="w-6 h-6" strokeWidth={3} />
        ) : (
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <Sparkles style={{ position: 'absolute', top: '-6px', right: '-10px', width: '18px', height: '18px', color: '#fde047' }} className="animate-pulse" />
          </div>
        )}
      </button>

      {/* Chat Window Container */}
      {isOpen && (
        <div className="chatbot-popup">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-left">
              <div className="chatbot-header-avatar">
                <Bot className="w-6 h-6" />
                <span className="chatbot-header-dot" />
              </div>
              <div className="chatbot-header-info">
                <div className="chatbot-header-title-row">
                  <h4 className="chatbot-header-title">GeoBot</h4>
                  <span className="chatbot-header-badge">ONLINE</span>
                </div>
                <p className="chatbot-header-subtitle">30+ Years Engineering Advisor</p>
              </div>
            </div>
            
            {/* Window Controls */}
            <div className="chatbot-header-controls">
              <button 
                onClick={handleClearHistory} 
                className="chatbot-control-btn" 
                title="Clear Chat"
              >
                <RotateCcw className="w-4 h-4" />
              </button>

              <button 
                onClick={() => setIsOpen(false)} 
                className="chatbot-control-btn" 
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Message List */}
          <div className="chatbot-messages">
            {messages.map((msg) => {
              const isUser = msg.sender === 'user';
              return (
                <div
                  key={msg.id}
                  className={`chatbot-message-row ${isUser ? 'user' : ''}`}
                >
                  {/* Avatar */}
                  {!isUser && (
                    <div className="chatbot-message-avatar">
                      <Bot className="w-4 h-4" />
                    </div>
                  )}

                  {/* Message Bubble */}
                  <div
                    className={`chatbot-bubble ${isUser ? 'user' : 'bot'}`}
                  >
                    {isUser ? (
                      <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{msg.text}</p>
                    ) : (
                      <div 
                        className="chatbot-prose"
                        dangerouslySetInnerHTML={renderMarkdown(msg.text || '...')} 
                      />
                    )}
                  </div>
                </div>
              );
            })}

            {/* Typing Indicator */}
            {isTyping && messages[messages.length - 1]?.text === '' && (
              <div className="chatbot-message-row">
                <div className="chatbot-message-avatar">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="chatbot-bubble bot" style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '12px 20px' }}>
                  <span className="chatbot-bounce-dot" />
                  <span className="chatbot-bounce-dot" />
                  <span className="chatbot-bounce-dot" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Quick Suggestions */}
          {messages.length === 1 && (
            <div style={{ display: 'flex', gap: '6px', padding: '0 16px 8px 16px', flexWrap: 'wrap' }}>
              {[
                "MySQL status for Cropin?",
                "Unresolved support tickets?",
                "Tables with high space growth?",
                "Show uptime summary reports?"
              ].map((suggestion, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => {
                    setInputValue(suggestion);
                    chatInputRef.current?.focus();
                  }}
                  style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.06)',
                    color: '#94a3b8',
                    padding: '5px 10px',
                    borderRadius: '12px',
                    fontSize: '0.74rem',
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                    e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)';
                    e.currentTarget.style.color = '#fff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)';
                    e.currentTarget.style.color = '#94a3b8';
                  }}
                >
                  {suggestion}
                </button>
              ))}
            </div>
          )}

          {/* Chat Input form */}
          <form onSubmit={handleSendMessage} className="chatbot-footer">
            <div className="chatbot-input-container">
              <input
                ref={chatInputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask GeoBot..."
                className="chatbot-input-field"
              />
            </div>
            <button
              type="submit"
              disabled={!inputValue.trim() || isTyping}
              className="chatbot-send-btn"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}
    </div>
  );
}
