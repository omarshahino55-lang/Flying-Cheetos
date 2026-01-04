var ctx = myCanvas.getContext('2d');
var FPS = 40;

// --- CONFIGURATION ---
const CANVAS_WIDTH = 640; 
myCanvas.width = CANVAS_WIDTH; 

// --- STATE MANAGEMENT ---
var game_mode = 'waiting_for_website'; 

function startGame() {
    document.getElementById('landing-page').style.display = 'none';
    game_mode = 'prestart'; 
}

// --- BASE PHYSICS ---
var jump_amount = -10;
var max_fall_speed = +10;
var acceleration = 1;

// --- SUPERPOWER PHYSICS ---
const SUPER_JUMP_AMOUNT = -6; 
const SUPER_ACCELERATION = 0.5; 
const SUPER_MAX_FALL_SPEED = +7; 

// --- MECHANICS CONFIG ---
const MAGNET_RADIUS = 100; 
const INITIAL_LIVES = 3; 
let currentLives = 0; 
const MAX_DESTROY_CHARGES = 2;
let wallDestroyCharges = 0;
const WALLS_TO_DESTROY = 2; 

var pipe_speed = -2;
var time_game_last_running;
var bottom_bar_offset = 0;
var pipes = [];
var pipe_spawn_timer = 0;
const PIPE_SPAWN_INTERVAL_MS = 2500; 
let currentScore = 0; 

// --- SOUNDS ---
const flapSound = new Audio('woof.mp3');
flapSound.load(); 
flapSound.volume = 0.25; 

// --- SHIELD ---
const SHIELD_DURATION_MS = 6000;
const SHIELD_SPAWN_CHANCE = 0.10; 
let isShieldActive = false;
let shieldTimeoutID = null;
let shields = []; 
const SHIELD_IMG = new Image(); SHIELD_IMG.src = 'shield.png'; 
const SHIELD_WIDTH = 64; const SHIELD_HEIGHT = 64;
const SHIELDED_BIRD_IMG = new Image(); SHIELDED_BIRD_IMG.src = 'player_shielded.png'; 

// --- POTION (X2 STARS) ---
const POTION_DURATION_MS = 15000; 
const POTION_SPAWN_CHANCE = 0.10; 
let isDoubleStarsActive = false;
let potionTimeoutID = null;
let potions = [];
const POTION_IMG = new Image(); POTION_IMG.src = 'potion.png';
const POTION_WIDTH = 30; const POTION_HEIGHT = 30;

// --- STARS & GOLDEN PIPES ---
let collectedStars = 0;
let stars = []; 
const STAR_IMG = new Image(); STAR_IMG.src = 'star.png'; 
const STAR_WIDTH = 20; const STAR_HEIGHT = 20;
const STAR_VALUE = 1; 
const STAR_SPAWN_CHANCE = 0.5; 
const GOLDEN_PIPE_CHANCE = 0.02; // 2% chance

// --- SKINS ---
const SKINS = {
    'default': { src: 'player.png', cost: 0, current: true, name: 'Original Cheetos' }, 
    'red': { src: 'player_red.png', cost: 30, current: false, name: 'Cute Cheetos' },
    'tough': { src: 'player_tough.png', cost: 120, current: false, name: 'Tough Cheetos' }, 
    'rich': { src: 'player_rich.png', cost: 150, current: false, name: 'Rich Cheetos' }, 
    'happy': { src: 'player_happy.png', cost: 100, current: false, name: 'Happy Cheetos' }, 
    'yellow': { src: 'player_yellow.png', cost: 300, current: false, name: 'Terrorist Cheetos' }, 
    'black': { src: 'player_black.png', cost: 1500, current: false, name: 'Legendary Cheetos' } 
};

// --- DATA PERSISTENCE ---
if (localStorage.getItem('flappyStars')) { collectedStars = parseInt(localStorage.getItem('flappyStars')); }
let availableSkins = JSON.parse(localStorage.getItem('flappySkins')) || ['default'];
let currentSkinKey = 'default';
if (localStorage.getItem('currentSkin')) {
    currentSkinKey = localStorage.getItem('currentSkin');
    for (const key in SKINS) { SKINS[key].current = false; }
    if (SKINS[currentSkinKey]) { SKINS[currentSkinKey].current = true; }
}

// --- SPRITE CLASS ---
function MySprite(img_url) {
  this.x = 0; this.y = 0;
  this.visible = true; 
  this.velocity_x = 0; this.velocity_y = 0;
  this.MyImg = new Image(); this.MyImg.src = img_url || '';
  this.angle = 0; this.flipV = false; this.flipH = false;
  this.passed = false; this.isGolden = false; 
}

