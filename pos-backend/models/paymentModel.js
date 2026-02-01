const docClient = require("../config/database");
const { GetCommand, PutCommand, QueryCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

const TABLE_NAME = "Payments"; // DynamoDB table for payments

// Create a new payment
async function createPayment(payment) {
  const paymentId = uuidv4();

  const params = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      paymentId,                     // Primary key
      orderId: payment.orderId,      // To link back to an order
      amount: payment.amount,
      currency: payment.currency,
      status: payment.status,
      method: payment.method,
      email: payment.email,
      contact: payment.contact,
      createdAt: new Date().toISOString()
    }
  });

  await docClient.send(params);
  return { paymentId, ...payment };
}

// Get payment by ID
async function getPayment(paymentId) {
  const params = new GetCommand({
    TableName: TABLE_NAME,
    Key: { paymentId }
  });

  const result = await docClient.send(params);
  return result.Item;
}

// Get all payments by Order ID (requires GSI on orderId)
async function getPaymentsByOrder(orderId) {
  const params = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "OrderIndex", // GSI: orderId as partition key
    KeyConditionExpression: "orderId = :o",
    ExpressionAttributeValues: {
      ":o": orderId
    }
  });

  const result = await docClient.send(params);
  return result.Items;
}

module.exports = {
  createPayment,
  getPayment,
  getPaymentsByOrder
};
