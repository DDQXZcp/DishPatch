const createHttpError = require("http-errors");
const {
  createTable,
  getTable,
  updateTable,
  deleteTable,
  listTables // <-- make sure this is imported!
} = require("../models/tableModel");

// Add a new table
const addTable = async (req, res, next) => {
  try {
    const { tableNo, seats } = req.body;

    if (!tableNo) {
      return next(createHttpError(400, "Please provide table No!"));
    }

    // Check if table already exists
    const existing = await getTable(tableNo);
    if (existing) {
      return next(createHttpError(400, "Table already exists!"));
    }

    const newTable = await createTable({ tableNo, seats });
    res.status(201).json({
      success: true,
      message: "Table added!",
      data: newTable
    });
  } catch (error) {
    console.error("❌ Error in addTable:", error);
    next(error);
  }
};

// Get all tables
const getTables = async (req, res, next) => {
  try {
    // console.log("✅ getTables called");
    const tables = await listTables();
    // console.log("✅ DynamoDB returned tables:", tables);

    res.status(200).json({ success: true, data: tables });
  } catch (error) {
    console.error("❌ Error in getTables:", error);
    next(error);
  }
};

// Update a table
const updateTableController = async (req, res, next) => {
  try {
    const { status, seats, customerName, customerPhone, guests } = req.body;
    const { id: tableNo } = req.params;

    const updated = await updateTable(tableNo, {
      status,
      seats,
      customerName,
      customerPhone,
      guests,
    });

    if (!updated) {
      return next(createHttpError(404, "Table not found!"));
    }

    res.status(200).json({
      success: true,
      message: "Table updated!",
      data: updated,
    });
  } catch (error) {
    console.error("❌ Error in updateTable:", error);
    next(error);
  }
};

module.exports = { addTable, getTables, updateTable: updateTableController };
