import React, { useState, useEffect } from "react";
import stars from "../../assets/spark.svg";
import { useNavigate } from "react-router-dom";
import socket from "../../socket";
import "./StudentLandingPage.css";

const StudentLandingPage = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [joining, setJoining] = useState(false);

  const handleStudentLogin = (e) => {
    e.preventDefault();
    if (!name.trim()) return alert("Enter your name");
    if (joining) return;
    setJoining(true);

    sessionStorage.setItem("username", name);

    if (!socket.connected) {
      console.log("[StudentLandingPage] Socket not connected, connecting now...");
      socket.connect();
    } else {
      console.log("[StudentLandingPage] Socket already connected");
    }

    socket.emit("join", { role: "student", studentId: name });
    console.log("[StudentLandingPage] Emitted join for student:", name);
  };

  useEffect(() => {
    const pollListener = (poll) => {
      console.log("[StudentLandingPage] Received poll event:", poll);
      sessionStorage.setItem("currentPoll", JSON.stringify(poll));
      console.log("[StudentLandingPage] Navigating to /poll-question");
      navigate("/poll-question");
    };
    socket.off("poll", pollListener); 
    socket.on("poll", pollListener);
    return () => {
      socket.off("poll", pollListener);
    };
  }, [navigate]);

  return (
    <div className="d-flex justify-content-center align-items-center vh-100 w-50 mx-auto">
      <div className="student-landing-container text-center">
        <button className="btn btn-sm intervue-btn mb-5">
          <img src={stars} className="px-1" alt="" />
          Intervue Poll
        </button>
        <h3 className="landing-title">
          Let's <b>Get Started</b>
        </h3>
        <p className="landing-description">
          If you're a student, you'll be able to <b style={{ color: "black" }}>submit your answers</b>, participate in live polls, and see how your responses compare with your classmates
        </p>
        <form onSubmit={handleStudentLogin}>
          <div className="w-50 mx-auto my-4">
            <p className="name-label">Enter your Name</p>
            <input
              type="text"
              className="form-control name-input"
              required
              onChange={(e) => setName(e.target.value)}
            />
            <button type="submit" className="btn continue-btn my-3" disabled={joining}>
              {joining ? "Joining..." : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StudentLandingPage;
