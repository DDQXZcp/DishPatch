const docClient = require("../config/database");
const { PutCommand, ScanCommand } = require("@aws-sdk/lib-dynamodb");

const TABLE_NAME = "MenuItems";

/**
 * Get all menu items from DynamoDB
 */
async function getAllMenuItems() {
  const data = await docClient.send(new ScanCommand({ TableName: TABLE_NAME }));
  return data.Items;
}

/**
 * Add a new menu item or category
 * @param {Object} menu - Menu object with { menuName, bgColor, icon, items }
 */
async function addMenuItem(menu) {
  const params = new PutCommand({
    TableName: TABLE_NAME,
    Item: menu,
  });

  await docClient.send(params);
}

module.exports = {
  getAllMenuItems,
  addMenuItem,
};