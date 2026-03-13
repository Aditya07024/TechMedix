import React, { useEffect, useRef, useState } from "react";
import "./HealthChat.css";

export default function HealthChat({ open, onClose }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I can answer questions using your health records and insights. How can I help today?" },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollerRef = useRef(null);

  useEffect(() => {
    if (scrollerRef.current) {
      scrollerRef.current.scrollTop = scrollerRef.current.scrollHeight;
    }
  }, [messages, open]);

  if (!open) return null;

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const next = [...messages, { role: "user", content: text }];
    setMessages(next);
    setInput("");
    setLoading(true);
    try {
      const res = await fetch(`/api/health-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        credentials: "include",
        body: JSON.stringify({ messages: next.map(m => ({ role: m.role, content: m.content })) }),
      });
      const data = await res.json();
      const reply = data?.reply || data?.error || "Sorry, I couldn't respond.";
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (e) {
      setMessages((prev) => [...prev, { role: "assistant", content: "Network error — please try again." }]);
    } finally {
      setLoading(false);
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <div className="hc-overlay">
      <div className="hc-modal">
        <div className="hc-header">
          <h3>Health Chatbot</h3>
          <button className="hc-close" onClick={onClose}>×</button>
        </div>
        <div className="hc-body" ref={scrollerRef}>
          {messages.map((m, i) => (
            <div key={i} className={`hc-msg ${m.role}`}>
              <div className="hc-bubble">{m.content}</div>
            </div>
          ))}
        </div>
        <div className="hc-input">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKey}
            placeholder="Ask about your metrics, insights, or care steps…"
            disabled={loading}
          />
          <button onClick={send} disabled={loading || !input.trim()}>
            {loading ? "Sending…" : "Send"}
          </button>
        </div>
        <div className="hc-note">This assistant uses your saved health records and is not a substitute for professional medical advice.</div>
      </div>
    </div>
  );
}

