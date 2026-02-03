const createHttpError = require("http-errors");
const { addMenuItem, getAllMenuItems } = require("../models/menuModel");

// ➤ Add a new menu
const addMenu = async (req, res, next) => {
  try {
    console.log("📥 [addMenu] Received request body:", req.body);

    const menu = req.body;

    if (!menu || !menu.menuName || !menu.items) {
      console.warn("⚠️ [addMenu] Missing required fields in menu:", menu);
      return next(createHttpError(400, "Menu must include 'menuName' and 'items'"));
    }

    await addMenuItem(menu);
    console.log("✅ [addMenu] Successfully added menu:", menu.menuName);

    res.status(201).json({
      success: true,
      message: "Menu added successfully",
    });
  } catch (error) {
    console.error("❌ [addMenu] Error:", error);
    next(error);
  }
};

// ➤ Get all menus
const getMenus = async (req, res, next) => {
  try {
    // console.log("📡 [getMenus] Fetching all menu items from DynamoDB...");

    const menus = await getAllMenuItems();

    // console.log("📦 [getMenus] Raw data from DynamoDB:", JSON.stringify(menus, null, 2));

    // if (!menus || menus.length === 0) {
    // //   console.warn("⚠️ [getMenus] No menu items found in database.");
    //   return next(createHttpError(404, "No menu items found"));
    // }

    // console.log(`✅ [getMenus] Found ${menus.length} menu(s).`);

    res.status(200).json({
      success: true,
      data: menus,
    });
  } catch (error) {
    console.error("[getMenus] Error fetching menus:", error);
    next(error);
  }
};

module.exports = { addMenu, getMenus };