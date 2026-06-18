import { useState, useRef, useEffect } from 'react';
import { useClientAuthStore } from '../stores/clientAuthStore';
import '../styles/ChatBot.css';

export default function ClientChatBot() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState('');
  const messagesEndRef = useRef(null);
  const { token, isAuthenticated } = useClientAuthStore();

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    setError('');
    const userMessage = input;
    setInput('');

    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setLoading(true);

    try {
      const apiUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

      const response = await fetch(`${apiUrl}/client-chatbot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ message: userMessage }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `Request failed (status ${response.status})`);
      }

      const data = await response.json();

      if (data.success || data.message) {
        setMessages(prev => [...prev, { role: 'assistant', content: data.message || 'Unable to get response' }]);
      } else {
        throw new Error(data.error || 'Unknown error occurred');
      }
    } catch (err) {
      setError(err.message || 'Failed to get response. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClearChat = () => {
    setMessages([]);
    setError('');
  };

  // Only show when the client is logged in
  if (!isAuthenticated) return null;

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="chat-toggle"
        title="Open AI Assistant"
        aria-label="Open chat"
      >
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
          <line x1="8" y1="10" x2="16" y2="10"/>
          <line x1="8" y1="14" x2="12" y2="14"/>
        </svg>
      </button>
    );
  }

  return (
    <div className="chatbot-container">
      <div className="chatbot-header">
        <div className="chatbot-title-area">
          <h3>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ display:'inline', verticalAlign:'middle', marginRight:'0.4rem' }}>
              <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M12 2v4"/><circle cx="12" cy="5" r="1.5" fill="currentColor" stroke="none"/>
              <path d="M7 11V8a5 5 0 0 1 10 0v3"/><line x1="8" y1="15" x2="8" y2="17"/><line x1="16" y1="15" x2="16" y2="17"/>
            </svg>
            AI Assistant
          </h3>
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
            <p style={{ fontWeight: 700, fontSize: '15px', color: '#1e293b' }}>Hello! I'm your personal assistant.</p>
            <p>Ask me about:</p>
            <ul>
              <li>Your orders &amp; tracking</li>
              <li>Available products</li>
              <li>Your spending summary</li>
              <li>Your account info</li>
            </ul>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`message message-${msg.role}`}>
            <div className="message-content">{msg.content}</div>
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
              {' '}Thinking...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {error && <div className="chatbot-error">⚠️ {error}</div>}

      <div className="chatbot-input-area">
        <div className="chatbot-input">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
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
