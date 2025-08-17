const API_URL = import.meta.env.VITE_API_URL;
import React, { useState } from 'react';
import "./AiPop.css";
import axios from 'axios';

const Aipop = ({ setShowAiPop, children }) => {
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("Search what you want to ask related to your health.");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API_URL}/aipop`, {prompt: input});
      setOutput(response.data.reply);
      setInput("");
    } catch (error) {
      setOutput("Error: " + (error.response?.data?.error || "Failed to get AI response"));
      console.error("AI request failed:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pop">
      <div className="pop-right">
        <div className="ai-pop-container">
          <div className="ai-pop-title">
            <h2>AI Assistant</h2>
            <span className="cross-img" onClick={() => setShowAiPop(false)}>&#10005;</span>
          </div>
          <div className="ai-pop-content">
            {children ? children : <p>How can I help you today?</p>}
            <form className="ai-pop-form" onSubmit={handleSubmit}>
              <input
                type="text"
                className="ai-pop-input"
                placeholder="Type your question..."
                value={input}
                onChange={e => setInput(e.target.value)}
                required
                disabled={loading}
              />
              <button 
                className="ai-pop-btn" 
                type="submit"
                disabled={loading || !input.trim()}
              >
                {loading ? "Asking..." : "Ask"}
              </button>
            </form>
          </div>
          <div className="output">
            <p>{output}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Aipop;