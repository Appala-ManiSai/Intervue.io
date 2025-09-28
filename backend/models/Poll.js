const mongoose = require("mongoose");

const OptionSchema = new mongoose.Schema({
  id: { type: Number, required: true },
  text: { type: String, required: true },
  votes: { type: Number, default: 0 }
}, { _id: false });

const PollSchema = new mongoose.Schema({
  question: { type: String, required: true },
  options: { type: [OptionSchema], required: true },
  voters: { type: [String], default: [] }, 
  teacherUsername: { type: String, index: true },
  timerSec: { type: Number, default: 60 },
  createdAt: { type: Date, default: Date.now },
  ended: { type: Boolean, default: false }
});

module.exports = mongoose.model("Poll", PollSchema);
