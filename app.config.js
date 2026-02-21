// app.config.js: carga explícita de .env para garantizar EXPO_PUBLIC_RASA_URL.
const fs = require("fs");
const path = require("path");
const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const m = line.match(/^EXPO_PUBLIC_RASA_URL=(.*)$/);
    if (m) process.env.EXPO_PUBLIC_RASA_URL = m[1].trim();
  });
}
if (process.env.NODE_ENV !== "production") {
  console.log("EXPO_PUBLIC_RASA_URL (config):", process.env.EXPO_PUBLIC_RASA_URL);
}

const appJson = require("./app.json");

module.exports = {
  ...appJson,
  expo: {
    ...appJson.expo,
    extra: {
      ...(appJson.expo?.extra || {}),
      rasaUrl: process.env.EXPO_PUBLIC_RASA_URL || "",
    },
  },
};
