const express = require("express");
const { addMenu, getMenus } = require("../controllers/menuController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const router = express.Router();

router.get("/", isVerifiedUser, getMenus);
router.post("/", isVerifiedUser, addMenu);

module.exports = router;