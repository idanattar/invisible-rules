// =================================================
// SOCIAL FORCE / JELLYFISH
// Social Force Model (Helbing & Molnár, 1995)
//
// The same principle as before, in the shape of a jellyfish:
// - The bell (dome) is the space where people are created.
//   It pulses slowly, like a jellyfish swimming.
// - Its lower rim is the invisible barrier. On it are six gates,
//   one per rainbow color, opening and closing at their own rhythm.
// - Behind each gate hangs a tentacle: a tube that sways,
//   narrows toward its end, and changes width along its length.
//   The circles change size with the tentacle.
// Everything is invisible: the trails draw the jellyfish.
//
// Mouse (only inside the bell):
//   click  = one person of a random color
//   drag   = a stream of people
//
// Keys:
//   SPACE  pause / play
//   R      reset
//   T      show / hide the trails
//   G      show / hide the shape (bell, gates, tentacles)
//   C      clear the trails only
//   S      save an image
// =================================================

let people = [];
let controls = {};
let paused = false;
let exited = [0, 0, 0, 0, 0, 0];
let simTime = 0;

let trails;
let showTrails = true;
let showShape = false;

const W = 900;
const H = 700;
const BG = [15, 18, 24];
const MAX_PEOPLE = 400;
const BASE_R = 5;

// The bell
const CX = 450;
const RIM_Y = 270;          // the lower rim = the barrier
const BELL_RX = 230;        // half-width of the bell
const BELL_RY = 210;        // height of the bell

// The tentacles
const TENTACLE_BASE = 20;   // average half-width
const TENTACLE_LEN = H - RIM_Y;

// Six rainbow colors, left to right along the rim.
// period = gate rhythm (seconds)
// amp, freq, phase = how the tentacle width changes along its length
// sway, wave = how much and how fast the tentacle sways
const GROUPS = [
  { name: "RED",    col: [255, 70, 70],   period: 3.0, amp: 8,  freq: 0.030, phase: 0.0, sway: 30, wave: 0.9 },
  { name: "ORANGE", col: [255, 150, 50],  period: 4.5, amp: 10, freq: 0.020, phase: 1.2, sway: 22, wave: 1.1 },
  { name: "YELLOW", col: [255, 220, 60],  period: 6.0, amp: 6,  freq: 0.045, phase: 2.4, sway: 35, wave: 0.7 },
  { name: "GREEN",  col: [80, 210, 110],  period: 3.8, amp: 10, freq: 0.015, phase: 3.6, sway: 26, wave: 1.0 },
  { name: "BLUE",   col: [70, 150, 255],  period: 5.2, amp: 8,  freq: 0.025, phase: 4.8, sway: 32, wave: 0.8 },
  { name: "PURPLE", col: [170, 100, 255], period: 7.0, amp: 7,  freq: 0.040, phase: 0.6, sway: 24, wave: 1.2 },
];

// The gates spread evenly along the rim
GROUPS.forEach((g, i) => {
  let span = BELL_RX * 2 * 0.85;
  g.gateX = CX - span / 2 + (span / GROUPS.length) * (i + 0.5);
  g.open = 1;
});

function setup() {
  createCanvas(W, H);
  trails = createGraphics(W, H);
  createControls();
  resetSimulation();
}

// ---------------------------------
// CONTROLS
// ---------------------------------

function createControls() {
  let panel = createDiv();
  panel.style("width", "900px");
  panel.style("max-width", "100%");
  panel.style("font-family", "Arial");
  panel.style("padding", "15px 0");

  controls.speed = addSlider(panel, "Desired speed", 0.5, 4, 1.8, 0.1);
  controls.space = addSlider(panel, "Personal space", 8, 50, 14, 1);
  controls.rhythm = addSlider(panel, "Rhythm (gates, pulse, sway)", 0.25, 3, 1, 0.05);
  controls.exposure = addSlider(panel, "Exposure (trail strength)", 1, 40, 10, 1);

  let resetButton = createButton("RESET");
  resetButton.parent(panel);
  resetButton.mousePressed(resetSimulation);

  let pauseButton = createButton("PAUSE / PLAY");
  pauseButton.parent(panel);
  pauseButton.mousePressed(() => (paused = !paused));

  let clearButton = createButton("CLEAR TRAILS");
  clearButton.parent(panel);
  clearButton.mousePressed(clearTrails);
}

