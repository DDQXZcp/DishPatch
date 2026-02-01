const { SSMClient, GetParameterCommand } = require("@aws-sdk/client-ssm");
const config = require("./config");

const ssm = new SSMClient({ region: config.awsRegion });
let cachedSecret = null;

async function getJwtSecret() {
  if (cachedSecret) return cachedSecret;

  try {
    const response = await ssm.send(
      new GetParameterCommand({
        Name: "/RestaurantPOS/JWT_SECRET",
        WithDecryption: true
      })
    );
    cachedSecret = response.Parameter.Value;

    console.log("✅ Successfully fetched JWT_SECRET from SSM Parameter Store");
    return cachedSecret;
  } catch (err) {
    console.warn("⚠️ Failed to fetch JWT_SECRET from SSM, falling back to .env");
    if (config.accessTokenSecret) {
      cachedSecret = config.accessTokenSecret;
      return cachedSecret;
    }
    throw new Error("❌ JWT secret not found in SSM or .env");
  }
}

module.exports = getJwtSecret;
