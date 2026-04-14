import { useState, useEffect, useRef } from "react";

function App() {
  const [messages, setMessages] = useState<string[]>([]);
  const [input, setInput] = useState("");
  const ws = useRef<WebSocket | null>(null);

  const clientId = useRef(Math.floor(Math.random() * 1000));

  useEffect(() => {
    ws.current = new WebSocket(`ws://localhost:8000/ws/${clientId.current}`);

    ws.current.onmessage = (event) => {
      setMessages((prev) => [...prev, event.data]);
    };

    return () => {
      ws.current?.close();
    };
  }, []);

  const sendMessage = () => {
    if (ws.current && input) {
      ws.current.send(input);
      setInput("");
    }
  };

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        height: "100vh",
        gridTemplateRows: "auto 1fr",
        gap: "20px",
        padding: "20px",
        fontFamily: "sans-serif",
        backgroundColor: "#1a1a1a",
        color: "white",
      }}
    >
      <div style={{ display: "grid", justifyItems: "center", gap: "15px" }}>
        <h1>Player #{clientId.current} Dashboard</h1>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto",
            gap: "10px",
          }}
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Type a message..."
            style={{ padding: "8px", borderRadius: "4px", border: "none" }}
          />
          <button
            onClick={sendMessage}
            style={{
              padding: "8px 16px",
              cursor: "pointer",
              borderRadius: "4px",
              border: "none",
              backgroundColor: "#646cff",
              color: "white",
            }}
          >
            Send Ping
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          alignContent: "start",
          width: "400px",
          height: "300px",
          border: "1px solid #444",
          borderRadius: "8px",
          padding: "15px",
          overflowY: "auto",
          backgroundColor: "#2a2a2a",
        }}
      >
        {messages.map((msg, idx) => (
          <div
            key={idx}
            style={{ padding: "5px 0", borderBottom: "1px solid #333" }}
          >
            {msg}
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
