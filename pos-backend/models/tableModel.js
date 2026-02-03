const docClient = require("../config/database");
const config = require("../config/config");
const {
  GetCommand,
  PutCommand,
  UpdateCommand,
  DeleteCommand,
  ScanCommand
} = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = config.tablesTable;

// Create a new table entry
async function createTable(table) {
  const params = new PutCommand({
    TableName: TABLE_NAME,
    Item: {
      tableNo: table.tableNo,              // Partition key
      status: table.status || "Available",
      seats: table.seats,
      customerName: table.customerName || null,
      customerPhone: table.customerPhone || null,
      guests: table.guests || 0,
      currentOrder: table.currentOrder || null
    }
  });

  await docClient.send(params);
  return {
    ...table,
    status: table.status || "Available",
    customerName: table.customerName || null,
    customerPhone: table.customerPhone || null,
    guests: table.guests || 0,
    currentOrder: table.currentOrder || null
  };
}

// Get a table by tableNo
async function getTable(tableNo) {
  const params = new GetCommand({
    TableName: TABLE_NAME,
    Key: { tableNo }
  });

  const result = await docClient.send(params);
  return result.Item;
}

// ✅ List all tables
async function listTables() {
  const params = new ScanCommand({
    TableName: TABLE_NAME
  });

  const result = await docClient.send(params);
  return result.Items || [];
}

// Dynamically update table status, customer info, or current order
async function updateTable(tableNo, updates) {
    console.log("Updating table:", tableNo, "with", updates);
  const exprNames = { "#status": "status" };
  const exprValues = { ":status": updates.status || "Available" };
  let updateExpr = "set #status = :status";

  if (updates.seats !== undefined) {
    updateExpr += ", seats = :seats";
    exprValues[":seats"] = updates.seats;
  }

  if (updates.customerName !== undefined) {
    updateExpr += ", customerName = :customerName";
    exprValues[":customerName"] = updates.customerName;
  }

  if (updates.customerPhone !== undefined) {
    updateExpr += ", customerPhone = :customerPhone";
    exprValues[":customerPhone"] = updates.customerPhone;
  }

  if (updates.guests !== undefined) {
    updateExpr += ", guests = :guests";
    exprValues[":guests"] = updates.guests;
  }

  if (updates.currentOrder !== undefined) {
    updateExpr += ", currentOrder = :order";
    exprValues[":order"] = updates.currentOrder;
  }

  const params = new UpdateCommand({
    TableName: TABLE_NAME,
    Key: { tableNo },
    UpdateExpression: updateExpr,
    ExpressionAttributeNames: exprNames,
    ExpressionAttributeValues: exprValues,
    ReturnValues: "ALL_NEW"
  });

  const result = await docClient.send(params);
  return result.Attributes;
}

// Delete a table entry
async function deleteTable(tableNo) {
  const params = new DeleteCommand({
    TableName: TABLE_NAME,
    Key: { tableNo }
  });

  await docClient.send(params);
  return { message: `Table ${tableNo} deleted successfully` };
}

module.exports = {
  createTable,
  getTable,
  listTables,
  updateTable,
  deleteTable
};