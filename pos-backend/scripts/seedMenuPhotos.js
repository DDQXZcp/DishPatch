// scripts/seedMenuPhotos.js

const fs = require("fs");
const path = require("path");
const { S3Client, PutObjectCommand } = require("@aws-sdk/client-s3");

const REGION = "ap-southeast-2";

// Use bucket name, not ARN
const BUCKET_NAME = "dishpatch-pos-backend-menu-photo";

// From scripts/seedMenuPhotos.js to ../resources
const RESOURCES_DIR = path.join(__dirname, "../resources");

const s3 = new S3Client({
  region: REGION,
});

async function seedMenuPhotos() {
  try {
    if (!fs.existsSync(RESOURCES_DIR)) {
      throw new Error(`Resources folder not found: ${RESOURCES_DIR}`);
    }

    const pngFiles = fs
      .readdirSync(RESOURCES_DIR)
      .filter((file) => path.extname(file).toLowerCase() === ".png");

    if (pngFiles.length === 0) {
      console.log("No PNG images found in resources folder.");
      process.exit(0);
    }

    console.log(`Found ${pngFiles.length} PNG image(s). Uploading...`);

    for (const file of pngFiles) {
      const filePath = path.join(RESOURCES_DIR, file);

      await s3.send(
        new PutObjectCommand({
          Bucket: BUCKET_NAME,
          Key: file, // upload to bucket root
          Body: fs.readFileSync(filePath),
          ContentType: "image/png",
        })
      );

      console.log(`Uploaded: s3://${BUCKET_NAME}/${file}`);
    }

    console.log("All PNG menu photos uploaded successfully!");
    process.exit(0);
  } catch (err) {
    console.error("Photo upload failed:", err);
    process.exit(1);
  }
}

seedMenuPhotos();