/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./index.html", "./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      borderRadius: {
        // Used by the provided liquid-glass component.
        inherit: "inherit",
        "4xl": "2rem",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};

