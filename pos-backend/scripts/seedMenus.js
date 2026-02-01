// scripts/seedMenus.js
const { BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
const docClient = require("../config/database");

// Import your local menu data
const { menus } = require("../constants/index.js"); // adjust path if needed

const TABLE_NAME = "MenuItems";

async function seedMenus() {
  try {
    const items = menus.map(menu => {
      const { id, ...menuWithoutId } = menu; // remove local id if present
      return {
        PutRequest: {
          Item: {
            menuName: menuWithoutId.name,
            bgColor: menuWithoutId.bgColor,
            icon: menuWithoutId.icon,
            items: menuWithoutId.items,
          },
        },
      };
    });

    // DynamoDB allows max 25 writes per batch
    const batches = [];
    for (let i = 0; i < items.length; i += 25) {
      batches.push(items.slice(i, i + 25));
    }

    for (const batch of batches) {
      const params = { RequestItems: { [TABLE_NAME]: batch } };
      await docClient.send(new BatchWriteCommand(params));
      console.log(`Seeded ${batch.length} menu records`);
    }

    console.log("All menus seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seedMenus();
