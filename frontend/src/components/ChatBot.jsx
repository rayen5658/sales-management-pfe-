import { useState, useRef, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import '../styles/ChatBot.css';

export default function ChatBot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const { token, isAuthenticated } = useAuthStore();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    setError('');
    const userMessage = input;
    setInput('');
    
    // Add user message to chat
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
      
      const response = await fetch(`${apiUrl}/chatbot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: userMessage,
          conversationId: 'default'
        })
      });


      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (status ${response.status})`);
      }

      const data = await response.json();
      
      if (data.success || data.message) {
        setMessages(prev => [...prev, { 
          role: 'assistant', 
          content: data.message || 'Unable to get response' 
        }]);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      const errorMsg = err.message || 'Failed to get response from AI. Please try again.';
      setError(errorMsg);
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: `❌ Error: ${errorMsg}` 
      }]);
      console.error('Chat error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError('');
  };

  // Don't show chatbot if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  if (!isOpen) {
    return (
      <button 
        onClick={() => setIsOpen(true)}
        className="chat-toggle"
        title="Open AI Assistant"
        aria-label="Open chat"
      >
        💬
      </button>
    );
  }

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <div className="chatbot-title-area">
          <h3>🤖 AI Assistant</h3>
          <span className="chatbot-status">Ready to help</span>
        </div>
        <div className="chatbot-controls">
          <button 
            className="chatbot-clear-btn" 
            onClick={handleClearChat}
            title="Clear conversation"
            aria-label="Clear chat history"
          >
            🗑️
          </button>
          <button 
            className="chatbot-close-btn"
            onClick={() => setIsOpen(false)}
            title="Close chat"
            aria-label="Close chat"
          >
            ✕
          </button>
        </div>
      </div>

      <div className="chatbot-messages">
        {messages.length === 0 && (
          <div className="chatbot-welcome">
            <p>👋 Hello! I'm your AI assistant.</p>
            <p>Ask me anything about:</p>
            <ul>
              <li>📦 Products and inventory</li>
              <li>👥 Clients and accounts</li>
              <li>📋 Orders and sales</li>
              <li>📊 Analytics and reports</li>
            </ul>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <div className="message-content">
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="message message-assistant">
            <div className="message-content">
              <span className="typing-indicator">
                <span></span>
                <span></span>
                <span></span>
              </span>
              Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && (
        <div className="chatbot-error">
          ⚠️ {error}
        </div>
      )}

      <div className="chatbot-input-area">
        <div className="chatbot-input">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            placeholder="Type your question here..."
            disabled={loading}
            aria-label="Chat message input"
          />
          <button 
            onClick={handleSend} 
            disabled={loading || !input.trim()}
            className="send-btn"
            aria-label="Send message"
          >
            {loading ? '⏳' : '➤'}
          </button>
        </div>
        <small className="chatbot-hint">Press Enter to send</small>
      </div>
    </div>
  );
}
