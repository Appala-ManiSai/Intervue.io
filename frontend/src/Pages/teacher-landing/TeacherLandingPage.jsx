import React, { useState, useEffect } from "react";
import stars from "../../assets/spark.svg";
import "./TeacherLandingPage.css";
import io from "socket.io-client";
import { useNavigate } from "react-router-dom";
import eyeIcon from "../../assets/eye.svg";

let apiUrl =
  import.meta.env.VITE_NODE_ENV === "production"
    ? import.meta.env.VITE_API_BASE_URL
    : "http://localhost:3000";

const socket = io(apiUrl);

const TeacherLandingPage = () => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState([{ id: 1, text: "", correct: null }]);
  const [timer, setTimer] = useState("60");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const username = sessionStorage.getItem("username");

  useEffect(() => {
  socket.emit("join", { role: "teacher" });
  console.log("Teacher joined room");
}, []);

  const handleQuestionChange = (e) => setQuestion(e.target.value);
  const handleTimerChange = (e) => setTimer(e.target.value);

  const handleOptionChange = (index, value) => {
    const updatedOptions = [...options];
    updatedOptions[index].text = value;
    setOptions(updatedOptions);
  };

  const handleCorrectToggle = (index, isCorrect) => {
    const updatedOptions = [...options];
    updatedOptions[index].correct = isCorrect;
    setOptions(updatedOptions);
  };

  const addOption = () => {
    setOptions([...options, { id: options.length + 1, text: "", correct: null }]);
  };

  const validateForm = () => {
    if (!question.trim()) {
      setError("Question cannot be empty");
      return false;
    }
    if (options.length < 2) {
      setError("At least two options are required");
      return false;
    }
    if (options.some((o) => !o.text.trim())) {
      setError("All options must have text");
      return false;
    }
    if (!options.some((o) => o.correct === true)) {
      setError("At least one correct option must be selected");
      return false;
    }
    setError("");
    return true;
  };

  const askQuestion = () => {
    if (!validateForm()) return;

    const pollData = {
      question,
      options,
      timer,
      teacherUsername: username
    };

    socket.emit("createPoll", pollData);

    socket.once("createPollSuccess", ({ pollId }) => {
      console.log("Poll created successfully:", pollId);
      navigate("/teacher-poll"); 
    });

    socket.once("createPollError", ({ reason }) => {
      alert("Poll creation failed: " + reason);
    });
  };

  const handleViewPollHistory = () => navigate("/teacher-poll-history");

  return (
    <>
      <button
        className="btn rounded-pill ask-question px-4 m-2"
        onClick={handleViewPollHistory}
      >
        <img src={eyeIcon} alt="" /> View Poll history
      </button>

      <div className="container my-4 w-75 ms-5">
        <button className="btn btn-sm intervue-btn mb-3">
          <img src={stars} alt="Poll Icon" /> Intervue Poll
        </button>

        <h2 className="fw-bold">
          Let's <strong>Get Started</strong>
        </h2>
        <p>
          <b>Teacher: </b>
          {username}
        </p>
        <p className="text-muted">
          Create and manage live polls. Your students will see questions in real-time.
        </p>

        {error && <div className="alert alert-danger">{error}</div>}

        <div className="mb-4">
          <label className="form-label">Question</label>
          <input
            type="text"
            className="form-control"
            placeholder="Type your question..."
            value={question}
            onChange={handleQuestionChange}
            maxLength={100}
          />
          <select
            className="form-select mt-2 w-auto"
            value={timer}
            onChange={handleTimerChange}
          >
            <option value="30">30 seconds</option>
            <option value="60">60 seconds</option>
            <option value="90">90 seconds</option>
          </select>
        </div>

        <div className="mb-4">
          <label className="form-label">Options</label>
          {options.map((option, index) => (
            <div key={option.id} className="d-flex align-items-center mb-2">
              <span className="me-3">{index + 1}</span>
              <input
                type="text"
                className="form-control me-3"
                placeholder="Option text..."
                value={option.text}
                onChange={(e) => handleOptionChange(index, e.target.value)}
              />
              <div className="form-check form-check-inline">
                <input
                  className="form-check-input"
                  type="radio"
                  name={`correct-${index}`}
                  checked={option.correct === true}
                  onChange={() => handleCorrectToggle(index, true)}
                />
                <label className="form-check-label">Yes</label>
              </div>
              <div className="form-check form-check-inline">
                <input
                  className="form-check-input"
                  type="radio"
                  name={`correct-${index}`}
                  checked={option.correct === false}
                  onChange={() => handleCorrectToggle(index, false)}
                />
                <label className="form-check-label">No</label>
              </div>
            </div>
          ))}
          <button className="btn add-options" onClick={addOption}>
            + Add More option
          </button>
        </div>

        <button
          className="btn rounded-pill ask-question px-4 m-2"
          onClick={askQuestion}
        >
          Ask Question
        </button>
      </div>
    </>
  );
};

export default TeacherLandingPage;
