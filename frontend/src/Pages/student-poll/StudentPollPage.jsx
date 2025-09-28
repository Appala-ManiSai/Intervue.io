import React, { useState, useEffect, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import socket from "../../socket"; 
import "./StudentPollPage.css";
import stopwatch from "../../assets/stopwatch.svg";
import { useNavigate } from "react-router-dom";

const StudentPollPage = () => {
  const [votes, setVotes] = useState({});
  const [selectedOption, setSelectedOption] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [pollQuestion, setPollQuestion] = useState("");
  const [pollOptions, setPollOptions] = useState([]);
  const [pollId, setPollId] = useState("");
  const [kickedOut, setKickedOut] = useState(false);
  const timerRef = useRef(null);
  const navigate = useNavigate();

  const totalVotes = Object.values(votes).reduce((a, b) => a + b, 0);

  const handleOptionSelect = (option) => setSelectedOption(option);

  const handleSubmit = () => {
    if (selectedOption) {
      const username = sessionStorage.getItem("username");
      if (username) {
        const selectedOptionObj = pollOptions.find(o => o.text === selectedOption);
        if (selectedOptionObj) {
          socket.emit("submitVote", {
            pollId,
            optionId: selectedOptionObj.id,
            studentId: username
          });
          setSubmitted(true);
          sessionStorage.setItem(`voted_${pollId}`, "true");
        }
      }
    }
  };

  useEffect(() => {
    const handleKickedOut = () => {
      setKickedOut(true);
      sessionStorage.removeItem("username");
      navigate("/kicked-out");
    };
    socket.on("kickedOut", handleKickedOut);
    return () => socket.off("kickedOut", handleKickedOut);
  }, [navigate]);

  useEffect(() => {
    socket.on("poll", (pollData) => {
      setPollQuestion(pollData.question);
      setPollOptions(pollData.options);
      setVotes({});
      setSelectedOption(null);
      const votedFlag = sessionStorage.getItem(`voted_${pollData.id}`);
      setSubmitted(!!votedFlag);
      setTimeLeft(pollData.timerSec || 60);
      setPollId(pollData.id);
      sessionStorage.setItem("currentPoll", JSON.stringify(pollData));
    });

    socket.on("pollResults", (data) => {
      if (data && data.pollId === pollId && data.votes) {
        console.log("[StudentPollPage] pollResults received:", data.votes);
        setVotes(data.votes);
      }
    });

    if (!pollQuestion) {
      const pollStr = sessionStorage.getItem("currentPoll");
      if (pollStr) {
        try {
          const pollData = JSON.parse(pollStr);
          setPollQuestion(pollData.question);
          setPollOptions(pollData.options);
          setVotes({});
          setSelectedOption(null);

          const votedFlag = sessionStorage.getItem(`voted_${pollData.id}`);
          setSubmitted(!!votedFlag);
          setTimeLeft(pollData.timerSec || 60);
          setPollId(pollData.id);
        } catch (e) {
        }
      }
    }

    return () => {
      socket.off("poll");
      socket.off("pollResults");
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (timeLeft > 0 && !submitted) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current);
            setSubmitted(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(timerRef.current);
  }, [timeLeft, submitted]);


  useEffect(() => {
    console.log("[StudentPollPage] votes state:", votes);
  }, [votes]);

  const calculatePercentage = (count) =>
    totalVotes === 0 ? 0 : (count / totalVotes) * 100;

  if (kickedOut) return <div>kicked</div>;

  return (
    <>
      <div className="container mt-5 w-50">
        <div className="d-flex align-items-center mb-4">
          <h5 className="m-0 pe-5">Question</h5>
          <img src={stopwatch} width="15px" height="auto" alt="Stopwatch" />
          <span className="ps-2 ml-2 text-danger">{timeLeft}s</span>
        </div>
        <div className="card">
          <div className="card-body">
            <h6 className="question py-2 ps-2 float-left rounded text-white">
              {pollQuestion}
            </h6>
            <div className="list-group mt-4">
              {Array.isArray(pollOptions) && pollOptions.length > 0 ? (
                pollOptions.map((option) => (
                  <div
                    key={option.id}
                    className={`list-group-item rounded m-1 ${
                      selectedOption === option.text ? "border option-border" : ""
                    }`}
                    style={{
                      padding: "10px",
                      cursor: submitted || timeLeft === 0 ? "not-allowed" : "pointer",
                    }}
                    onClick={() => {
                      if (!submitted && timeLeft > 0) handleOptionSelect(option.text);
                    }}
                  >
                    <div className="d-flex justify-content-between align-items-center">
                      <span className={`ml-2 text-left ${submitted ? "font-weight-bold" : ""}`}>
                        {option.text}
                      </span>
                      {submitted && (
                        <span className="text-right">
                          {(() => {
                            const key = option.text;
                            const lowerKey = key.toLowerCase();
                            const voteCount = votes[key] !== undefined
                              ? votes[key]
                              : votes[lowerKey] !== undefined
                                ? votes[lowerKey]
                                : 0;
                            return Math.round(calculatePercentage(voteCount));
                          })()}%
                        </span>
                      )}
                    </div>
                    {submitted && (
                      <div className="progress mt-2">
                        <div
                          className="progress-bar progress-bar-bg"
                          role="progressbar"
                          style={{
                            width: `${(() => {
                              const key = option.text;
                              const lowerKey = key.toLowerCase();
                              const voteCount = votes[key] !== undefined
                                ? votes[key]
                                : votes[lowerKey] !== undefined
                                  ? votes[lowerKey]
                                  : 0;
                              return calculatePercentage(voteCount);
                            })()}%`
                          }}
                          aria-valuenow={(() => {
                            const key = option.text;
                            const lowerKey = key.toLowerCase();
                            return votes[key] !== undefined
                              ? votes[key]
                              : votes[lowerKey] !== undefined
                                ? votes[lowerKey]
                                : 0;
                          })()}
                          aria-valuemin="0"
                          aria-valuemax="100"
                        ></div>
                      </div>
                    )}
                  </div>
                ))
              ) : (
                <div className="text-muted">No options available.</div>
              )}
            </div>
          </div>
        </div>

        {!submitted && selectedOption && timeLeft > 0 && (
          <div className="d-flex justify-content-end align-items-center">
            <button type="submit" className="btn continue-btn my-3 w-25" onClick={handleSubmit}>
              Submit
            </button>
          </div>
        )}

        {submitted && (
          <div className="mt-5">
            <h6 className="text-center">Wait for the teacher to ask a new question...</h6>
          </div>
        )}
      </div>
    </>
  );
};

export default StudentPollPage;
