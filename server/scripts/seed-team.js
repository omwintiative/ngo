// One-off step: put the four team cards the website shows today into
// Admin · Team, so the client can edit them there (same people as
// web/src/data/team.ts: Chiamaka Osuji and three "Full name / Role"
// placeholders from the Figma design). Uses the live settings in server/.env
// (MONGODB_URI), so it changes live data: run it only when told to, from the
// server folder:
//
//   node scripts/seed-team.js --confirm
//
// It does nothing if the team already has people.
const dotenv = require("dotenv");
const mongoose = require("mongoose");

dotenv.config();

const TeamMember = require("../src/models/TeamMember");

const PEOPLE = [
  ["Chiamaka Osuji, BScN, RN", "Founder"],
  ["Full name", "Role"],
  ["Full name", "Role"],
  ["Full name", "Role"],
];

const main = async () => {
  if (!process.argv.includes("--confirm")) {
    console.log("This writes to the live database. Add --confirm to run it.");
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI);
  try {
    if (await TeamMember.exists({})) {
      console.log("The team already has people; nothing to do.");
      return;
    }
    await TeamMember.insertMany(PEOPLE.map(([name, role], order) => ({ name, role, order })));
    console.log(`Added ${PEOPLE.length} team cards.`);
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
