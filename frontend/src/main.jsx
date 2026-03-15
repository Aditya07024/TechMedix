// filepath: /Users/aditya/Documents/Code/Projects/Projects/TechMedix/frontend/src/main.jsx
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
import { BrowserRouter } from "react-router-dom";
import StoreProvider from "./context/StoreContext";
import { ThemeProvider } from "./context/ThemeContext";
import axios from "axios";
import { API_BASE_URL, toBackendUrl } from "./utils/apiBase";

axios.defaults.baseURL = API_BASE_URL;
axios.defaults.withCredentials = true; // 🔥 VERY IMPORTANT
const storedToken = localStorage.getItem("token");
if (storedToken) {
  axios.defaults.headers.common.Authorization = `Bearer ${storedToken}`;
}

const nativeFetch = window.fetch.bind(window);

window.fetch = (input, init) => {
  if (typeof input === "string") {
    return nativeFetch(toBackendUrl(input), init);
  }

  if (input instanceof Request) {
    return nativeFetch(new Request(toBackendUrl(input.url), input), init);
  }

  return nativeFetch(input, init);
};

ReactDOM.createRoot(document.getElementById("root")).render(
  <StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <ThemeProvider>
          <App/>
        </ThemeProvider>
      </StoreProvider>
    </BrowserRouter>
  </StrictMode>
);