function addSlider(parent, label, min, max, val, step) {
  let row = createDiv();
  row.parent(parent);
  row.style("margin-bottom", "12px");

  let title = createSpan(label + ": ");
  title.parent(row);

  let valueText = createSpan(String(val));
  valueText.parent(row);

  let slider = createSlider(min, max, val, step);
  slider.parent(row);
  slider.style("display", "block");
  slider.style("width", "100%");

  slider.input(() => valueText.html(String(slider.value())));

  return slider;
}

// ---------------------------------
// RESET
// ---------------------------------

function clearTrails() {
  trails.background(BG[0], BG[1], BG[2]);
}

function resetSimulation() {
  people = [];
  exited = [0, 0, 0, 0, 0, 0];
  simTime = 0;
  clearTrails();
}

// ---------------------------------
// THE JELLYFISH SHAPE
// ---------------------------------

// The bell pulses: it gets a little wider and taller, then back
function bellRX() { return BELL_RX + 8 * sin(simTime * 1.3); }
function bellRY() { return BELL_RY + 14 * sin(simTime * 1.3); }

// How far a point is from the bell center: 1 = exactly on the bell wall
function bellDistance(x, y) {
  let dx = (x - CX) / bellRX();
  let dy = (y - RIM_Y) / bellRY();
  return sqrt(dx * dx + dy * dy);
}

// 0 at the rim, 1 at the tip of the tentacle
function along(y) {
  return constrain((y - RIM_Y) / TENTACLE_LEN, 0, 1);
}

// The middle of the tentacle at height y (it sways, but stays attached at the gate)
function tentacleX(g, y) {
  let s = along(y);
  return g.gateX + g.sway * s * sin((y - RIM_Y) * 0.012 - simTime * g.wave + g.phase);
}

// Half-width of the tentacle at height y: waves along its length, narrows toward the tip
function tentacleHalf(g, y) {
  let s = along(y);
  let wave = TENTACLE_BASE + g.amp * sin(g.freq * (y - RIM_Y) + g.phase);
  return wave * (1 - 0.45 * s);
}

function gateHalf(g) {
  return tentacleHalf(g, RIM_Y) * g.open;
}

function updateGates() {
  for (let g of GROUPS) {
    let s = sin(TWO_PI * simTime / g.period);
    g.open = constrain(s * 2.5, -1, 1) * 0.5 + 0.5;
  }
}

// ---------------------------------
// MOUSE: creating people (only inside the bell)
// ---------------------------------

function canSpawnHere() {
  return mouseY < RIM_Y - 12 && bellDistance(mouseX, mouseY) < 0.92;
}

function spawnAtMouse() {
  if (!canSpawnHere() || people.length >= MAX_PEOPLE) return;

  let g = floor(random(GROUPS.length));
  people.push(new Person(g, mouseX + random(-3, 3), mouseY + random(-3, 3)));
}

function mousePressed() {
  spawnAtMouse();
}

function mouseDragged() {
  if (frameCount % 3 === 0) spawnAtMouse();
}

// ---------------------------------
// DRAW
// ---------------------------------

function draw() {
  if (!paused) {
    simTime += controls.rhythm.value() / 60;
    updateGates();
    removeExited();

    let forces = people.map(p => p.calculateForce());
    for (let i = 0; i < people.length; i++) {
      people[i].update(forces[i]);
    }

    drawTrails();
  }

  if (showTrails) {
    image(trails, 0, 0);
  } else {
    background(BG[0], BG[1], BG[2]);
  }

  if (canSpawnHere()) {
    noFill();
    stroke(255, 40);
    strokeWeight(1);
    circle(mouseX, mouseY, 14);
  }

  if (showShape) drawShape();

  for (let p of people) {
    p.display();
  }

  drawStats();
}

function drawTrails() {
  let a = controls.exposure.value();

  for (let p of people) {
    let c = GROUPS[p.group].col;
    trails.stroke(c[0], c[1], c[2], a);
    trails.strokeWeight(max(1, p.r * 0.4));
    trails.line(p.prevPos.x, p.prevPos.y, p.pos.x, p.pos.y);
  }
}

