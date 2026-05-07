const mongoose = require("mongoose");
const dotenv = require("dotenv");
dotenv.config();

const TallyJournalSchema = new mongoose.Schema({
  journalName: String,
  branch: mongoose.Schema.Types.Mixed // Using Mixed to see what's actually there
}, { strict: false });

const TallyJournal = mongoose.model("TallyJournal", TallyJournalSchema);

async function check() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    const journals = await TallyJournal.find({ journalName: /DISCOUNT/i });
    console.log("Found Journals matching DISCOUNT:", journals.length);
    journals.forEach(j => {
        console.log(`- ID: ${j._id}, Name: ${j.journalName}, Branch: ${j.branch}, BranchType: ${typeof j.branch}`);
    });
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
check();