MySprite.prototype.Do_Frame_Things = function () {
    if (!this.MyImg.complete || this.MyImg.naturalWidth === 0) return; 
    ctx.save();
    ctx.translate(this.x + this.MyImg.width / 2, this.y + this.MyImg.height / 2);
    ctx.rotate((this.angle * Math.PI) / 180);
    if (this.flipV) ctx.scale(1, -1);
    if (this.flipH) ctx.scale(-1, 1);
    
    // Power-up Visuals
    if (this === bird) {
        if (isShieldActive) {
            ctx.beginPath(); ctx.arc(0, 0, this.MyImg.width / 2 + 5, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'; ctx.fill();
        }
        if (isDoubleStarsActive) {
            ctx.beginPath(); ctx.arc(0, 0, this.MyImg.width / 2 + 8, 0, 2 * Math.PI);
            ctx.strokeStyle = 'purple'; ctx.lineWidth = 3; ctx.stroke();
        }
    }

    if (this.visible) ctx.drawImage(this.MyImg, -this.MyImg.width / 2, -this.MyImg.height / 2);
    this.x += this.velocity_x; this.y += this.velocity_y;
    ctx.restore();
};

function ImagesTouching(thing1, thing2) {
    if (!thing1.visible || !thing2.visible) return false; 
    if (thing1.x >= thing2.x + thing2.MyImg.width || thing1.x + thing1.MyImg.width <= thing2.x) return false;
    if (thing1.y >= thing2.y + thing2.MyImg.height || thing1.y + thing1.MyImg.height <= thing2.y) return false;
    return true;
}

// --- LOGIC FUNCTIONS ---
function purchaseOrEquipSkin(skinKey) {
    const skin = SKINS[skinKey];
    if (availableSkins.includes(skinKey)) {
        if (!skin.current) {
            for (let key in SKINS) { SKINS[key].current = false; }
            skin.current = true;
            bird.MyImg.src = skin.src; currentSkinKey = skinKey; 
            localStorage.setItem('currentSkin', skinKey);
            if (currentSkinKey === 'yellow' || currentSkinKey === 'black') { wallDestroyCharges = MAX_DESTROY_CHARGES; }
        }
    } else if (collectedStars >= skin.cost) {
        collectedStars -= skin.cost;
        availableSkins.push(skinKey);
        localStorage.setItem('flappyStars', collectedStars);
        localStorage.setItem('flappySkins', JSON.stringify(availableSkins));
        purchaseOrEquipSkin(skinKey); 
    }
}

function activateDoubleStars() {
    isDoubleStarsActive = true;
    if (potionTimeoutID) clearTimeout(potionTimeoutID);
    potionTimeoutID = setTimeout(() => { isDoubleStarsActive = false; }, POTION_DURATION_MS);
}

function useWallDestruction() {
    if (!(currentSkinKey === 'yellow' || currentSkinKey === 'black') || wallDestroyCharges <= 0) return false; 
    let destroyed = 0;
    for (let i = 0; i < pipes.length; i += 2) { 
        if (destroyed >= WALLS_TO_DESTROY) break; 
        if (pipes[i].x > bird.x && pipes[i].visible) {
            pipes[i].visible = false; if (pipes[i+1]) pipes[i+1].visible = false; 
            destroyed++;
        }
    }
    if (destroyed > 0) { wallDestroyCharges--; flapSound.play(); return true; }
    return false;
}

function Got_Player_Input(MyEvent) {
  switch (game_mode) {
    case 'prestart': game_mode = 'running'; break;
    case 'running':
        if (MyEvent.type === 'touchstart' || MyEvent.type === 'mousedown') {
            bird.velocity_y = (currentSkinKey === 'happy' || currentSkinKey === 'black') ? SUPER_JUMP_AMOUNT : jump_amount;
        }
        if (MyEvent.type === 'keydown') {
            if (MyEvent.keyCode === 83) game_mode = 'shop'; 
            if (MyEvent.keyCode === 68) useWallDestruction(); 
        }
        break;
    case 'shop':
        if (MyEvent.type === 'keydown') {
            if (MyEvent.keyCode === 69) { game_mode = 'running'; }
            else {
                const skinKeys = Object.keys(SKINS);
                const idx = MyEvent.keyCode - 49; 
                if (idx >= 0 && idx < skinKeys.length) purchaseOrEquipSkin(skinKeys[idx]);
            }
        }
        break;
    case 'over':
      if (new Date() - time_game_last_running > 1000) { reset_game(); game_mode = 'running'; }
      break;
  }
}

function add_pipe(x_pos, top_of_gap, gap_width) {
  let isGolden = Math.random() < GOLDEN_PIPE_CHANCE;
  
  var top_p = new MySprite(); top_p.MyImg = pipe_piece; top_p.x = x_pos;
  top_p.y = top_of_gap - pipe_piece.height; top_p.velocity_x = pipe_speed;
  top_p.isGolden = isGolden; pipes.push(top_p);

  var bot_p = new MySprite(); bot_p.MyImg = pipe_piece; bot_p.flipV = true; bot_p.x = x_pos;
  bot_p.y = top_of_gap + gap_width; bot_p.velocity_x = pipe_speed;
  bot_p.isGolden = isGolden; pipes.push(bot_p);

  if (!isGolden) {
      let rand = Math.random();
      if (rand < SHIELD_SPAWN_CHANCE) {
          let s = new MySprite(); s.MyImg = SHIELD_IMG; s.x = x_pos + 20; 
          s.y = top_of_gap + (gap_width/2) - 32; s.velocity_x = pipe_speed; shields.push(s); 
      } else if (rand < SHIELD_SPAWN_CHANCE + POTION_SPAWN_CHANCE) {
          let p = new MySprite(); p.MyImg = POTION_IMG; p.x = x_pos + 20;
          p.y = top_of_gap + (gap_width/2) - 15; p.velocity_x = pipe_speed; potions.push(p);
      }
      if (Math.random() < STAR_SPAWN_CHANCE) { 
          let st = new MySprite(); st.MyImg = STAR_IMG; st.x = x_pos + 20;
          st.y = top_of_gap + (gap_width * 0.75); st.velocity_x = pipe_speed; stars.push(st); 
      }
  }
}

function check_for_collisions() {
    // Pipe Collisions
    for (var i = 0; i < pipes.length; i++) {
        if (ImagesTouching(bird, pipes[i])) {
            if (isShieldActive) { deactivateShield(); pipes[i].visible = false; continue; }
            if ((currentSkinKey === 'tough' || currentSkinKey === 'black') && currentLives > 0) {
                currentLives--; pipes[i].visible = false; return;
            }
            game_mode = 'over'; return;
        }
    }
    // Star Collection
    for (let i = stars.length - 1; i >= 0; i--) {
        let collected = false;
        if (currentSkinKey === 'rich' || currentSkinKey === 'black') {
            let dx = (bird.x + 25) - (stars[i].x + 10); let dy = (bird.y + 25) - (stars[i].y + 10);
            if (Math.sqrt(dx*dx + dy*dy) < MAGNET_RADIUS) collected = true;
        }
        if (ImagesTouching(bird, stars[i])) collected = true;
        if (collected) {
            collectedStars += (isDoubleStarsActive ? 2 : 1);
            localStorage.setItem('flappyStars', collectedStars);
            stars.splice(i, 1); flapSound.play();
        }
    }
    // Potion/Shield Collection
    for (let i = potions.length - 1; i >= 0; i--) {
        if (ImagesTouching(bird, potions[i])) { activateDoubleStars(); potions.splice(i, 1); flapSound.play(); }
    }
    for (let i = shields.length - 1; i >= 0; i--) {
        if (ImagesTouching(bird, shields[i])) { activateShield(); shields.splice(i, 1); flapSound.play(); }
    }
}

function check_for_score() {
    for (var i = 0; i < pipes.length; i += 2) {
        if (pipes[i].x + 50 < bird.x && !pipes[i].passed) {
            currentScore++;
            if (pipes[i].isGolden) { 
                collectedStars += 5; 
                localStorage.setItem('flappyStars', collectedStars);
                flapSound.play();
            }
            pipes[i].passed = true;
        }
    }
}

function activateShield() {
    isShieldActive = true; if (shieldTimeoutID) clearTimeout(shieldTimeoutID);
    shieldTimeoutID = setTimeout(deactivateShield, SHIELD_DURATION_MS);
    bird.MyImg.src = SHIELDED_BIRD_IMG.src;
}

function deactivateShield() {
    isShieldActive = false; bird.MyImg.src = SKINS[currentSkinKey].src;
}

function reset_game() {
  bird.y = myCanvas.height / 2; bird.velocity_y = 0;
  pipes = []; stars = []; shields = []; potions = []; currentScore = 0; pipe_spawn_timer = 0;
  isDoubleStarsActive = false; if (potionTimeoutID) clearTimeout(potionTimeoutID);
  currentLives = (currentSkinKey === 'tough' || currentSkinKey === 'black') ? INITIAL_LIVES : 0; 
  wallDestroyCharges = (currentSkinKey === 'yellow' || currentSkinKey === 'black') ? MAX_DESTROY_CHARGES : 0;
  add_pipe(CANVAS_WIDTH, 100, 140); deactivateShield(); 
}

function Do_a_Frame() {
  if (game_mode === 'waiting_for_website') return; 
  if (game_mode === 'shop') { display_shop(); return; }
  
  ctx.clearRect(0, 0, myCanvas.width, myCanvas.height);
  
  if (game_mode === 'running' || game_mode === 'over') {
      // Draw Pipes with Gold Effect
      for (var i = 0; i < pipes.length; i++) {
          if (pipes[i].isGolden && pipes[i].visible) {
              ctx.shadowBlur = 15; ctx.shadowColor = "gold";
              ctx.fillStyle = "rgba(255, 215, 0, 0.2)";
              ctx.fillRect(pipes[i].x-5, pipes[i].y, 60, pipes[i].MyImg.height);
          }
          pipes[i].Do_Frame_Things();
          ctx.shadowBlur = 0; // reset
      }
      [shields, stars, potions].forEach(arr => arr.forEach(item => item.Do_Frame_Things()));
      bird.Do_Frame_Things();
  }

  if (game_mode === 'running') {
      time_game_last_running = new Date();
      bottom_bar_offset += pipe_speed;
      if (bottom_bar_offset < -23) bottom_bar_offset = 0;
      ctx.drawImage(bottom_bar, bottom_bar_offset, myCanvas.height - bottom_bar.height);

      if (bird.velocity_y < 10) bird.velocity_y += (currentSkinKey === 'happy' || currentSkinKey === 'black' ? 0.5 : 1);
      bird.y += bird.velocity_y;
      if (bird.y > myCanvas.height - 50 || bird.y < -50) game_mode = 'over';

      check_for_collisions(); check_for_score();

      pipe_spawn_timer += 1000/FPS;
      if (pipe_spawn_timer > PIPE_SPAWN_INTERVAL_MS) {
          add_pipe(CANVAS_WIDTH, Math.random()*(myCanvas.height-300)+50, 140);
          pipe_spawn_timer = 0;
      }
      
      // Cleanup
      pipes = pipes.filter(p => p.x > -100);
      stars = stars.filter(s => s.x > -100);
      potions = potions.filter(p => p.x > -100);
      shields = shields.filter(s => s.x > -100);

      // UI
      ctx.font = '20px Arial'; ctx.fillStyle = 'yellow'; ctx.fillText('Stars: ' + collectedStars, 10, 30);
      ctx.fillStyle = 'black'; ctx.fillText('Score: ' + currentScore, 10, 60);
      if (isDoubleStarsActive) { ctx.fillStyle = 'purple'; ctx.fillText('X2 ACTIVE', 10, 90); }
  } else if (game_mode === 'prestart') {
      ctx.textAlign = 'center'; ctx.fillText('Click to Start', CANVAS_WIDTH/2, 200);
  } else if (game_mode === 'over') {
      ctx.textAlign = 'center'; ctx.fillText('GAME OVER', CANVAS_WIDTH/2, 200);
  }
}

function display_shop() {
    ctx.clearRect(0, 0, myCanvas.width, myCanvas.height);
    ctx.textAlign = 'center'; ctx.fillStyle = 'black'; ctx.font = '30px Arial';
    ctx.fillText('SHOP - Stars: ' + collectedStars, CANVAS_WIDTH/2, 50);
    let y = 120;
    Object.keys(SKINS).forEach((k, i) => {
        ctx.fillStyle = availableSkins.includes(k) ? 'green' : (collectedStars >= SKINS[k].cost ? 'blue' : 'red');
        ctx.fillText(`${i+1}. ${SKINS[k].name} (${SKINS[k].cost})`, CANVAS_WIDTH/2, y);
        y += 40;
    });
    ctx.font = '15px Arial'; ctx.fillText('Press E to Exit', CANVAS_WIDTH/2, y + 20);
}

// --- INIT ---
var bottom_bar = new Image(); bottom_bar.src = 'red.png';
var pipe_piece = new Image(); pipe_piece.onload = reset_game; pipe_piece.src = 'wall.png';
var bird = new MySprite(SKINS[currentSkinKey].src); bird.x = 100;

addEventListener('touchstart', Got_Player_Input);
addEventListener('mousedown', Got_Player_Input);
addEventListener('keydown', Got_Player_Input);
setInterval(Do_a_Frame, 1000/FPS);
