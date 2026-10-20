// Launch-day step (web/README.md checklist): upload the seven outreach photos
// the website shows today into the admin Gallery, as its starting set.
// Uses the live settings in server/.env (MONGODB_URI and the CLOUDINARY_*
// values), so it changes live data: run it only when told to, from the
// server folder:
//
//   node scripts/seed-gallery.js --confirm
//
// It does nothing if the gallery already has photos.
const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const GalleryPhoto = require("../src/models/GalleryPhoto");
const { uploadToCloudinary } = require("../src/lib/uploads");

const PHOTOS_DIR = path.join(__dirname, "../../web/src/assets/photos");
// Same photos, order and descriptions as web/src/data/gallery.ts.
const PHOTOS = [
  ["outreach-1.jpg", "Women with babies at an OMWI outreach while a volunteer hands out items"],
  ["outreach-3.jpg", "A volunteer speaking with mothers and children seated on benches"],
  ["outreach-5.jpg", "A smiling woman carrying a box of supplies at an outreach"],
  ["outreach-6.jpg", "A mother holding her sleeping baby, seated outdoors"],
  ["outreach-2.jpg", "Women seated on benches in a large hall during an OMWI outreach"],
  ["outreach-4.jpg", "Mothers holding babies, seated along a bench at an outreach"],
  ["mother-and-child.jpg", "A smiling mother holding her young child, in black and white"],
];

const main = async () => {
  if (!process.argv.includes("--confirm")) {
    console.log("This uploads to the live Cloudinary account and database. Add --confirm to run it.");
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    if (await GalleryPhoto.exists({})) {
      console.log("The gallery already has photos; nothing to do.");
      return;
    }
    for (const [index, [file, alt]] of PHOTOS.entries()) {
      const uploaded = await uploadToCloudinary(fs.readFileSync(path.join(PHOTOS_DIR, file)), file, "omwi/gallery");
      await GalleryPhoto.create({
        url: uploaded.secure_url,
        publicId: uploaded.public_id,
        width: uploaded.width,
        height: uploaded.height,
        // "outreach-1.jpg" -> "outreach-1"; the first six fill the Home photo strip.
        name: file.replace(/\.[^.]+$/, ""),
        alt,
        onHome: index < GalleryPhoto.HOME_LIMIT,
        order: index,
      });
      console.log(`Added ${file}`);
    }
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
