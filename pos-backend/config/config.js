// config/config.js

// Load .env only for local development (Lambda env vars are injected by AWS)
if (process.env.NODE_ENV !== "lambda") {
  require("dotenv").config();
}

const config = Object.freeze({
  // Server
  port: Number(process.env.PORT || 3000),
  nodeEnv: process.env.NODE_ENV || "development",

  // Auth
  // Prefer direct env var if you ever set it, otherwise keep your current name
  accessTokenSecret: process.env.JWT_SECRET,

  // AWS
  // Support both names: AWS_REGION (common) and REGION (what your CFN sets)
  awsRegion: process.env.AWS_REGION || process.env.REGION || "ap-southeast-2",
  paymentQueueUrl: process.env.PAYMENT_QUEUE_URL,

  // DynamoDB table names (injected by CloudFormation in the new template)
  usersTable: process.env.USERS_TABLE || "Users",
  ordersTable: process.env.ORDERS_TABLE || "Orders",
  paymentsTable: process.env.PAYMENTS_TABLE || "Payments",
  tablesTable: process.env.TABLES_TABLE || "Tables",
  menuItemsTable: process.env.MENU_ITEMS_TABLE || "MenuItems",

});

module.exports = config;