import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, X, Send, Loader2, Maximize2, Minimize2, Bot } from 'lucide-react';
import { useData } from '../../hooks/useData';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

export default function CareerCoach() {
  const { profile, applications, updateProfile } = useData();
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) {
      scrollToBottom();
    }
  }, [messages, isOpen]);

  // Summarize chat every 10 messages
  useEffect(() => {
    const summarizeChat = async () => {
      if (messages.length > 0 && messages.length % 10 === 0) {
        try {
          const res = await fetch('/api/gemini/summarize-chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              chatHistory: messages,
              previousSummary: profile.chatSummary
            })
          });
          const data = await res.json();
          if (data.summary) {
            await updateProfile({ chatSummary: data.summary });
          }
        } catch (err) {
          console.error("Failed to summarize chat:", err);
        }
      }
    };
    summarizeChat();
  }, [messages, profile.chatSummary, updateProfile]);

  const handleSend = async () => {
    if (!input.trim()) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsTyping(true);

    try {
      const res = await fetch('/api/gemini/career-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: userMsg.content,
          chatHistory: messages.slice(-10), // Only send recent history
          summary: profile.chatSummary,
          profileData: profile,
          applications: applications
        })
      });

      const data = await res.json();
      
      const assistantMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: data.reply || "Sorry, I couldn't process that request." 
      };
      
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      const errorMsg: Message = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: "Sorry, I encountered an error connecting to the AI." 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-500 hover:bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg z-50 transition-colors"
          >
            <MessageSquare size={24} />
          </motion.button>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-300 ${
              isExpanded ? 'w-[450px] h-[600px]' : 'w-[350px] h-[500px]'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-200 dark:border-[#334155] bg-slate-50 dark:bg-[#0F172A]">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-full bg-indigo-500/20 flex items-center justify-center text-indigo-500">
                  <Bot size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Career Coach</h3>
                  <p className="text-xs text-emerald-500">Online</p>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                <button 
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#334155] rounded-lg transition-colors"
                >
                  {isExpanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                </button>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-200 dark:hover:bg-[#334155] rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50 dark:bg-[#0B0F17]/50">
              {messages.length === 0 && (
                <div className="text-center text-slate-500 dark:text-slate-400 text-sm mt-10">
                  <Bot size={40} className="mx-auto mb-3 opacity-20" />
                  <p>Hi {profile.fullName.split(' ')[0]}! I'm your AI career coach.</p>
                  <p className="mt-1">Ask me anything about your applications or profile.</p>
                </div>
              )}
              {messages.map((msg) => (
                <div 
                  key={msg.id} 
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div 
                    className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                      msg.role === 'user' 
                        ? 'bg-indigo-500 text-white rounded-br-sm' 
                        : 'bg-white dark:bg-[#1E293B] text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-[#334155] rounded-bl-sm'
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-[#1E293B] border border-slate-200 dark:border-[#334155] rounded-2xl rounded-bl-sm px-4 py-3 flex space-x-1.5">
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-slate-200 dark:border-[#334155] bg-white dark:bg-[#1E293B]">
              <form 
                onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                className="flex items-center space-x-2"
              >
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-100 dark:bg-[#0F172A] border border-slate-200 dark:border-[#334155] text-slate-900 dark:text-white text-sm rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || isTyping}
                  className="w-10 h-10 rounded-xl bg-indigo-500 hover:bg-indigo-600 disabled:bg-indigo-500/50 flex items-center justify-center text-white transition-colors"
                >
                  <Send size={16} />
                </button>
              </form>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
