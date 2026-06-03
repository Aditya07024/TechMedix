import React, { useState } from "react";
import { Link } from "react-router-dom";

const Suggestions = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    const body = `
Name: ${formData.name}
Email: ${formData.email}

${formData.message}
`;

    window.location.href = `mailto:techmedixcare@gmail.com?subject=${encodeURIComponent(
      formData.subject
    )}&body=${encodeURIComponent(body)}`;
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f8fafc",
        padding: "40px 20px",
      }}
    >
      <div
        style={{
          maxWidth: "700px",
          margin: "0 auto",
          background: "#fff",
          padding: "32px",
          borderRadius: "16px",
          boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
        }}
      >
        <Link
          to="/"
          style={{
            textDecoration: "none",
            color: "hsl(168.93617021276594, 76.21621621621621%, 36.27450980392157%)",
            fontWeight: "600",
          }}
        >
          ← Back to Home
        </Link>

        <h1
          style={{
            marginTop: "20px",
            marginBottom: "10px",
          }}
        >
          Share Your Suggestions
        </h1>

        <p style={{ color: "#64748b", marginBottom: "24px" }}>
          We'd love to hear your feedback and ideas for improving TechMedix.
        </p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            name="name"
            placeholder="Your Name"
            value={formData.name}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          <input
            type="email"
            name="email"
            placeholder="Your Email"
            value={formData.email}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          <input
            type="text"
            name="subject"
            placeholder="Subject"
            value={formData.subject}
            onChange={handleChange}
            required
            style={inputStyle}
          />

          <textarea
            name="message"
            placeholder="Write your suggestion..."
            value={formData.message}
            onChange={handleChange}
            rows="7"
            required
            style={{
              ...inputStyle,
              resize: "vertical",
            }}
          />

          <button
            type="submit"
            style={{
              width: "100%",
              background: "hsl(168.93617021276594, 76.21621621621621%, 36.27450980392157%)",
              color: "#fff",
              border: "none",
              padding: "14px",
              borderRadius: "10px",
              cursor: "pointer",
              fontSize: "16px",
              fontWeight: "600",
            }}
          >
            Send Suggestion
          </button>
        </form>
      </div>
    </div>
  );
};

const inputStyle = {
  width: "100%",
  padding: "14px",
  marginBottom: "16px",
  border: "1px solid #d1d5db",
  borderRadius: "10px",
  fontSize: "15px",
  boxSizing: "border-box",
};

export default Suggestions;