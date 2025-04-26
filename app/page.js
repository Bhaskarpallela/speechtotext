"use client";
import { useRef, useState } from "react";
import { FaMicrophone } from "react-icons/fa";

export default function Page() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioURL, setAudioURL] = useState(null);
  const [transcription, setTranscription] = useState("");
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const socketRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      // Initialize WebSocket connection
      // Use the current hostname and protocol to make it work in all environments
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/transcribe`;
      socketRef.current = new WebSocket(wsUrl);

      socketRef.current.onopen = () => {
        console.log("WebSocket connection established");
        mediaRecorder.start(250); // Emit audio chunks every 250ms
        setIsRecording(true);
      };

      socketRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log("Received:", data);
          if (data.transcription) {
            setTranscription((prev) => prev + " " + data.transcription);
          }
        } catch (err) {
          console.error("Failed to parse message:", err);
        }
      };

      socketRef.current.onerror = (error) => {
        console.error("WebSocket error:", error);
      };

      socketRef.current.onclose = (event) => {
        console.warn("WebSocket closed:", event.code, event.reason);
      };

      mediaRecorder.ondataavailable = async (event) => {
        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          const arrayBuffer = await event.data.arrayBuffer();
          socketRef.current.send(arrayBuffer);
        }
        audioChunksRef.current.push(event.data);
      };

      mediaRecorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const audioURL = URL.createObjectURL(audioBlob);
        setAudioURL(audioURL);
        audioChunksRef.current = [];

        if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
          socketRef.current.close();
        }
      };
    } catch (error) {
      console.error("Microphone access error:", error);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100">
      <div>
        <button
          onClick={() => {
            isRecording ? stopRecording() : startRecording();
          }}
          className={`flex items-center gap-2 ${
            isRecording ? "bg-red-500 animate-pulse" : "bg-green-500"
          } p-3 text-white rounded-full shadow-lg hover:shadow-xl transition-all`}
        >
          <FaMicrophone className="text-xl" />
          <span>{isRecording ? "Stop Recording" : "Start Recording"}</span>
        </button>
      </div>

      <div className="flex flex-col mt-4 w-full items-center justify-center gap-4">
        <p className="text-blue-400">Transcription</p>
        <div className="p-4 bg-white rounded-lg shadow-md w-1/2 h-[250px] text-black font-sans overflow-auto">
          {transcription || "Waiting for transcription..."}
        </div>
      </div>

      <div className="flex flex-col mt-4 w-full items-center justify-center gap-4">
        <p className="text-blue-400">Recorded Audio</p>
        <div className="p-4 bg-white rounded-lg shadow-md w-1/2 h-[250px] overflow-auto">
          {audioURL && (
            <audio controls>
              <source src={audioURL} type="audio/webm" />
              Your browser does not support the audio element.
            </audio>
          )}
        </div>
      </div>
    </div>
  );
}