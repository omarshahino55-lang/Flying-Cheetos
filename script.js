var ctx = myCanvas.getContext('2d');
var FPS = 40;

// --- CONFIGURATION ---
const CANVAS_WIDTH = 640; 
myCanvas.width = CANVAS_WIDTH; 

// --- NEW STATE FOR WEBSITE ---
var game_mode = 'waiting_for_website'; 

// --- FLASH EFFECT VARIABLES ---
let flashColor = null;
let flashTimer = 0;
let levelReached = 1; // Track levels to trigger flash only once

function triggerFlash(color) {
    flashColor = color;
    flashTimer = 10; // Flash stays for 10 frames
}

function startGame() {
    document.getElementById('landing-page').style.display = 'none';
    game_mode = 'prestart'; 
}

// --- BASE PHYSICS ---
var jump_amount = -7;      
var max_fall_speed = +8;   
var acceleration = 0.6;    

// --- SUPERPOWER PHYSICS ---
const SUPER_JUMP_AMOUNT = -4.5; 
const SUPER_ACCELERATION = 0.25;     
const SUPER_MAX_FALL_SPEED = +4;     

// --- SUPERPOWER STAR MAGNET ---
const MAGNET_RADIUS = 100; 

// --- SUPERPOWER TOUGH CHEETOS ---
const INITIAL_LIVES = 3; 
let currentLives = 0; 

// --- SUPERPOWER BOMB CHEETOS ---
const MAX_DESTROY_CHARGES = 2;
let wallDestroyCharges = 0;
const WALLS_TO_DESTROY = 2; 

var pipe_speed = -2;
var time_game_last_running;
var bottom_bar_offset = 0;
var pipes = [];

// --- PROCEDURAL GENERATION ---
var pipe_spawn_timer = 0;
const PIPE_SPAWN_INTERVAL_MS = 2500; 

// --- SCORE VARIABLE ---
let currentScore = 0; 

// --- SOUND INTEGRATION ---
const flapSound = new Audio('woof.mp3');
flapSound.load(); 
flapSound.volume = 0.25; 

// --- SHIELD MECHANISM ---
const SHIELD_DURATION_MS = 6000;
const SHIELD_SPAWN_CHANCE = 0.10; 
let isShieldActive = false;
let shieldTimeoutID = null;
let shields = []; 

const SHIELD_IMG = new Image();
SHIELD_IMG.src = 'shield.png'; 
const SHIELD_WIDTH = 64; 
const SHIELD_HEIGHT = 64; 

const SHIELDED_BIRD_IMG = new Image();
SHIELDED_BIRD_IMG.src = 'player_shielded.png'; 

// --- POTION MECHANISM ---
const POTION_DURATION_MS = 15000; 
const POTION_SPAWN_CHANCE = 0.10; 
let isDoubleStarsActive = false;
let potionTimeoutID = null;
let potions = [];

const POTION_IMG = new Image();
POTION_IMG.src = 'potion.png';
const POTION_WIDTH = 30;
const POTION_HEIGHT = 30;

// --- STAR/SHOP MECHANISM ---
let collectedStars = 0;
let stars = []; 

const STAR_IMG = new Image();
STAR_IMG.src = 'star.png'; 
const STAR_WIDTH = 20;
const STAR_HEIGHT = 20;
const STAR_VALUE = 1; 
const STAR_SPAWN_CHANCE = 0.5; 

const SKINS = {
    'default': { src: 'player.png', cost: 0, current: true, name: 'Original Cheetos' }, 
    'red':     { src: 'player_red.png', cost: 30, current: false, name: 'Cute Cheetos' },
    'tough':   { src: 'player_tough.png', cost: 150, current: false, name: 'Tough Cheetos' }, 
    'rich':    { src: 'player_rich.png', cost: 150, current: false, name: 'Rich Cheetos' }, 
    'happy':   { src: 'player_happy.png', cost: 250, current: false, name: 'Happy Cheetos' }, 
    'yellow':  { src: 'player_yellow.png', cost: 300, current: false, name: 'Terrorist Cheetos' }, 
    'black':   { src: 'player_black.png', cost: 650, current: false, name: 'Legendary Cheetos' } 
};

// Initialize Data
if (localStorage.getItem('flappyStars')) {
    collectedStars = parseInt(localStorage.getItem('flappyStars'));
}
let availableSkins = JSON.parse(localStorage.getItem('flappySkins')) || ['default'];
let currentSkinKey = 'default';
if (localStorage.getItem('currentSkin')) {
    currentSkinKey = localStorage.getItem('currentSkin');
    for (const key in SKINS) { SKINS[key].current = false; }
    if (SKINS[currentSkinKey]) { SKINS[currentSkinKey].current = true; }
}

