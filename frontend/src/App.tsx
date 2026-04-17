import { useEffect, useRef, useState } from "react";
import * as Phaser from "phaser";

function App() {
  const gameRef = useRef<HTMLDivElement>(null);
  const ws = useRef<WebSocket | null>(null);

  // 1. The useState fix so the screen redraws when we get an ID!
  const [clientId, setClientId] = useState("Connecting...");
  const myColor = useRef<number>(0xff0000);
  const [connected, setConnected] = useState(false);
  const gameInitialized = useRef(false);

  const networkPlayers = useRef<Record<string, { x: number; y: number }>>({});
  const playerSpriteRef = useRef<Phaser.Physics.Arcade.Sprite | null>(null);

  useEffect(() => {
    ws.current = new WebSocket(`ws://localhost:8080/ws`);
    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "assign") {
          setClientId(data.id); // Trigger the screen redraw!
          myColor.current = parseInt(data.color, 16);
          if (playerSpriteRef.current) {
            playerSpriteRef.current.setTint(myColor.current);
          }
        } else if (data.type === "move") {
          if (data.position && data.position.x !== undefined) {
            networkPlayers.current[data.id] = data.position;
          }
        }
      } catch (e) {
        console.log("Error parsing message", event.data);
      }
    };

    if (!gameRef.current || gameInitialized.current) return;
    gameInitialized.current = true;

    let player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    let cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    const otherPlayerSprites: Record<
      string,
      Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
    > = {};

    // --- PHASER SCENE FUNCTIONS --- //

    function preload(this: Phaser.Scene) {
      // Load the flipbook from the public folder
      this.load.spritesheet("dude", "dude.png", {
        frameWidth: 32,
        frameHeight: 48,
      });
    }

    function create(this: Phaser.Scene) {
      // Spawn the Sprite instead of a Rectangle
      player = this.physics.add.sprite(400, 300, "dude");
      player.setTint(myColor.current);
      player.body.setCollideWorldBounds(true);
      playerSpriteRef.current = player;

      const floor = this.add.rectangle(
        400,
        580,
        800,
        40,
        0x00ff00,
      ) as unknown as Phaser.Types.Physics.Arcade.SpriteWithStaticBody;
      this.physics.add.existing(floor, true);
      this.physics.add.collider(player, floor);

      // Setup the animations
      this.anims.create({
        key: "left",
        frames: this.anims.generateFrameNumbers("dude", { start: 0, end: 3 }),
        frameRate: 10,
        repeat: -1,
      });
      this.anims.create({
        key: "turn",
        frames: [{ key: "dude", frame: 4 }],
        frameRate: 20,
      });
      this.anims.create({
        key: "right",
        frames: this.anims.generateFrameNumbers("dude", { start: 5, end: 8 }),
        frameRate: 10,
        repeat: -1,
      });

      if (this.input.keyboard) cursors = this.input.keyboard.createCursorKeys();
    }

    function update(this: Phaser.Scene) {
      if (!cursors || !player) return;

      // Keyboard Controls + Animation Triggers
      if (cursors.left.isDown) {
        player.body.velocity.x = -200;
        player.anims.play("left", true);
      } else if (cursors.right.isDown) {
        player.body.velocity.x = 200;
        player.anims.play("right", true);
      } else {
        player.body.velocity.x = 0;
        player.anims.play("turn");
      }

      if (cursors.up.isDown && player.body.blocked.down) {
        player.body.velocity.y = -350;
      }

      // Networking
      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ x: player.x, y: player.y }));
      }

      Object.keys(networkPlayers.current).forEach((id) => {
        if (!otherPlayerSprites[id]) {
          const enemyColor = myColor.current === 0xff0000 ? 0x00aaff : 0xff0000;

          // Spawn enemy as a Sprite too!
          otherPlayerSprites[id] = this.physics.add.sprite(400, 300, "dude");
          otherPlayerSprites[id].setTint(enemyColor);
          (
            otherPlayerSprites[id].body as Phaser.Physics.Arcade.Body
          ).setAllowGravity(false);
        }
        otherPlayerSprites[id].x = networkPlayers.current[id].x;
        otherPlayerSprites[id].y = networkPlayers.current[id].y;
      });
    }

    // 2. The Config must include physics and preload!
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 800,
      height: 600,
      parent: gameRef.current,
      physics: {
        default: "arcade",
        arcade: { gravity: { y: 400, x: 0 }, debug: false },
      },
      scene: { preload, create, update },
    };

    const game = new Phaser.Game(config);

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
        gap: "20px",
        backgroundColor: "#1a1a1a",
        color: "white",
        fontFamily: "sans-serif",
      }}
    >
      <div>
        <h1>Multiplayer Platformer</h1>
        <p
          style={{
            color: connected ? "#4ade80" : "#f87171",
            textAlign: "center",
          }}
        >
          Player ID: {clientId} | {connected ? "Connected" : "Disconnected"}
        </p>
      </div>
      <div
        ref={gameRef}
        style={{
          border: "4px solid #333",
          borderRadius: "8px",
          overflow: "hidden",
        }}
      />
    </div>
  );
}

export default App;
