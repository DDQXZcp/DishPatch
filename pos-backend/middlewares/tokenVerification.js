const createHttpError = require("http-errors");
const jwt = require("jsonwebtoken");
const { getUserById } = require("../models/userModel"); // DynamoDB function
const getJwtSecret = require("../config/jwtSecret");

const isVerifiedUser = async (req, res, next) => {
  try {
    // console.log("Incoming cookies:", req.cookies);
    const { accessToken } = req.cookies;

    if (!accessToken) {
    //   console.warn("⚠️ No accessToken found in cookies");
      return next(createHttpError(401, "Please provide token!"));
    }

    // fetch JWT secret here
    const secret = await getJwtSecret();
    // console.log("🔑 Using JWT secret (first 8 chars):", secret.slice(0, 8) + "...");

    // Verify JWT
    let decodedToken;
    try {
      decodedToken = jwt.verify(accessToken, secret);
    //   console.log("Decoded token:", decodedToken);
    } catch (err) {
    //   console.error("JWT verification failed:", err.message);
      return next(createHttpError(401, "Invalid Token!"));
    }

    // DynamoDB: use userId instead of _id
    const user = await getUserById(decodedToken.userId);
    // console.log("User fetched from DB:", user);

    if (!user) {
    //   console.warn("User not found in DB for userId:", decodedToken.userId);
      return next(createHttpError(401, "User not exist!"));
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    // console.error("isVerifiedUser middleware error:", error.message);
    return next(createHttpError(401, "Invalid Token!"));
  }
};

module.exports = { isVerifiedUser };