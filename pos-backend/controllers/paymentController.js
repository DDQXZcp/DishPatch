const sqs = require("../config/sqsClient");
const { SendMessageCommand } = require("@aws-sdk/client-sqs");
const config = require("../config/config");
const crypto = require("crypto");

exports.createPayment = async (req, res) => {
  try {
    const { orderIds, transactionType, amount } = req.body;

    if (!Array.isArray(orderIds) || !transactionType || !amount) {
      return res.status(400).json({
        message:
          "Missing or invalid fields. Required: orderIds[], transactionType, amount.",
      });
    }

    // ✅ Let backend generate a UUID for the payment
    const paymentId = `PAY-${crypto.randomUUID()}`;

    const message = {
      paymentId,
      orderIds,
      transactionType,
      amount,
      createdAt: new Date().toISOString(),
    };

    // ✅ Standard Queue (no deduplication or group IDs)
    const command = new SendMessageCommand({
      QueueUrl: config.paymentQueueUrl,
      MessageBody: JSON.stringify(message),
    });

    await sqs.send(command);
    console.log("✅ Payment message sent:", message);

    res.status(200).json({
      message: "Payment message successfully sent to SQS",
      data: message,
    });
  } catch (error) {
    console.error("❌ Failed to send payment message:", error);
    res.status(500).json({ message: "Error sending payment message", error });
  }
};