// The real shape, for checking only (G key)
function drawShape() {
  noFill();
  strokeWeight(1);

  // The bell
  stroke(255, 60);
  arc(CX, RIM_Y, bellRX() * 2, bellRY() * 2, PI, TWO_PI);

  // The rim (barrier)
  drawingContext.setLineDash([4, 6]);
  line(CX - bellRX(), RIM_Y, CX + bellRX(), RIM_Y);
  drawingContext.setLineDash([]);

  for (let g of GROUPS) {
    let c = g.col;

    // The gate
    strokeWeight(3);
    stroke(c[0], c[1], c[2], 200);
    let gh = gateHalf(g);
    line(g.gateX - gh, RIM_Y, g.gateX + gh, RIM_Y);

    // The tentacle walls
    strokeWeight(1);
    stroke(c[0], c[1], c[2], 90);
    for (let side of [-1, 1]) {
      beginShape();
      for (let y = RIM_Y; y <= H; y += 6) {
        vertex(tentacleX(g, y) + side * tentacleHalf(g, y), y);
      }
      endShape();
    }
  }
}

// ---------------------------------
// PERSON
// ---------------------------------

class Person {
  constructor(group, x, y) {
    this.group = group;
    this.g = GROUPS[group];
    this.col = color(...this.g.col);

    this.pos = createVector(x, y);
    this.prevPos = this.pos.copy();
    this.vel = createVector(0, 0);
    this.r = BASE_R;
    this.stress = 0;
  }

  inTentacle() {
    return this.pos.y > RIM_Y;
  }

  calculateForce() {
    let g = this.g;
    let speed = controls.speed.value();

    // 1. Attraction: to the gate, then down along the tentacle
    let target;
    if (!this.inTentacle()) {
      target = createVector(g.gateX, RIM_Y + 45);
    } else {
      let y = this.pos.y + 60;
      target = createVector(tentacleX(g, y), y);
    }

    let desired = p5.Vector.sub(target, this.pos);
    desired.setMag(speed);

    let drive = p5.Vector.sub(desired, this.vel);
    drive.mult(0.12);

    // 2. Social repulsion (personal space shrinks with the circle)
    let personalSpace = controls.space.value() * (this.r / BASE_R);
    let social = createVector(0, 0);

    for (let other of people) {
      if (other === this) continue;

      let diff = p5.Vector.sub(this.pos, other.pos);
      let d = diff.mag();

      if (d > 0 && d < personalSpace * 3) {
        let strength = min(0.22 * exp((personalSpace - d) / 14), 1.5);
        diff.normalize();
        diff.mult(strength);
        social.add(diff);
      }
    }
    social.limit(0.6);

    // 3. Walls
    let walls = createVector(0, 0);

    if (!this.inTentacle()) {
      // The rim: everything except the color's own gate
      let gh = gateHalf(g);
      let left = CX - bellRX();
      let right = CX + bellRX();
      walls.add(wallForce(this.pos, left, RIM_Y, g.gateX - gh, RIM_Y));
      walls.add(wallForce(this.pos, g.gateX + gh, RIM_Y, right, RIM_Y));

      // The bell wall: a gentle push toward the middle
      let e = bellDistance(this.pos.x, this.pos.y);
      if (e > 0.9) {
        let toCenter = createVector(CX - this.pos.x, RIM_Y - 40 - this.pos.y);
        walls.add(toCenter.setMag((e - 0.9) * 5));
      }
    } else {
      // The tentacle walls: a gentle push toward its middle
      let half = tentacleHalf(g, this.pos.y);
      let offset = this.pos.x - tentacleX(g, this.pos.y);
      let room = half - abs(offset);
      if (room < 10) {
        walls.add(createVector(-Math.sign(offset) * 0.5 * (1 - room / 10), 0));
      }
    }
    walls.limit(1.2);

    // 4. Small random movement
    let noise = p5.Vector.random2D().mult(0.012);

    this.stress = lerp(this.stress, social.mag() + walls.mag(), 0.08);

    let force = createVector(0, 0);
    force.add(drive).add(social).add(walls).add(noise);
    force.limit(1.5);

    return force;
  }

