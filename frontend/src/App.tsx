import { useEffect, useRef, useState } from "react";
import * as Phaser from "phaser";

function App() {
  const gameRef = useRef<HTMLDivElement>(null);
  const ws = useRef<WebSocket | null>(null);
  const clientId = useRef(Math.floor(Math.random() * 1000));
  const [connected, setConnected] = useState(false);
  const gameInitialized = useRef(false);

  useEffect(() => {
    // 1. Connect the WebSocket
    ws.current = new WebSocket(`ws://localhost:8000/ws/${clientId.current}`);
    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);

    // 2. Initialize Phaser (ensure it only boots once in React Strict Mode)
    if (!gameRef.current || gameInitialized.current) return;
    gameInitialized.current = true;

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: gameRef.current, // Attaches the canvas to our div
      physics: {
        default: "arcade",
        arcade: {
          gravity: { y: 300, x: 0 }, // Adds gravity so players fall down
          debug: false,
        },
      },
      scene: {
        create: create,
        update: update,
      },
    };

    const game = new Phaser.Game(config);

    // --- PHASER SCENE LOGIC --- //
    let player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

    function create(this: Phaser.Scene) {
      // Draw a simple 32x48 red rectangle to represent Fireboy
      player = this.add.rectangle(
        400,
        300,
        32,
        48,
        0xff0000,
      ) as unknown as Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;

      // Enable physics on the player so gravity affects it
      this.physics.add.existing(player);

      // Stop the player from falling off the screen
      player.body.setCollideWorldBounds(true);

      // Add a simple green floor
      const floor = this.add.rectangle(
        400,
        580,
        800,
        40,
        0x00ff00,
      ) as unknown as Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
      this.physics.add.existing(floor, true); // 'true' makes it static (unmoving)
      this.physics.add.collider(player, floor);
    }

    function update(this: Phaser.Scene) {
      // The game loop (runs 60 times a second) - we'll add movement here next!
    }

    // Cleanup when component unmounts
    return () => {
      ws.current?.close();
      game.destroy(true);
      gameInitialized.current = false;
    };
  }, []);

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        height: "100vh",
        gridTemplateRows: "auto 1fr",
        gap: "20px",
        padding: "20px",
        backgroundColor: "#1a1a1a",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div style={{ display: "grid", gap: "5px", justifyItems: "center" }}>
        <h1>Multiplayer Platformer Engine</h1>
        <p style={{ color: connected ? "#4ade80" : "#f87171" }}>
          Player #{clientId.current} | Status:{" "}
          {connected ? "Connected to Server" : "Disconnected"}
        </p>
      </div>

      {/* The Phaser game will inject its <canvas> right inside this div */}
      <div
        ref={gameRef}
        style={{
          border: "4px solid #333",
          borderRadius: "8px",
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }}
      />
    </div>
  );
}

export default App;
