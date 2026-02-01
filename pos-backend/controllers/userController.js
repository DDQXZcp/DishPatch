const createHttpError = require("http-errors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const getJwtSecret = require("../config/jwtSecret");
const getCookieOptions = require("../utils/cookieOptions");
const {
  createUser,
  getUserByEmail,
  getUserById,
  verifyPassword,
} = require("../models/userModel");

// 🔹 Register new user
const register = async (req, res, next) => {
  try {
    const { name, phone, email, password, role } = req.body;

    if (!name || !phone || !email || !password || !role) {
      return next(createHttpError(400, "All fields are required!"));
    }

    const isUserPresent = await getUserByEmail(email);
    if (isUserPresent) {
      return next(createHttpError(400, "User already exists!"));
    }

    const newUser = await createUser({ name, phone, email, password, role });

    res.status(201).json({
      success: true,
      message: "New user created!",
      data: newUser,
    });
  } catch (error) {
    next(error);
  }
};

// 🔹 Login user
const login = async (req, res, next) => {
  try {

    console.log("Cookie options in login:", getCookieOptions());
    const { email, password } = req.body;

    if (!email || !password) {
      return next(createHttpError(400, "All fields are required!"));
    }

    const user = await getUserByEmail(email);
    if (!user) {
      return next(createHttpError(401, "Invalid Credentials"));
    }

    const isMatch = await verifyPassword(password, user.password);
    if (!isMatch) {
      return next(createHttpError(401, "Invalid Credentials"));
    }

    const secret = await getJwtSecret();
    const accessToken = jwt.sign({ userId: user.userId }, secret, {
      expiresIn: "1d",
    });

    // ✅ Use helper for cookie options
    res.cookie("accessToken", accessToken, getCookieOptions());

    res.status(200).json({
      success: true,
      message: "User login successfully!",
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

// 🔹 Get logged-in user data
const getUserData = async (req, res, next) => {
  try {
    const user = await getUserById(req.user.userId);
    if (!user) {
      return next(createHttpError(404, "User not found!"));
    }

    res.status(200).json({ success: true, data: user });
  } catch (error) {
    next(error);
  }
};

// 🔹 Logout user
const logout = async (req, res, next) => {
  try {
    // ✅ Clear cookie with same options (important for SameSite/secure)
    res.clearCookie("accessToken", getCookieOptions());
    res
      .status(200)
      .json({ success: true, message: "User logout successfully!" });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login, getUserData, logout };