  update(force) {
    let g = this.g;
    this.prevPos.set(this.pos);

    this.vel.add(force);
    this.vel.limit(controls.speed.value() * 1.4);

    let previousY = this.pos.y;
    this.pos.add(this.vel);

    // Circle size: follows the width of the tentacle
    let targetR = this.inTentacle()
      ? BASE_R * tentacleHalf(g, this.pos.y) / TENTACLE_BASE
      : BASE_R;
    this.r = lerp(this.r, targetR, 0.2);

    // Inside the bell: no getting out through its wall
    if (!this.inTentacle()) {
      let e = bellDistance(this.pos.x, this.pos.y);
      let maxE = 1 - this.r / bellRY();
      if (e > maxE) {
        let k = maxE / e;
        this.pos.x = CX + (this.pos.x - CX) * k;
        this.pos.y = RIM_Y + (this.pos.y - RIM_Y) * k;
        this.vel.mult(0.3);
      }
    }

    // The rim: passing only through your own gate, while it's open
    let gh = gateHalf(g);
    let insideGate =
      this.pos.x >= g.gateX - gh + this.r &&
      this.pos.x <= g.gateX + gh - this.r;

    if (!insideGate) {
      if (previousY <= RIM_Y && this.pos.y + this.r > RIM_Y) {
        this.pos.y = RIM_Y - this.r;
        this.vel.y = -abs(this.vel.y) * 0.2;
      } else if (previousY >= RIM_Y && this.pos.y - this.r < RIM_Y) {
        this.pos.y = RIM_Y + this.r;
        this.vel.y = abs(this.vel.y) * 0.2;
      }
    }

    // In the tentacle: no getting out through its walls
    if (this.inTentacle()) {
      let half = tentacleHalf(g, this.pos.y);
      let mid = tentacleX(g, this.pos.y);
      let lo = mid - half + this.r;
      let hi = mid + half - this.r;
      if (this.pos.x < lo) {
        this.pos.x = lo;
        this.vel.x = abs(this.vel.x) * 0.3;
      }
      if (this.pos.x > hi) {
        this.pos.x = hi;
        this.vel.x = -abs(this.vel.x) * 0.3;
      }
    }
  }

  display() {
    let s = constrain(this.stress / 1.2, 0, 1);
    let c = lerpColor(this.col, color(255), s * 0.8);

    noStroke();
    fill(c);
    circle(this.pos.x, this.pos.y, this.r * 2);
  }
}

// ---------------------------------
// INVISIBLE WALL FORCE
// ---------------------------------

function wallForce(p, x1, y1, x2, y2) {
  let segment = createVector(x2 - x1, y2 - y1);
  let lenSq = segment.magSq();
  if (lenSq === 0) return createVector(0, 0);

  let point = createVector(p.x - x1, p.y - y1);
  let t = constrain(point.dot(segment) / lenSq, 0, 1);

  let closest = createVector(x1 + segment.x * t, y1 + segment.y * t);
  let diff = p5.Vector.sub(p, closest);
  let d = diff.mag();

  let force = createVector(0, 0);

  if (d > 0 && d < 45) {
    let strength = 0.5 * exp((15 - d) / 12);
    force = diff.normalize();
    force.mult(min(strength, 2));
  }

  return force;
}

// ---------------------------------
// EXITS (at the tips of the tentacles)
// ---------------------------------

function removeExited() {
  for (let i = people.length - 1; i >= 0; i--) {
    if (people[i].pos.y > H + 10) {
      exited[people[i].group]++;
      people.splice(i, 1);
    }
  }
}

// ---------------------------------
// STATS
// ---------------------------------

function drawStats() {
  noStroke();
  textAlign(LEFT);
  textSize(13);

  fill(235);
  text("SOCIAL FORCE / JELLYFISH", 20, 28);

  textSize(12);
  for (let i = 0; i < GROUPS.length; i++) {
    fill(...GROUPS[i].col);
    text(GROUPS[i].name + " " + exited[i], 20, 52 + i * 18);
  }

  fill(120);
  textSize(11);
  text("click / drag inside the bell · SPACE pause · R reset · T trails · G shape · C clear · S save",
       20, H - 14);
}

// ---------------------------------
// KEYBOARD
// ---------------------------------

function keyPressed() {
  if (key === " ") {
    paused = !paused;
    return false;
  }

  if (key === "r" || key === "R") resetSimulation();
  if (key === "t" || key === "T") showTrails = !showTrails;
  if (key === "g" || key === "G") showShape = !showShape;
  if (key === "c" || key === "C") clearTrails();
  if (key === "s" || key === "S") saveCanvas("jellyfish", "png");
}