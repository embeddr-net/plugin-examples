/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./examples/**/*.{js,ts,jsx,tsx}"],
  corePlugins: {
    preflight: false,
  },
  important: ".embeddr-plugin-scope",
};
