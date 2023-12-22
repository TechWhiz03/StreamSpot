import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

// to set up the Cloudinary SDK in a Node.js application.
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// to upload file from local storage to cloudinary server.
const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;

    // upload file to cloudinary.
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });

    console.log("File uploaded on Cloudinary ", response.url);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath); // remove locally saved temporary file as upload operation failed.
    return null;
  }
};

export { uploadOnCloudinary };
