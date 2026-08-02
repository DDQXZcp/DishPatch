// scripts/seedTables.js
/**
 * DynamoDB Table Seeder (Standalone)
 *
 * Purpose:
 *   Seed a DynamoDB Tables table with drop point ids taken from the map source,
 *   so POS table numbers match the navigation destinations the robots use.
 *
 * Notes:
 *   - This script is designed to run locally with Node.js.
 *   - It should not auto-resolve the table name from environment variables.
 *   - Make sure to set the correct TABLE_NAME before running.
 *   - Check DynamoDB Region in config/database.js to match your setup.
 *   - For demo purposes only SEED_COUNT drop points are seeded, picked at
 *     random from the map. `counter` is excluded — it is the kitchen pickup
 *     point, not somewhere a customer is seated.
 */

const fs = require("fs");
const path = require("path");
const { BatchWriteCommand } = require("@aws-sdk/lib-dynamodb");
const { v4: uuidv4 } = require("uuid");
const docClient = require("../config/database");

// From scripts/seedTables.js to the map source of truth for drop point ids.
const DROP_POINTS_YAML = path.join(
  __dirname,
  "../../map-source/the-hive-drop-points.yaml"
);

const TABLE_NAME = "dishpatch-pos-backend-Tables"; // Replace with your actual table name

const SEED_COUNT = 5;
const SEATS = 4;
const EXCLUDED_IDS = ["counter"];

// Only the ids are needed here, so the YAML is read with the same line-wise
// regex approach stage-map-assets.sh uses rather than pulling in a parser.
function readDropPointIds(yamlPath) {
  const contents = fs.readFileSync(yamlPath, "utf8");
  const ids = [];

  for (const line of contents.split("\n")) {
    const match = line.match(/^\s*-\s+id:\s*(.+?)\s*$/);
    if (match) {
      ids.push(match[1].replace(/^["']|["']$/g, ""));
    }
  }

  return ids;
}

// Fisher-Yates, so every drop point has an equal chance of being seeded.
function pickRandom(values, count) {
  const pool = [...values];

  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  return pool.slice(0, count);
}

async function seedTables() {
  try {
    const dropPointIds = readDropPointIds(DROP_POINTS_YAML);
    const candidates = dropPointIds.filter((id) => !EXCLUDED_IDS.includes(id));

    if (candidates.length < SEED_COUNT) {
      throw new Error(
        `Need ${SEED_COUNT} drop points but ${DROP_POINTS_YAML} only has ${candidates.length} once ${EXCLUDED_IDS.join(", ")} is excluded`
      );
    }

    const tableNos = pickRandom(candidates, SEED_COUNT);
    console.log(`Picked ${SEED_COUNT} of ${candidates.length} drop points: ${tableNos.join(", ")}`);

    const items = tableNos.map((tableNo) => {
      return {
        PutRequest: {
          Item: {
            uuid: uuidv4(),
            tableNo,                     // partition key, matches the drop point id
            seats: SEATS,
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
