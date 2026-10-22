// Image uploads for the blog and the gallery: JPEG, PNG or WebP, up to 5 MB
// each, kept in memory and sent to Cloudinary. Upload problems become a
// clear 400 instead of a server error.
//
// Trying the admin on your own computer without a Cloudinary account:
// LOCAL_UPLOADS=true (only ever in server/.env.test, never on Render) keeps
// the photos in server/uploads/local/ instead, served at /uploads/local/.
const crypto = require("crypto");
const fs = require("fs/promises");
const path = require("path");
const multer = require("multer");
const cloudinary = require("../config/cloudinary");
const { hasUnsafeKey, UNSAFE_ANSWER } = require("./http");

const LOCAL_DIR = path.join(__dirname, "../../uploads/local");
const useLocal = () => process.env.LOCAL_UPLOADS === "true";

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};
const NOT_AN_IMAGE = "NOT_AN_IMAGE";

// `fields`: multer field list, e.g. [{ name: "photo", maxCount: 1 }].
const imageUpload = (fields) => {
  const maxFiles = fields.reduce((sum, f) => sum + (f.maxCount || 1), 0);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: maxFiles },
    fileFilter(req, file, callback) {
      if (Object.hasOwn(IMAGE_TYPES, file.mimetype))
        return callback(null, true);
      return callback(new Error(NOT_AN_IMAGE));
    },
  }).fields(fields);

  return (req, res, next) =>
    upload(req, res, (error) => {
      if (!error)
        return hasUnsafeKey(req.body)
          ? res.status(400).json(UNSAFE_ANSWER)
          : next();
      let message = "The images could not be read. Please try again.";
      if (error.code === "LIMIT_FILE_SIZE")
        message = "Each image must be 5 MB or smaller.";
      else if (error.message === NOT_AN_IMAGE)
        message = "Images must be JPEG, PNG or WebP files.";
      else if (
        error.code === "LIMIT_FILE_COUNT" ||
        error.code === "LIMIT_UNEXPECTED_FILE"
      ) {
        message =
          maxFiles === 1 ? "Add one image." : `Add up to ${maxFiles} images.`;
      }
      return res.status(400).json({ message });
    });
};

// A random file name; the extension comes from the checked image type, never
// from the uploaded name, so a file can't be served as HTML or script.
const localName = (mimetype) =>
  `${crypto.randomBytes(12).toString("hex")}${IMAGE_TYPES[mimetype] || ".jpg"}`;

// Resolves with Cloudinary's result: { secure_url, public_id, width, height, … }.
const uploadToCloudinary = async (
  fileBuffer,
  originalName,
  folder,
  mimetype,
) => {
  if (useLocal()) {
    const name = localName(mimetype);
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    await fs.writeFile(path.join(LOCAL_DIR, name), fileBuffer);
    return { secure_url: `/uploads/local/${name}`, public_id: `local/${name}` };
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        resource_type: "image",
        use_filename: true,
        unique_filename: true,
        filename_override: originalName,
      },
      (error, result) => (error ? reject(error) : resolve(result)),
    );
    stream.end(fileBuffer);
  });
};

const deleteFromCloudinary = async (publicId) => {
  if (publicId.startsWith("local/")) {
    await fs.rm(path.join(LOCAL_DIR, path.basename(publicId)), { force: true });
    return;
  }
  await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
};

module.exports = { imageUpload, uploadToCloudinary, deleteFromCloudinary };
