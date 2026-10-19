// Launch-day step (web/README.md checklist): copy the old site's donation
// records into the new donations list. Uses the live settings in server/.env
// (MONGODB_URI, PAYSTACK_SECRET_KEY), so it changes live data: run it only
// when told to, from the server folder:
//
//   node scripts/import-donations.js --confirm
//
// Running it again later adds only what is new; nothing is changed or doubled.
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const { importManualContributions, importPaystackHistory } = require("../src/lib/importDonations");

const main = async () => {
  if (!process.argv.includes("--confirm")) {
    console.log("This writes to the live database. Add --confirm to run it.");
    return;
  }
  if (!process.env.MONGODB_URI || !process.env.PAYSTACK_SECRET_KEY) {
    throw new Error("MONGODB_URI and PAYSTACK_SECRET_KEY must be set in server/.env");
  }
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    const manual = await importManualContributions();
    console.log(`Bank transfers added: ${manual}`);
    const paystack = await importPaystackHistory();
    console.log(`Paystack donations added: ${paystack} (hidden from the Contributors page until the admin switches them on)`);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
