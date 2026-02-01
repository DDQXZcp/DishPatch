const docClient = require("../config/database");
const { GetCommand, PutCommand, QueryCommand, ScanCommand, UpdateCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");

const TABLE_NAME = "Orders"; // Make sure this table exists in DynamoDB

// Utility to generate a random 4-digit code
function generateDisplayId() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

// ✅ Create a new order
async function createOrder(order) {
  const orderId = uuidv4();          // long unique ID
  const displayId = generateDisplayId(); // short 4-digit code

  // Normalize table
  const table = typeof order.table === "string"
    ? { tableNo: order.table }
    : order.table;

  const params = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      orderId,                                  // backend PK
      displayId,                                // short ID for UI
      customerDetails: order.customerDetails,
      orderStatus: order.orderStatus || "NEW",
      orderDate: new Date().toISOString(),
      bills: order.bills,
      items: order.items || [],
      table,
      paymentMethod: order.paymentMethod,
      paymentData: order.paymentData || null
    }
  });

  await docClient.send(params);

  return { orderId, displayId, ...order, table };
}

// ✅ List all orders (full table scan)
async function listOrders() {
  const params = new ScanCommand({ TableName: TABLE_NAME });
  const result = await docClient.send(params);

  // Normalize table for each order
  return (result.Items || []).map((order) => ({
    ...order,
    table: typeof order.table === "string"
      ? { tableNo: order.table }
      : order.table
  }));
}

// ✅ Get order by ID
async function getOrder(orderId) {
  const params = new GetCommand({
    TableName: TABLE_NAME,
    Key: { orderId }
  });

  const result = await docClient.send(params);

  if (!result.Item) return null;

  return {
    ...result.Item,
    table: typeof result.Item.table === "string"
      ? { tableNo: result.Item.table }
      : result.Item.table
  };
}

// ✅ Get all orders for a table (requires GSI on "table.tableNo")
async function getOrdersByTable(tableNo) {
  const params = new QueryCommand({
    TableName: TABLE_NAME,
    IndexName: "TableIndex", // GSI must use table.tableNo as PK
    KeyConditionExpression: "table.tableNo = :t",
    ExpressionAttributeValues: {
      ":t": tableNo
    }
  });

  const result = await docClient.send(params);

  return (result.Items || []).map((order) => ({
    ...order,
    table: typeof order.table === "string"
      ? { tableNo: order.table }
      : order.table
  }));
}

async function updateOrderStatus(orderId, orderStatus) {
  const params = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { orderId },
    UpdateExpression: "set orderStatus = :s",
    ExpressionAttributeValues: {
      ":s": orderStatus,
    },
    ReturnValues: "ALL_NEW"
  });

  const result = await docClient.send(params);
  return result.Attributes;
}

module.exports = {
  listOrders,
  createOrder,
  getOrder,
  getOrdersByTable,
  updateOrderStatus
};
