const express = require("express");
const router = express.Router();
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { createPayment } = require("../controllers/paymentController");

router.post("/", isVerifiedUser, createPayment);

module.exports = router;
