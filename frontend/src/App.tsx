import { useEffect, useRef, useState } from "react";
import * as Phaser from "phaser";

function App() {
  const gameRef = useRef<HTMLDivElement>(null);
  const ws = useRef<WebSocket | null>(null);

  const [clientId, setClientId] = useState("Connecting...");
  const myColor = useRef<number>(0xff0000);
  const [connected, setConnected] = useState(false);
  const gameInitialized = useRef(false);

  const networkPlayers = useRef<Record<string, { x: number; y: number }>>({});
  const playerSpriteRef = useRef<Phaser.Physics.Arcade.Sprite | null>(null);
  const scoreTextRef = useRef<Phaser.GameObjects.Text | null>(null);
  const gemsRef = useRef<Record<string, any>>({});
  const winTextRef = useRef<Phaser.GameObjects.Text | null>(null);
  const amIAtDoor = useRef<boolean>(false);
  const sceneRef = useRef<Phaser.Scene | null>(null);
  const gameOverTextRef = useRef<Phaser.GameObjects.Text | null>(null);

  // NEW: Track the current level!
  const currentLevel = useRef<number>(1);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    ws.current = new WebSocket(`ws://localhost:8080/ws`);
    ws.current.onopen = () => setConnected(true);
    ws.current.onclose = () => setConnected(false);

    ws.current.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "assign") {
          setClientId(data.id);
          myColor.current = parseInt(data.color, 16);
          if (playerSpriteRef.current)
            playerSpriteRef.current.setTint(myColor.current);
        } else if (data.type === "move") {
          if (data.position && data.position.x !== undefined) {
            networkPlayers.current[data.id] = data.position;
          }
        } else if (data.type === "score") {
          if (scoreTextRef.current) {
            scoreTextRef.current.setText(
              `Red: ${data.red}   Blue: ${data.blue}`,
            );
          }
        } else if (data.type === "collect") {
          const gemToHide = gemsRef.current[data.gemId];
          if (gemToHide) gemToHide.destroy();
        } else if (data.type === "win") {
          setShowModal(true);
          if (sceneRef.current) sceneRef.current.physics.pause();
        } else if (data.type === "game_over") {
          if (gameOverTextRef.current) gameOverTextRef.current.setVisible(true);
          if (sceneRef.current) sceneRef.current.physics.pause();
        } else if (data.type === "start_next_level") {
          setShowModal(false);
          currentLevel.current++;
          if (sceneRef.current) sceneRef.current.scene.restart();
        } else if (data.type === "start_retry") {
          setShowModal(false);
          if (sceneRef.current) sceneRef.current.scene.restart();
        }
      } catch (e) {
        console.log("Error parsing message", event.data);
      }
    };

    if (!gameRef.current || gameInitialized.current) return;
    gameInitialized.current = true;

    let player: Phaser.Types.Physics.Arcade.SpriteWithDynamicBody;
    let cursors: Phaser.Types.Input.Keyboard.CursorKeys;
    let redDoor: Phaser.GameObjects.Rectangle;
    let blueDoor: Phaser.GameObjects.Rectangle;
    const otherPlayerSprites: Record<
      string,
      Phaser.Types.Physics.Arcade.SpriteWithDynamicBody
    > = {};

    function preload(this: Phaser.Scene) {
      this.load.spritesheet("dude", "dude.png", {
        frameWidth: 32,
        frameHeight: 48,
      });
      this.load.image("ground", "platform.png");
      this.load.image("gem", "star.png");
      this.load.audio("bgm", "bgm.mp3");
    }

    function create(this: Phaser.Scene) {
      sceneRef.current = this;
      amIAtDoor.current = false; // Reset door lock on new level
      gemsRef.current = {}; // Clear old gems

      // Spawning them higher up for Level 2!
      const startY = currentLevel.current === 1 ? 300 : 100;
      player = this.physics.add.sprite(400, startY, "dude");
      player.setTint(myColor.current);
      player.body.setCollideWorldBounds(true);
      playerSpriteRef.current = player;

      const music = this.sound.add("bgm", { loop: true, volume: 0.5 });
      music.play();

      // Groups needed for both levels
      const platforms = this.physics.add.staticGroup();
      const lava = this.physics.add.staticGroup();
      const water = this.physics.add.staticGroup();
      const fire = this.physics.add.staticGroup();
      const redGems = this.physics.add.staticGroup();
      const blueGems = this.physics.add.staticGroup();

      // ==========================================
      //           LEVEL BUILDER LOGIC
      // ==========================================

      if (currentLevel.current === 1) {
        // --- LEVEL 1 LAYOUT ---
        platforms.create(150, 568, "ground");
        platforms.create(650, 568, "ground");
        platforms.create(600, 425, "ground");
        platforms.create(50, 300, "ground");
        platforms.create(650, 200, "ground");

        redDoor = this.add.rectangle(50, 250, 40, 60, 0xff0000, 0.5);
        blueDoor = this.add.rectangle(750, 170, 40, 60, 0x00aaff, 0.5);
        this.physics.add.existing(redDoor, true);
        this.physics.add.existing(blueDoor, true);

        const r1 = redGems.create(200, 520, "gem").setTint(0xff0000);
        r1.name = "red_1";
        gemsRef.current[r1.name] = r1;
        const r2 = redGems.create(50, 200, "gem").setTint(0xff0000);
        r2.name = "red_2";
        gemsRef.current[r2.name] = r2;

        const b1 = blueGems.create(700, 520, "gem").setTint(0x00aaff);
        b1.name = "blue_1";
        gemsRef.current[b1.name] = b1;
        const b2 = blueGems.create(750, 170, "gem").setTint(0x00aaff);
        b2.name = "blue_2";
        gemsRef.current[b2.name] = b2;

        lava
          .create(350, 568, "ground")
          .setDisplaySize(100, 40)
          .setTint(0x00ff00)
          .refreshBody();
        water
          .create(450, 568, "ground")
          .setDisplaySize(100, 40)
          .setTint(0x00aaff)
          .refreshBody();
        fire
          .create(650, 568, "ground")
          .setDisplaySize(100, 40)
          .setTint(0xff0000)
          .refreshBody();
      } else {
        // --- LEVEL 2 LAYOUT (THE CROSSROADS) ---
        platforms
          .create(100, 568, "ground")
          .setDisplaySize(200, 40)
          .refreshBody();
        platforms
          .create(700, 568, "ground")
          .setDisplaySize(200, 40)
          .refreshBody();
        platforms.create(100, 400, "ground");
        platforms.create(700, 400, "ground");
        platforms
          .create(400, 250, "ground")
          .setDisplaySize(300, 40)
          .refreshBody();

        redDoor = this.add.rectangle(350, 180, 40, 60, 0xff0000, 0.5);
        blueDoor = this.add.rectangle(450, 180, 40, 60, 0x00aaff, 0.5);
        this.physics.add.existing(redDoor, true);
        this.physics.add.existing(blueDoor, true);

        const r1 = redGems.create(250, 480, "gem").setTint(0xff0000);
        r1.name = "red_3";
        gemsRef.current[r1.name] = r1;
        const r2 = redGems.create(100, 350, "gem").setTint(0xff0000);
        r2.name = "red_4";
        gemsRef.current[r2.name] = r2;

        const b1 = blueGems.create(550, 480, "gem").setTint(0x00aaff);
        b1.name = "blue_3";
        gemsRef.current[b1.name] = b1;
        const b2 = blueGems.create(700, 350, "gem").setTint(0x00aaff);
        b2.name = "blue_4";
        gemsRef.current[b2.name] = b2;

        lava
          .create(400, 568, "ground")
          .setDisplaySize(200, 40)
          .setTint(0x00ff00)
          .refreshBody();
        fire
          .create(250, 568, "ground")
          .setDisplaySize(100, 40)
          .setTint(0xff0000)
          .refreshBody();
        water
          .create(550, 568, "ground")
          .setDisplaySize(100, 40)
          .setTint(0x00aaff)
          .refreshBody();
      }

      // ==========================================
      //           GLOBAL RULES & UI
      // ==========================================

      const winText = this.add
        .text(400, 300, "YOU WIN THE GAME!", {
          fontSize: "48px",
          fill: "#ffff00",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 6,
        })
        .setOrigin(0.5)
        .setVisible(false);
      winTextRef.current = winText;

      const gameOverText = this.add
        .text(400, 300, "GAME OVER", {
          fontSize: "64px",
          fill: "#ff0000",
          fontStyle: "bold",
          stroke: "#000000",
          strokeThickness: 8,
        })
        .setOrigin(0.5)
        .setVisible(false);
      gameOverTextRef.current = gameOverText;

      // Keep the local score text referencing whatever the server sent last
      const scoreText = this.add.text(
        16,
        16,
        scoreTextRef.current ? scoreTextRef.current.text : "Red: 0   Blue: 0",
        {
          fontSize: "24px",
          fill: "#ffffff",
          fontFamily: "sans-serif",
        },
      );
      scoreTextRef.current = scoreText;

      const triggerGameOver = () =>
        ws.current?.send(JSON.stringify({ type: "game_over" }));
      this.physics.add.collider(player, lava, () => triggerGameOver());
      this.physics.add.collider(player, fire, () => {
        if (myColor.current !== 0xff0000) triggerGameOver();
      });
      this.physics.add.collider(player, water, () => {
        if (myColor.current !== 0x00aaff) triggerGameOver();
      });
      this.physics.add.collider(player, platforms);

      // --- NEW: THE SCORE LOCK FIX ---
      this.physics.add.overlap(player, redGems, (p, gem: any) => {
        if (myColor.current === 0xff0000 && !gem.getData("collected")) {
          gem.setData("collected", true); // Lock it so it only counts ONCE!
          const barcode = gem.name;
          gem.destroy();
          ws.current?.send(
            JSON.stringify({ type: "collect", color: "red", gemId: barcode }),
          );
        }
      });

      this.physics.add.overlap(player, blueGems, (p, gem: any) => {
        if (myColor.current === 0x00aaff && !gem.getData("collected")) {
          gem.setData("collected", true); // Lock it so it only counts ONCE!
          const barcode = gem.name;
          gem.destroy();
          ws.current?.send(
            JSON.stringify({ type: "collect", color: "blue", gemId: barcode }),
          );
        }
      });

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

      const targetDoor = myColor.current === 0xff0000 ? redDoor : blueDoor;
      if (targetDoor) {
        const isTouching = Phaser.Geom.Intersects.RectangleToRectangle(
          player.getBounds(),
          targetDoor.getBounds(),
        );
        if (isTouching !== amIAtDoor.current) {
          amIAtDoor.current = isTouching;
          const colorStr = myColor.current === 0xff0000 ? "red" : "blue";
          ws.current?.send(
            JSON.stringify({
              type: "door_status",
              color: colorStr,
              ready: isTouching,
            }),
          );
        }
      }

      if (ws.current?.readyState === WebSocket.OPEN) {
        ws.current.send(JSON.stringify({ x: player.x, y: player.y }));
      }

      Object.keys(networkPlayers.current).forEach((id) => {
        if (!otherPlayerSprites[id]) {
          const enemyColor = myColor.current === 0xff0000 ? 0x00aaff : 0xff0000;
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
        <h1>Multiplayer Platformer - Level {currentLevel.current}</h1>
        <p
          style={{
            color: connected ? "#4ade80" : "#f87171",
            textAlign: "center",
          }}
        >
          Player ID: {clientId} | {connected ? "Connected" : "Disconnected"}
        </p>
      </div>

      {/* Wrapper to hold the Game Canvas and Modal together */}
      <div style={{ position: "relative" }}>
        {/* The Phaser Game Engine */}
        <div
          ref={gameRef}
          style={{
            border: "4px solid #333",
            borderRadius: "8px",
            overflow: "hidden",
          }}
        />

        {/* The HTML Level Complete Modal */}
        {showModal && (
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: "100%",
              height: "100%",
              backgroundColor: "rgba(0, 0, 0, 0.8)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 10,
              borderRadius: "8px",
            }}
          >
            <h1
              style={{
                color: "#ffff00",
                fontSize: "48px",
                marginBottom: "10px",
                textShadow: "2px 2px 0 #000",
              }}
            >
              LEVEL COMPLETE!
            </h1>
            <p style={{ fontSize: "24px", marginBottom: "30px" }}>
              Great teamwork.
            </p>

            <div style={{ display: "flex", gap: "20px" }}>
              <button
                onClick={() =>
                  ws.current?.send(JSON.stringify({ type: "request_retry" }))
                }
                style={{
                  padding: "15px 30px",
                  fontSize: "20px",
                  cursor: "pointer",
                  backgroundColor: "#f87171",
                  border: "none",
                  borderRadius: "8px",
                  color: "white",
                  fontWeight: "bold",
                }}
              >
                Retry Level
              </button>

              {currentLevel.current === 1 && (
                <button
                  onClick={() =>
                    ws.current?.send(
                      JSON.stringify({ type: "request_next_level" }),
                    )
                  }
                  style={{
                    padding: "15px 30px",
                    fontSize: "20px",
                    cursor: "pointer",
                    backgroundColor: "#4ade80",
                    border: "none",
                    borderRadius: "8px",
                    color: "black",
                    fontWeight: "bold",
                  }}
                >
                  Next Level
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
