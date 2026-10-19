// Image uploads for the blog and the gallery: JPEG, PNG or WebP, up to 5 MB
// each, kept in memory and sent to Cloudinary. Upload problems become a
// clear 400 instead of a server error.
const multer = require("multer");
const cloudinary = require("../config/cloudinary");

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
const NOT_AN_IMAGE = "NOT_AN_IMAGE";

// `fields`: multer field list, e.g. [{ name: "photo", maxCount: 1 }].
const imageUpload = (fields) => {
  const maxFiles = fields.reduce((sum, f) => sum + (f.maxCount || 1), 0);
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_IMAGE_BYTES, files: maxFiles },
    fileFilter(req, file, callback) {
      if (IMAGE_TYPES.includes(file.mimetype)) return callback(null, true);
      return callback(new Error(NOT_AN_IMAGE));
    },
  }).fields(fields);

  return (req, res, next) =>
    upload(req, res, (error) => {
      if (!error) return next();
      let message = "The images could not be read. Please try again.";
      if (error.code === "LIMIT_FILE_SIZE") message = "Each image must be 5 MB or smaller.";
      else if (error.message === NOT_AN_IMAGE) message = "Images must be JPEG, PNG or WebP files.";
      else if (error.code === "LIMIT_FILE_COUNT" || error.code === "LIMIT_UNEXPECTED_FILE") {
        message = maxFiles === 1 ? "Add one image." : `Add up to ${maxFiles} images.`;
      }
      return res.status(400).json({ message });
    });
};

// Resolves with Cloudinary's result: { secure_url, public_id, width, height, … }.
const uploadToCloudinary = (fileBuffer, originalName, folder) =>
  new Promise((resolve, reject) => {
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

const deleteFromCloudinary = (publicId) => cloudinary.uploader.destroy(publicId, { resource_type: "image" });

module.exports = { imageUpload, uploadToCloudinary, deleteFromCloudinary };
