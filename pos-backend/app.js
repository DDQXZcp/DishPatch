const express = require("express");
const config = require("./config/config");
const globalErrorHandler = require("./middlewares/globalErrorHandler");
const cookieParser = require("cookie-parser");
// const cors = require("cors");

const app = express();
const PORT = config.port;

// Middlewares
// app.use(cors({
//   credentials: true,
//   origin: ['http://localhost:5173'] // adjust when deploying
// }));
app.use(express.json());
app.use(cookieParser());

// ✅ Strip stage prefix like /prod or /dev from URL (API Gateway)
app.use((req, res, next) => {
  const stagePrefixes = ["/prod", "/dev", "/staging"];
  for (const prefix of stagePrefixes) {
    if (req.url.startsWith(prefix)) {
      req.url = req.url.replace(prefix, "");
      break;
    }
  }
  next();
});

// Root Endpoint
app.get("/", (req, res) => {
  res.json({ message: "Hello from POS Server!" });
});

// Other Endpoints
app.use("/api/user", require("./routes/userRoute"));
app.use("/api/order", require("./routes/orderRoute"));
app.use("/api/table", require("./routes/tableRoute"));
app.use("/api/payment", require("./routes/paymentRoute"));
app.use("/api/menu", require("./routes/menuRoute"));

// Global Error Handler
app.use(globalErrorHandler);

if (process.env.NODE_ENV !== "lambda") {
  app.listen(PORT, () => {
    console.log(`POS Server is listening on port ${PORT}`);
  });
}

console.log("Express app loaded");

module.exports = app;