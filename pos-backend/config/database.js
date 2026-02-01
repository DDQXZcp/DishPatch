const {DynamoDBClient} = require("@aws-sdk/client-dynamodb");
const {DynamoDBDocumentClient}  = require("@aws-sdk/lib-dynamodb");
const config = require("./config");

const client = new DynamoDBClient({ region: config.awsRegion });
const docClient = DynamoDBDocumentClient.from(client);

console.log("DynamoDB client initialized in region:", config.awsRegion);

module.exports = docClient;