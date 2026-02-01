const serverlessExpress = require("@vendia/serverless-express");
const app = require("./app");

console.log("Lambda container started");

exports.handler = serverlessExpress({ app });