function MySprite(img_url) {
  this.x = 0;
  this.y = 0;
  this.visible = true; 
  this.velocity_x = 0;
  this.velocity_y = 0;
  this.MyImg = new Image();
  this.MyImg.src = img_url || '';
  this.angle = 0;
  this.flipV = false;
  this.flipH = false;
  this.passed = false; 
}

MySprite.prototype.Do_Frame_Things = function () {
    if (!this.MyImg.complete || this.MyImg.naturalWidth === 0) return; 
    ctx.save();
    ctx.translate(this.x + this.MyImg.width / 2, this.y + this.MyImg.height / 2);
    ctx.rotate((this.angle * Math.PI) / 180);
    if (this.flipV) ctx.scale(1, -1);
    if (this.flipH) ctx.scale(-1, 1);
    
    if (isShieldActive && this === bird) {
        ctx.beginPath();
        ctx.arc(0, 0, this.MyImg.width / 2 + 5, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(0, 255, 255, 0.5)'; 
        ctx.fill();
        ctx.closePath();
    }
    
    if (isDoubleStarsActive && this === bird) {
        ctx.beginPath();
        ctx.arc(0, 0, this.MyImg.width / 2 + 8, 0, 2 * Math.PI);
        ctx.fillStyle = 'rgba(128, 0, 128, 0.4)';
        ctx.fill();
        ctx.closePath();
    }

    if (this.visible) ctx.drawImage(this.MyImg, -this.MyImg.width / 2, -this.MyImg.height / 2);
    this.x = this.x + this.velocity_x;
    this.y = this.y + this.velocity_y;
    ctx.restore();
};

function ImagesTouching(thing1, thing2) {
    if (!thing1.visible || !thing2.visible) return false; 
    if (!thing1.MyImg.complete || !thing2.MyImg.complete) return false;
    if (thing1.x >= thing2.x + thing2.MyImg.width || thing1.x + thing1.MyImg.width <= thing2.x) return false;
    if (thing1.y >= thing2.y + thing2.MyImg.height || thing1.y + thing1.MyImg.height <= thing2.y) return false;
    return true;
}

function purchaseOrEquipSkin(skinKey) {
    const skin = SKINS[skinKey];
    if (availableSkins.includes(skinKey)) {
        if (!skin.current) {
            for (let key in SKINS) { SKINS[key].current = false; }
            skin.current = true;
            let tempImg = new Image();
            tempImg.onload = function() { bird.MyImg = tempImg; };
            tempImg.src = skin.src; 
            currentSkinKey = skinKey; 
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

function playPowerUpSound() {
    flapSound.currentTime = 0; 
    flapSound.play().catch(e => console.warn("Audio play failed:", e));
}

function activateDoubleStars() {
    isDoubleStarsActive = true;
    if (potionTimeoutID) clearTimeout(potionTimeoutID);
    potionTimeoutID = setTimeout(() => {
        isDoubleStarsActive = false;
        potionTimeoutID = null;
    }, POTION_DURATION_MS);
}

function useWallDestruction() {
    if (!(currentSkinKey === 'yellow' || currentSkinKey === 'black') || wallDestroyCharges <= 0) return false; 
    let destroyedSets = 0;
    for (let i = 0; i < pipes.length; i += 2) { 
        if (destroyedSets >= WALLS_TO_DESTROY) break; 
        if (pipes[i].x > bird.x + bird.MyImg.width && pipes[i].visible) {
            pipes[i].visible = false;
            if (pipes[i+1]) pipes[i+1].visible = false; 
            destroyedSets++;
        }
    }
    if (destroyedSets > 0) {
        wallDestroyCharges--;
        playPowerUpSound(); 
        return true;
    }
    return false;
}

function Got_Player_Input(MyEvent) {
  switch (game_mode) {
    case 'prestart': game_mode = 'running'; break;
    case 'running':
        if (MyEvent.type === 'touchstart' || MyEvent.type === 'mousedown') {
            let current_jump = (currentSkinKey === 'happy' || currentSkinKey === 'black') ? SUPER_JUMP_AMOUNT : jump_amount;
            bird.velocity_y = current_jump;
        }
        if (MyEvent.type === 'keydown' && MyEvent.keyCode === 83) { game_mode = 'shop'; }
        if (MyEvent.type === 'keydown' && MyEvent.keyCode === 68) { useWallDestruction(); }
        break;
    case 'shop':
        if (MyEvent.type === 'keydown' && MyEvent.keyCode === 69) { game_mode = 'running'; break; }
        if (MyEvent.type === 'keydown') {
            const skinKeys = Object.keys(SKINS);
            const skinIndex = MyEvent.keyCode - 49; 
            if (skinIndex >= 0 && skinIndex < skinKeys.length) { purchaseOrEquipSkin(skinKeys[skinIndex]); }
        }
        break;
    case 'over':
      if (new Date() - time_game_last_running > 1000) {
        reset_game();
        game_mode = 'running';
      }
      break;
  }
  if (MyEvent.cancelable) MyEvent.preventDefault();
}

addEventListener('touchstart', Got_Player_Input);
addEventListener('mousedown', Got_Player_Input);
addEventListener('keydown', Got_Player_Input); 

function make_bird_slow_and_fall() {
    // Dynamic Difficulty Scaling
    let dynamic_accel = acceleration;
    let dynamic_max = max_fall_speed;
    
    if (currentScore > 50) {
        if(levelReached < 3) { triggerFlash("rgba(255, 0, 0, 0.4)"); levelReached = 3; }
        dynamic_accel = 1.0; 
        dynamic_max = 11;
    } else if (currentScore > 15) {
        if(levelReached < 2) { triggerFlash("rgba(255, 0, 0, 0.3)"); levelReached = 2; }
        dynamic_accel = 0.8;
        dynamic_max = 9;
    }

    // Apply special skin multiplier if needed
    let final_accel = (currentSkinKey === 'happy' || currentSkinKey === 'black') ? SUPER_ACCELERATION : dynamic_accel;
    let final_max = (currentSkinKey === 'happy' || currentSkinKey === 'black') ? SUPER_MAX_FALL_SPEED : dynamic_max;
    
    if (bird.velocity_y < final_max) { bird.velocity_y += final_accel; }
    if (bird.y > myCanvas.height - bird.MyImg.height || bird.y < 0 - bird.MyImg.height) {
        bird.velocity_y = 0;
        game_mode = 'over';
    }
}

function add_pipe(x_pos, top_of_gap, gap_width) {
  var top_pipe = new MySprite();
  top_pipe.MyImg = pipe_piece;
  top_pipe.x = x_pos;
  top_pipe.y = top_of_gap - pipe_piece.height;
  top_pipe.velocity_x = pipe_speed;
  pipes.push(top_pipe);

  var bottom_pipe = new MySprite();
  bottom_pipe.MyImg = pipe_piece;
  bottom_pipe.flipV = true;
  bottom_pipe.x = x_pos;
  bottom_pipe.y = top_of_gap + gap_width;
  bottom_pipe.velocity_x = pipe_speed;
  pipes.push(bottom_pipe);

  let rand = Math.random();
  if (rand < SHIELD_SPAWN_CHANCE) {
      let newShield = new MySprite(); 
      newShield.MyImg = SHIELD_IMG;
      newShield.x = x_pos + (pipe_piece.width / 2) - (SHIELD_WIDTH / 2); 
      newShield.y = top_of_gap + (gap_width / 2) - (SHIELD_HEIGHT / 2); 
      newShield.velocity_x = pipe_speed; 
      shields.push(newShield); 
  } else if (rand < SHIELD_SPAWN_CHANCE + POTION_SPAWN_CHANCE) {
      let newPotion = new MySprite();
      newPotion.MyImg = POTION_IMG;
      newPotion.x = x_pos + (pipe_piece.width / 2) - (POTION_WIDTH / 2);
      newPotion.y = top_of_gap + (gap_width / 2) - (POTION_HEIGHT / 2);
      newPotion.velocity_x = pipe_speed;
      potions.push(newPotion);
  }

  if (Math.random() < STAR_SPAWN_CHANCE) { 
      let newStar = new MySprite(); 
      newStar.MyImg = STAR_IMG;
      newStar.x = x_pos + (pipe_piece.width / 2) - (STAR_WIDTH / 2);
      newStar.y = top_of_gap + (gap_width * 0.75) - (STAR_HEIGHT / 2); 
      newStar.velocity_x = pipe_speed; 
      stars.push(newStar); 
  }
}

function activateShield() {
    isShieldActive = true;
    if (shieldTimeoutID) clearTimeout(shieldTimeoutID);
    shieldTimeoutID = setTimeout(() => {
        deactivateShield();
    }, SHIELD_DURATION_MS);
    bird.MyImg.src = SHIELDED_BIRD_IMG.src;
}

function deactivateShield() {
    isShieldActive = false;
    if (shieldTimeoutID) { clearTimeout(shieldTimeoutID); shieldTimeoutID = null; }
    let tempImg = new Image();
    tempImg.onload = function() { bird.MyImg = tempImg; };
    tempImg.src = SKINS[currentSkinKey].src;
}

function check_for_end_game() {
  for (var i = 0; i < pipes.length; i++) {
      if (ImagesTouching(bird, pipes[i])) {
            if (isShieldActive) {
                deactivateShield();
                pipes[i].visible = false; 
                continue; 
            } else {
                if ((currentSkinKey === 'tough' || currentSkinKey === 'black') && currentLives > 0) { 
                    currentLives--; 
                    pipes[i].visible = false; 
                    return; 
                }
                game_mode = 'over'; 
                return; 
            }
        }
    }
    
    const birdCenterX = bird.x + bird.MyImg.width / 2;
    const birdCenterY = bird.y + bird.MyImg.height / 2;

    for (let i = stars.length - 1; i >= 0; i--) {
        const star = stars[i];
        let collected = false;
        if (currentSkinKey === 'rich' || currentSkinKey === 'black') {
            const dx = birdCenterX - (star.x + STAR_WIDTH / 2);
            const dy = birdCenterY - (star.y + STAR_HEIGHT / 2);
            if (Math.sqrt(dx * dx + dy * dy) < MAGNET_RADIUS) collected = true;
        }
        if (ImagesTouching(bird, star)) collected = true;

        if (collected) {
            let value = isDoubleStarsActive ? STAR_VALUE * 2 : STAR_VALUE;
            collectedStars += value;
            localStorage.setItem('flappyStars', collectedStars);
            stars.splice(i, 1);
            playPowerUpSound();
        }
    }

    for (let i = potions.length - 1; i >= 0; i--) {
        if (ImagesTouching(bird, potions[i])) {
            activateDoubleStars();
            potions.splice(i, 1);
            playPowerUpSound();
        }
    }

    for (let i = shields.length - 1; i >= 0; i--) {
        if (ImagesTouching(bird, shields[i])) {
            activateShield();
            shields.splice(i, 1); 
            playPowerUpSound();
        }
    }
}

function check_for_score_increase() {
    for (var i = 0; i < pipes.length; i += 2) {
        const topPipe = pipes[i];
        if (topPipe.x + topPipe.MyImg.width < bird.x && topPipe.passed === false) {
            currentScore++;
            topPipe.passed = true; 
            if (pipes[i+1]) pipes[i+1].passed = true;
        }
    }
}

function display_star_count() {
    ctx.font = '20px Arial'; ctx.fillStyle = 'yellow'; ctx.textAlign = 'left';
    ctx.fillText('Stars: ' + collectedStars, 10, 30);
    if (isDoubleStarsActive) {
        ctx.fillStyle = '#ff00ff';
        ctx.fillText('X2 ACTIVE!', 120, 30);
    }
}

function display_score() {
    ctx.font = '20px Arial'; ctx.fillStyle = 'black'; ctx.textAlign = 'left';
    ctx.fillText('Score: ' + currentScore, 10, 60); 
}

function display_lives() {
    let y = 90;
    if ((currentSkinKey === 'tough' || currentSkinKey === 'black') && currentLives > 0) {
        ctx.font = '20px Arial'; ctx.fillStyle = 'red';
        ctx.fillText('Lives: ' + currentLives, 10, y);
        y += 30;
    }
    if ((currentSkinKey === 'yellow' || currentSkinKey === 'black') && wallDestroyCharges > 0) { 
        ctx.font = '20px Arial'; ctx.fillStyle = 'orange';
        ctx.fillText('Charges (D): ' + wallDestroyCharges, 10, y);
    }
}

function display_shop() {
    ctx.clearRect(0, 0, myCanvas.width, myCanvas.height);
    ctx.font = '40px Arial'; ctx.fillStyle = 'black'; ctx.textAlign = 'center';
    ctx.fillText('Skin Shop', myCanvas.width / 2, 50);
    ctx.font = '25px Arial'; ctx.fillStyle = 'yellow';
    ctx.fillText('Your Stars: ' + collectedStars, myCanvas.width / 2, 90);
    
    let y_offset = 150;
    const skinKeys = Object.keys(SKINS);
    for (let i = 0; i < skinKeys.length; i++) {
        const key = skinKeys[i];
        const skin = SKINS[key];
        let status = '';
        let number = i + 1; 
        if (availableSkins.includes(key)) {
            status = skin.current ? ` [${number}. EQUIPPED]` : ` [${number}. PRESS ${number} TO EQUIP]`;
            ctx.fillStyle = skin.current ? 'green' : 'blue';
        } else {
            status = ` [${number}. COST: ${skin.cost} Stars]`;
            ctx.fillStyle = (collectedStars >= skin.cost) ? 'orange' : 'red';
        }
        ctx.textAlign = 'center';
        ctx.fillText(skin.name + status, myCanvas.width / 2, y_offset);
        y_offset += 40;
    }
    ctx.font = '20px Arial'; ctx.fillStyle = 'black';
    ctx.fillText('Press "E" to Exit Shop and Play', myCanvas.width / 2, myCanvas.height - 30);
}

function reset_game() {
  bird.y = myCanvas.height / 2; bird.angle = 0; bird.velocity_y = 0;
  pipes = []; stars = []; shields = []; potions = []; currentScore = 0; pipe_spawn_timer = 0;
  isDoubleStarsActive = false; levelReached = 1;
  if (potionTimeoutID) clearTimeout(potionTimeoutID);
  currentLives = (currentSkinKey === 'tough' || currentSkinKey === 'black') ? INITIAL_LIVES : 0; 
  wallDestroyCharges = (currentSkinKey === 'yellow' || currentSkinKey === 'black') ? MAX_DESTROY_CHARGES : 0;
  add_pipe(CANVAS_WIDTH, 100, 140); 
  deactivateShield(); 
}

function Do_a_Frame() {
  if (game_mode === 'waiting_for_website') return; 
  if (game_mode === 'shop') { display_shop(); return; }
  
  ctx.clearRect(0, 0, myCanvas.width, myCanvas.height);
  bird.Do_Frame_Things();
  
  if (bottom_bar.complete) {
      if (bottom_bar_offset < -23) bottom_bar_offset = 0;
      ctx.drawImage(bottom_bar, bottom_bar_offset, myCanvas.height - bottom_bar.height);
  }
  
  switch (game_mode) {
    case 'prestart': 
      ctx.font = '25px Arial'; ctx.fillStyle = 'red'; ctx.textAlign = 'center';
      ctx.fillText('Press, touch or click to start', myCanvas.width / 2, myCanvas.height / 4);
      break;
    case 'running':
      time_game_last_running = new Date();
      bottom_bar_offset += pipe_speed;
      for (var i = 0; i < pipes.length; i++) { pipes[i].Do_Frame_Things(); }
      
      make_bird_slow_and_fall(); 
      check_for_end_game();
      check_for_score_increase();
      
      pipe_spawn_timer += 1000 / FPS; 
      if (pipe_spawn_timer > PIPE_SPAWN_INTERVAL_MS) { 
          let gap_size = Math.max(90, 140 - (currentScore * 2)); 
          let top_of_gap = Math.floor(Math.random() * (myCanvas.height - 300)) + 50; 
          add_pipe(myCanvas.width, top_of_gap, gap_size);
          pipe_spawn_timer = 0;
      }
      
      [pipes, shields, stars, potions].forEach(arr => {
          for (let i = arr.length - 1; i >= 0; i--) {
              if (arr[i].x < -100) arr.splice(i, 1);
              else if (arr !== pipes) arr[i].Do_Frame_Things();
          }
      });
      
      display_star_count(); display_score(); display_lives(); 
      break;
    case 'over':
      make_bird_slow_and_fall();
      ctx.font = '30px Arial'; ctx.fillStyle = 'red'; ctx.textAlign = 'center';
      ctx.fillText('Game Over', myCanvas.width / 2, 100);
      ctx.fillText('Score: ' + currentScore, myCanvas.width / 2, 150);
      break;
  }

  // DRAW THE FLASH EFFECT
  if (flashTimer > 0) {
    ctx.fillStyle = flashColor;
    ctx.fillRect(0, 0, myCanvas.width, myCanvas.height);
    flashTimer--;
  }
}

var bottom_bar = new Image(); bottom_bar.src = 'red.png';
var pipe_piece = new Image(); pipe_piece.onload = reset_game; pipe_piece.src = 'wall.png';
var bird = new MySprite(SKINS[currentSkinKey].src); 
bird.x = myCanvas.width / 3; bird.y = myCanvas.height / 2;

setInterval(Do_a_Frame, 1000 / FPS);
