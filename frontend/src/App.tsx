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
  const scoreTextRef = useRef<Phaser.GameObjects.Text | null>(null);
  const gemsRef = useRef<Record<string, any>>({});

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
          if (playerSpriteRef.current) {
            playerSpriteRef.current.setTint(myColor.current);
          }
        } else if (data.type === "move") {
          if (data.position && data.position.x !== undefined) {
            networkPlayers.current[data.id] = data.position;
          }
        } else if (data.type === "score") {
          // updating player scores
          if (scoreTextRef.current) {
            scoreTextRef.current.setText(
              `Red: ${data.red}   Blue: ${data.blue}`,
            );
          }
        } else if (data.type === "collect") {
          // hiding gem
          console.log("Server says someone ate gem:", data.gemId);

          const gemToHide = gemsRef.current[data.gemId];
          if (gemToHide) {
            gemToHide.destroy();
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
      this.load.spritesheet("dude", "dude.png", {
        frameWidth: 32,
        frameHeight: 48,
      });
      this.load.image("ground", "platform.png");
      this.load.image("gem", "star.png");
    }

    function create(this: Phaser.Scene) {
      // Spawn the Sprite instead of a Rectangle
      player = this.physics.add.sprite(400, 300, "dude");
      player.setTint(myColor.current);
      player.body.setCollideWorldBounds(true);
      playerSpriteRef.current = player;

      // 1. Create a "Static Group" (Objects that have physics but never move or fall)
      const platforms = this.physics.add.staticGroup();
      platforms.create(150, 568, "ground");
      platforms.create(650, 568, "ground");

      // 3. Build some floating ledges! (x, y, 'image_key')
      platforms.create(600, 400, "ground");
      platforms.create(50, 250, "ground");
      platforms.create(750, 220, "ground");

      // --- THE SCORES AND DIAMONDS ---

      // 1. The Scoreboard (Drawn directly onto the canvas)
      let redScore = 0;
      let blueScore = 0;
      const scoreText = this.add.text(16, 16, "Red: 0   Blue: 0", {
        fontSize: "24px",
        fill: "#ffffff",
        fontFamily: "sans-serif",
      });
      scoreTextRef.current = scoreText;

      // red Diamonds
      const redGems = this.physics.add.staticGroup();
      const r1 = redGems.create(200, 520, "gem").setTint(0xff0000);
      r1.name = "red_1";
      gemsRef.current[r1.name] = r1; // save it to the directory

      const r2 = redGems.create(50, 200, "gem").setTint(0xff0000);
      r2.name = "red_2";
      gemsRef.current[r2.name] = r2; // save it to the directory
      // blue Diamonds
      const blueGems = this.physics.add.staticGroup();
      const b1 = blueGems.create(700, 520, "gem").setTint(0x00aaff);
      b1.name = "blue_1";
      gemsRef.current[b1.name] = b1; // save it to the directory

      const b2 = blueGems.create(750, 170, "gem").setTint(0x00aaff);
      b2.name = "blue_2";
      gemsRef.current[b2.name] = b2; // save it to the directory
      const lava = this.physics.add.staticGroup();
      const water = this.physics.add.staticGroup();
      const fire = this.physics.add.staticGroup();

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

      // The Respawn execution
      const die = () => {
        player.setPosition(400, 100);
        player.setVelocity(0, 0);
      };

      // 4. The Rules
      // We use COLLIDER so they act as solid ground, but we attach the death rule to it!
      this.physics.add.collider(player, lava, () => {
        die(); // both characters die on lava
      });
      this.physics.add.collider(player, fire, () => {
        if (myColor.current !== 0xff0000) die(); // Blue dies on Red!
      });
      this.physics.add.collider(player, water, () => {
        if (myColor.current !== 0x00aaff) die(); // Red dies on Blue!
      });

      // --- COLLECTION RULES ---

      // Red collects Red
      // Red collects Red
      this.physics.add.overlap(player, redGems, (p, gem: any) => {
        if (myColor.current === 0xff0000) {
          const barcode = gem.name; // 1. READ THE BARCODE FIRST!
          gem.destroy(); // 2. Permanently delete the gem locally

          // 3. Send the safely stored barcode to the server!
          ws.current?.send(
            JSON.stringify({ type: "collect", color: "red", gemId: barcode }),
          );
        }
      });

      // Blue collects Blue
      this.physics.add.overlap(player, blueGems, (p, gem: any) => {
        if (myColor.current === 0x00aaff) {
          const barcode = gem.name; // 1. READ THE BARCODE FIRST!
          gem.destroy(); // 2. Permanently delete the gem locally

          // 3. Send the safely stored barcode to the server!
          ws.current?.send(
            JSON.stringify({ type: "collect", color: "blue", gemId: barcode }),
          );
        }
      });

      // 4. Tell the physics engine that the player is allowed to stand on the platforms
      this.physics.add.collider(player, platforms);

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

      // Water Death Rules
      this.physics.add.overlap(player, water, () => {
        // If my color is NOT blue, I die!
        if (myColor.current !== 0x00aaff) {
          die();
        }
      });
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
