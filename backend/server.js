
require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const mongoose = require("mongoose");
const { Server } = require("socket.io");
const { Types: { ObjectId } } = require("mongoose");

const Teacher = require("./models/teacher");
const Poll = require("./models/Poll");

const app = express();
const server = http.createServer(app);

const CLIENT_ORIGINS = (process.env.CLIENT_ORIGINS || "http://localhost:5173")
  .split(",")
  .map(s => s.trim());

app.use(cors({ origin: CLIENT_ORIGINS }));
app.use(express.json());

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error("Missing MONGODB_URI in env");
  process.exit(1);
}
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("Connected to MongoDB Atlas"))
  .catch(err => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

const io = new Server(server, {
  cors: {
    origin: CLIENT_ORIGINS,
    methods: ["GET", "POST"]
  }
});

const pollTimers = new Map();
let currentActivePoll = null;


app.post("/teacher-login", async (req, res) => {
  try {
    let username = (req.body && req.body.username) || `teacher_${Math.random().toString(36).slice(2,8)}`;
    let teacher = await Teacher.findOne({ username });
    if (!teacher) {
      teacher = await Teacher.create({ username });
    }
    return res.json({ username: teacher.username });
  } catch (err) {
    console.error("teacher-login error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});


app.get("/teacher/:username/polls", async (req, res) => {
  try {
    const username = req.params.username;
    
    const polls = await Poll.find({ teacherUsername: username }).sort({ createdAt: -1 }).lean();
    console.log(`[DEBUG] Polls found:`, polls);
    return res.json({ polls });
  } catch (err) {
    console.error("get polls error:", err);
    return res.status(500).json({ error: "Server error" });
  }
});


io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  socket.on("join", (data) => {
    try {
      socket.data.role = data.role || null;
      socket.data.studentId = data.studentId || null;

      if (data.role === "student") {
        socket.join("students");
        
        if (currentActivePoll) {
          socket.emit("poll", currentActivePoll);
          console.log(`[JOIN] Sent current poll to late-joining student ${socket.id}:`, currentActivePoll);
        } else {
          console.log(`[JOIN] No active poll to send to student ${socket.id}`);
        }
      } else if (data.role === "teacher") {
        socket.join("teachers");
        
      }
    } catch (err) {
      console.error("join error", err);
    }
  });


  socket.on("createPoll", async (payload) => {
    try {
      if (!payload || !payload.question || !payload.options) {
        socket.emit("createPollError", { reason: "Invalid payload" });
        return;
      }

  const teacherUsername = payload.teacherUsername || null;
      const timerSec = parseInt(payload.timer, 10) || 60;

      const options = (payload.options || []).map((o, idx) => ({
        id: o.id ?? (idx + 1),
        text: o.text,
        votes: 0 
      }));
      const poll = await Poll.create({
      _id: new ObjectId(),       
      question: payload.question,
      options,
      teacherUsername,
      timerSec
});

      const publicPoll = {
        id: poll._id.toString(), 
        question: poll.question,
        options: poll.options.map(o => ({ id: o.id, text: o.text })),
        timerSec: poll.timerSec,
        createdAt: poll.createdAt
      };
      currentActivePoll = publicPoll;

  io.to("students").emit("poll", publicPoll);
  console.log(`[POLL] Poll emitted to students:`, publicPoll);
      const timer = setTimeout(async () => {
        await endPoll(poll._id.toString());
      }, timerSec * 1000);

      pollTimers.set(poll._id.toString(), timer);

      socket.emit("createPollSuccess", { pollId: poll._id.toString() });
      console.log("Poll created:", poll._id.toString(), "by", teacherUsername);
    } catch (err) {
      console.error("createPoll error:", err);
      socket.emit("createPollError", { reason: "Server error" });
    }
  });

  socket.on("submitVote", async (payload) => {
    try {
      if (!payload || !payload.pollId || payload.optionId === undefined) {
        socket.emit("voteRejected", { reason: "Invalid payload" });
        return;
      }
      const voterKey = payload.studentId || socket.data.studentId || socket.id;
      const pollId = payload.pollId;

      const poll = await Poll.findById(pollId);
      if (!poll) {
        console.log('[DEBUG] voteRejected: Poll not found');
        socket.emit("voteRejected", { reason: "Poll not found" });
        return;
      }
      if (poll.ended) {
        console.log('[DEBUG] voteRejected: Poll ended');
        socket.emit("voteRejected", { reason: "Poll ended" });
        return;
      }

      if (poll.voters.includes(voterKey)) {
        console.log('[DEBUG] voteRejected: Already voted');
        socket.emit("voteRejected", { reason: "Already voted" });
        return;
      }

      const opt = poll.options.find(o => o.id === payload.optionId || o._id?.toString() === payload.optionId);
      if (!opt) {
        socket.emit("voteRejected", { reason: "Invalid option" });
        return;
      }

      
      opt.votes = (opt.votes || 0) + 1;
      poll.voters.push(voterKey);
      await poll.save();
      

      const results = poll.options.reduce((acc, o) => {
        acc[o.text] = o.votes;
        return acc;
      }, {});


  
  io.to("students").emit("pollResults", { pollId: poll._id.toString(), votes: results });

      socket.emit("voteAccepted", { pollId: poll._id.toString() });
    } catch (err) {
      console.error("submitVote error:", err);
      socket.emit("voteRejected", { reason: "Server error" });
    }
  });

  socket.on("endPollNow", async (payload) => {
    try {
      if (!payload || !payload.pollId) return;
      await endPoll(payload.pollId);
    } catch (err) {
      console.error("endPollNow error", err);
    }
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected:", socket.id);
  });
});


async function endPoll(pollId) {
  try {
    const poll = await Poll.findById(pollId);
    if (!poll || poll.ended) return;
    poll.ended = true;
    await poll.save();

    const t = pollTimers.get(pollId);
    if (t) {
      clearTimeout(t);
      pollTimers.delete(pollId);
    }

    if (currentActivePoll && currentActivePoll.id === pollId) {
      currentActivePoll = null;
    }

    const results = poll.options.reduce((acc, o) => {
      acc[o.text] = o.votes;
      return acc;
    }, {});

    if (poll.teacherUsername) {
      io.to(`class:${poll.teacherUsername}`).emit("pollEnded", { pollId, votes: results });
    } else {
      io.to("students").emit("pollEnded", { pollId, votes: results });
    }

  } catch (err) {
    console.error("endPoll helper error:", err);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
