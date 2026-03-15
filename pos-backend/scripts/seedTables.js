const { BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
const docClient = require("../config/database");

const { tables } = require("../constants/index.js");

const TABLE_NAME = "DishPatch-Pos-Backend-Tables"; // Replace with your actual table name

async function seedTables() {
  try {
    const items = tables.map((t) => {
      return {
        PutRequest: {
          Item: {
            tableNo: t.tableNo,          // partition key
            seats: t.seats,              // 4
            status: "Available",
            customerName: null,
            customerPhone: null,
            guests: 0,
            currentOrder: null,
          },
        },
      };
    });

    const batches = [];
    for (let i = 0; i < items.length; i += 25) {
      batches.push(items.slice(i, i + 25));
    }

    for (const batch of batches) {
      const params = { RequestItems: { [TABLE_NAME]: batch } };
      await docClient.send(new BatchWriteCommand(params));
      console.log(`Seeded ${batch.length} table records to ${TABLE_NAME}`);
    }

    console.log("All tables seeded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Seeding failed:", err);
    process.exit(1);
  }
}

seedTables();