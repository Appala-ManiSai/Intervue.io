const mongoose = require("mongoose");

const TeacherSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("Teacher", TeacherSchema);
