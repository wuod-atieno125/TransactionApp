"use strict";

const sharp = require("sharp");

const MAX_PROFILE_PICTURE_BYTES = 2 * 1024 * 1024;
const MAX_PROFILE_PICTURE_PIXELS = 25_000_000;

async function processProfilePicture(buffer) {
  const image = sharp(buffer, {
    failOn: "error",
    limitInputPixels: MAX_PROFILE_PICTURE_PIXELS,
  });
  const metadata = await image.metadata();

  if (!["jpeg", "png"].includes(metadata.format)) {
    const error = new Error("Only JPEG and PNG images are supported.");
    error.statusCode = 415;
    throw error;
  }

  if (
    !metadata.width ||
    !metadata.height ||
    metadata.width * metadata.height > MAX_PROFILE_PICTURE_PIXELS
  ) {
    const error = new Error("Image dimensions are too large or invalid.");
    error.statusCode = 400;
    throw error;
  }

  return image
    .rotate()
    .resize(512, 512, { fit: "cover", position: "centre" })
    .jpeg({ quality: 85 })
    .toBuffer();
}

module.exports = {
  MAX_PROFILE_PICTURE_BYTES,
  processProfilePicture,
};
