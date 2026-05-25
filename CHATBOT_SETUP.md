# 🤖 AI Chatbot Integration - Setup Guide

## ✅ What's Been Implemented

Your app now has a fully integrated AI chatbot (ChatGPT-powered) with:
- **Backend**: Express route for handling chat messages (`/api/chatbot/chat`)
- **Frontend**: Beautiful floating chat widget with conversation history
- **Authentication**: Chatbot is protected - only authenticated users can access it
- **Conversation Memory**: Maintains chat history during the session

---

## 📋 Quick Setup (2 Steps)

### Step 1: Install Backend Dependencies
```bash
cd backend
npm install
```

This installs the `openai` package needed for ChatGPT integration.

### Step 2: Get OpenAI API Key & Update .env

1. **Go to** [platform.openai.com](https://platform.openai.com)
2. **Sign up** (or log in if you have an account)
3. **Navigate to** Settings → API Keys
4. **Click** "Create new secret key"
5. **Copy** the key (you'll only see it once!)

6. **Update** `backend/.env`:
```env
OPENAI_API_KEY=sk-your-actual-api-key-here
```

Replace `sk-your-actual-api-key-here` with your actual API key from OpenAI.

---

## 🚀 Running the Application

```bash
# Terminal 1: Start Backend
cd backend
npm start

# Terminal 2: Start Frontend
cd frontend
npm run dev
```

---

## 💬 Using the Chatbot

1. **Log in** to the application
2. **Click** the 💬 button in the bottom-right corner
3. **Ask questions** like:
   - "How many products do we have?"
   - "Tell me about our sales this month"
   - "Help me with client management"
   - "What orders are pending?"

---

## 🔧 Files Created/Modified

### Backend
- ✅ `backend/routes/chatbot.js` - Chat API endpoint
- ✅ `backend/routes.js` - Added chatbot routes
- ✅ `backend/package.json` - Added openai dependency
- ✅ `backend/.env` - Added OPENAI_API_KEY

### Frontend
- ✅ `frontend/src/components/ChatBot.jsx` - Chat widget component
- ✅ `frontend/src/styles/ChatBot.css` - Chat styling
- ✅ `frontend/src/App.jsx` - Integrated ChatBot

---

## 💰 Pricing Notes

**OpenAI API Pricing:**
- **gpt-3.5-turbo**: ~$0.0005 per 1000 tokens (very cheap)
- **gpt-4**: ~$0.03 per 1000 tokens (more expensive but smarter)

**Free Trial:**
- New OpenAI accounts get $5 free credit (expires after 3 months)

**To estimate usage:**
- Average message: ~100 tokens
- Average response: ~200 tokens
- So each conversation costs roughly $0.00015 (very affordable!)

---

## ⚙️ Chatbot Features

✨ **What It Does:**
- Answers questions about products, orders, clients
- Provides sales insights
- Helps with general business questions
- Maintains conversation history within a session

🛡️ **Security:**
- Only authenticated users can access
- API key is never exposed to frontend
- Uses your JWT authentication

📱 **Mobile Responsive:**
- Works on desktop, tablet, and mobile
- Adapts to screen size automatically

---

## 🔌 API Endpoint Reference

**POST** `/api/chatbot/chat`
```javascript
// Request
{
  "message": "How many products do we have?",
  "conversationId": "default"  // Optional, for multiple conversations
}

// Response
{
  "success": true,
  "message": "Based on your database, you currently have...",
  "conversationId": "default"
}
```

---

## 🐛 Troubleshooting

### Issue: "OpenAI API key is invalid or expired"
**Solution:** Double-check your API key in `backend/.env`. Make sure there are no extra spaces.

### Issue: Chat widget is not visible
**Solution:** Make sure you're logged in. The chatbot only appears for authenticated users.

### Issue: Network error when sending message
**Solution:** 
1. Check if backend is running (`npm start` in `backend/` folder)
2. Check if API URL is correct in frontend
3. Check browser console (F12) for error details

### Issue: Slow responses
**Solution:** This is normal during peak OpenAI usage. Responses typically take 2-5 seconds.

---

## 🎨 Customization

### Change Chatbot System Prompt
Edit `backend/routes/chatbot.js`, find the `system` role message and customize:

```javascript
content: `You are a helpful AI assistant for a sales management system. 
You help users with:
- Product information and management
- Client/customer management
- Order management and tracking
...
```

### Change Chatbot Appearance
Edit `frontend/src/styles/ChatBot.css` to customize colors, size, etc.

### Use Different AI Model
Replace `'gpt-3.5-turbo'` with `'gpt-4'` in `backend/routes/chatbot.js` (costs more but is smarter)

---

## 📚 Resources

- [OpenAI API Docs](https://platform.openai.com/docs)
- [OpenAI Pricing](https://openai.com/pricing)
- [Chat Completions Guide](https://platform.openai.com/docs/guides/gpt)

---

## ✨ Next Steps (Optional)

- **Save chats to database**: Modify chatbot.js to store conversations in your PostgreSQL DB
- **Add analytics**: Track which questions users ask most
- **Use different models**: Try GPT-4 for more advanced features
- **Add file upload**: Let users upload documents for the AI to analyze

---

💡 **Enjoy your AI-powered sales assistant!** If you run into issues, check the browser console (F12) and backend terminal for error messages.
