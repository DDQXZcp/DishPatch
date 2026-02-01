const config = require("../config/config");

function getCookieOptions() {
  const isProd = config.nodeEnv === "production";

  return {
    httpOnly: true,
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    sameSite: isProd ? "none" : "lax",
    secure: isProd, // HTTPS only in prod
  };
}

module.exports = getCookieOptions;