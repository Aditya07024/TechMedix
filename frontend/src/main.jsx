// filepath: /Users/aditya/Documents/Code/Projects/Projects/TechMedix/frontend/src/main.jsx
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import StoreProvider from "./context/StoreContext";
import { ThemeProvider } from "./context/ThemeContext";
import axios from 'axios';
axios.defaults.baseURL = 'http://localhost:8080';

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <ThemeProvider>
          <App />
        </ThemeProvider>
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>
);
