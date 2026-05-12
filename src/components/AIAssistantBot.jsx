import React, { useState, useEffect, useRef } from "react";
import { FaRobot, FaPaperPlane, FaTimes, FaMinus } from "react-icons/fa";
import { useBranch } from "../context/BranchContext";
import { apiWithAuth } from "../api";
import ReactMarkdown from "react-markdown";

const AIAssistantBot = () => {
  const { currentBranch } = useBranch();
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [query, setQuery] = useState("");
  const [messages, setMessages] = useState([
    { role: "bot", text: "Hello! I'm your Pearl ERP Assistant. How can I help you today?", type: "text" }
  ]);
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const user = JSON.parse(localStorage.getItem("user") || "{}");
  const isAuthorized = user.role === "SUPER_ADMIN" || user.role === "BRANCH_ADMIN" || user.role === "Admin" || user.role === "SUPERADMIN";

  if (!isAuthorized) return null;

  const handleSend = async (e) => {
    e?.preventDefault();
    if (!query.trim() || loading) return;

    const userMessage = { role: "user", text: query };
    setMessages(prev => [...prev, userMessage]);
    setQuery("");
    setLoading(true);

    try {
      const response = await apiWithAuth.post("ai-bot/query", {
        query: query,
        branchId: currentBranch?._id
      });

      if (response.data.success) {
        setMessages(prev => [...prev, { 
          role: "bot", 
          text: response.data.text, 
          type: response.data.type,
          data: response.data.data 
        }]);
      } else {
        setMessages(prev => [...prev, { role: "bot", text: "I couldn't find enough information to answer that accurately. could you please call our admin : +91 9514423300" }]);
      }
    } catch (error) {
      setMessages(prev => [...prev, { role: "bot", text: "I'm having trouble connecting to the server. Please check your connection." }]);
    } finally {
      setLoading(false);
    }
  };

  const suggestions = [
    "How to create a new invoice?",
    "Check stock of Milk Compound",
    "Who is present today?",
    "Recent sales summary",
    "App features"
  ];

  const handleSuggestion = (text) => {
    setQuery(text);
    // Auto-trigger send
    setTimeout(() => {
      const sendButton = document.getElementById("ai-bot-send-btn");
      sendButton?.click();
    }, 100);
  };

  return (
    <div className={`fixed bottom-6 right-6 z-[9999] transition-all duration-500 ${isOpen ? "w-80 md:w-96" : "w-14 h-14"}`}>
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-14 h-14 bg-gradient-to-br from-indigo-600 to-purple-600 rounded-full shadow-2xl flex items-center justify-center text-white hover:scale-110 transition-transform cursor-pointer group relative"
        >
          <FaRobot size={24} className="group-hover:animate-bounce" />
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-white animate-pulse"></span>
        </button>
      ) : (
        <div className={`bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col overflow-hidden transition-all duration-300 ${isMinimized ? "h-14" : "h-[500px]"}`}>
          {/* Header */}
          <div className="bg-gradient-to-r from-indigo-600 to-purple-700 p-4 flex items-center justify-between text-white cursor-pointer" onClick={() => setIsMinimized(!isMinimized)}>
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                <FaRobot />
              </div>
              <div>
                <h3 className="font-bold text-sm text-white">Pearl AI Assistant</h3>
                <div className="flex items-center gap-1.5 text-white">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span className="text-[10px] opacity-80 uppercase tracking-widest font-black">Online</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 text-white">
              <button onClick={(e) => { e.stopPropagation(); setIsMinimized(!isMinimized); }} className="hover:bg-white/10 p-1.5 rounded transition">
                <FaMinus size={14} />
              </button>
              <button onClick={(e) => { e.stopPropagation(); setIsOpen(false); }} className="hover:bg-white/10 p-1.5 rounded transition">
                <FaTimes size={14} />
              </button>
            </div>
          </div>

          {!isMinimized && (
            <>
              {/* Messages Area */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                {messages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] p-3 rounded-2xl text-sm shadow-sm ${
                      msg.role === "user" 
                      ? "bg-indigo-600 text-white rounded-tr-none" 
                      : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"
                    }`}>
                      <div className="prose prose-sm prose-slate leading-relaxed">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                      
                      {msg.type === "list" && msg.data && (
                        <div className="mt-2 space-y-1 border-t pt-2 border-slate-100">
                          {msg.data.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-xs font-bold text-indigo-600">
                              <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full"></span>
                              {item}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-100 p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-indigo-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Suggestions */}
              {messages.length === 1 && !loading && (
                <div className="px-4 py-2 flex flex-wrap gap-2 bg-slate-50/50">
                  {suggestions.map((s, i) => (
                    <button 
                      key={i} 
                      onClick={() => handleSuggestion(s)}
                      className="text-[10px] font-black uppercase tracking-widest bg-white border border-indigo-100 text-indigo-600 px-3 py-1.5 rounded-full hover:bg-indigo-600 hover:text-white transition-all shadow-sm"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}

              {/* Input Area */}
              <form onSubmit={handleSend} className="p-4 border-t border-slate-100 bg-white">
                <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-4 py-2 focus-within:ring-2 focus-within:ring-indigo-500 transition-all">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Ask anything..."
                    className="flex-1 bg-transparent border-none focus:ring-0 text-sm font-medium text-slate-700 outline-none"
                  />
                  <button
                    id="ai-bot-send-btn"
                    type="submit"
                    disabled={!query.trim() || loading}
                    className="text-indigo-600 disabled:opacity-30 hover:scale-110 transition-transform"
                  >
                    <FaPaperPlane size={18} />
                  </button>
                </div>
                <p className="text-[9px] text-slate-400 mt-2 text-center font-bold uppercase tracking-widest">
                  Powered by HIG AI Automation LLP AI Engine
                </p>
              </form>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AIAssistantBot;
