import React, { useState } from "react";
import "./AiPop.css";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../../utils/apiBase";

const Aipop = ({ setShowAiPop, children }) => {
  const navigate = useNavigate();
  const [input, setInput] = useState("");
  const [output, setOutput] = useState("Search what you want to ask related to your health.");
  const [suggestedMedicines, setSuggestedMedicines] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const response = await axios.post(`${API_BASE_URL}/aipop`, { prompt: input });
      setOutput(response.data.reply);
      setSuggestedMedicines(Array.isArray(response.data.medicines) ? response.data.medicines : []);
      setInput("");
    } catch (error) {
      setSuggestedMedicines([]);
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
            {suggestedMedicines.length > 0 ? (
              <div className="ai-pop-suggestions">
                <h3>Medicines From Database</h3>
                <div className="ai-pop-suggestion-list">
                  {suggestedMedicines.map((medicine) => (
                    <button
                      key={medicine.id}
                      type="button"
                      className="ai-pop-suggestion-card"
                      onClick={() => {
                        navigate(`/medicines/${medicine.id}`, {
                          state: { product: medicine },
                        });
                        setShowAiPop(false);
                      }}
                    >
                      <span className="ai-pop-suggestion-name">{medicine.name}</span>
                      <span className="ai-pop-suggestion-meta">
                        {medicine.salt || medicine.therapeutic_class || "View details"}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Aipop;
