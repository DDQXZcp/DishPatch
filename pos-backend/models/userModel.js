const docClient = require("../config/database");
const config = require("../config/config");
const { GetCommand, PutCommand, QueryCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");
const bcrypt = require("bcrypt");

const TABLE_NAME = config.usersTable; // ✅ use CloudFormation-injected table name

// Helper: validate email format
function validateEmail(email) {
  return /\S+@\S+\.\S+/.test(email);
}

// Helper: validate phone format (10 digits)
function validatePhone(phone) {
  return /^\d{10}$/.test(phone);
}

// Create a new user
async function createUser(user) {
  if (!validateEmail(user.email)) {
    throw new Error("Email must be in valid format!");
  }
  if (!validatePhone(user.phone)) {
    throw new Error("Phone number must be a 10-digit number!");
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(user.password, salt);

  const userId = user.userId || uuidv4();

  const params = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      userId,
      name: user.name,
      email: user.email,
      phone: user.phone,
      password: hashedPassword,
      role: user.role || "customer",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  });

  await docClient.send(params);
  return { userId, ...user, password: undefined }; // don’t return password
}

// Get user by email (for login)
async function getUserByEmail(email) {
  const params = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "EmailIndex", // requires a GSI on "email"
    // Safer expression: avoids reserved word issues
    KeyConditionExpression: "#email = :email",
    ExpressionAttributeValues: {
      ":email": email
    }
  });

  const result = await docClient.send(params);
  return result.Items?.[0];
}

// ✅ Get user by userId (for token verification)
async function getUserById(userId) {
  const params = new GetCommand({
    TableName: TABLE_NAME,
    Key: { userId }
  });

  const result = await docClient.send(params);
  return result.Item;
}

// Verify password
async function verifyPassword(inputPassword, hashedPassword) {
  return await bcrypt.compare(inputPassword, hashedPassword);
}

// Update user (e.g., role or phone)
async function updateUser(userId, updates) {
  const params = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { userId },
    UpdateExpression: "set #name = :name, phone = :phone, role = :role, updatedAt = :updatedAt",
    ExpressionAttributeNames: {
      "#name": "name"
    },
    ExpressionAttributeValues: {
      ":name": updates.name,
      ":phone": updates.phone,
      ":role": updates.role,
      ":updatedAt": new Date().toISOString()
    },
    ReturnValues: "ALL_NEW"
  });

  const result = await docClient.send(params);
  return result.Attributes;
}

module.exports = {
  createUser,
  getUserByEmail,
  getUserById,     // 👈 added export
  verifyPassword,
  updateUser
};