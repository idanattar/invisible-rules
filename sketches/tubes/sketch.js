// =================================================
// SOCIAL FORCE / SIX POPULATIONS / TUBES
// Social Force Model (Helbing & Molnár, 1995)
//
// Six colors in rainbow order. Each color has its own gate
// on an invisible barrier, and the gates open and close at
// different rhythms. Behind each gate there is a tube
// whose width changes along its length. The circles change
// size with the tube: they shrink where it narrows
// and grow where it widens.
// The barrier and the tubes are invisible: the trails draw them.
//
// Mouse (only before the barrier):
//   click  = one person of a random color
//   drag   = a stream of people
//
// Keys:
//   SPACE  pause / play
//   R      reset
//   T      show / hide the trails
//   G      show / hide the barrier, gates and tubes
//   C      clear the trails only
//   S      save an image
// =================================================

let people = [];
let controls = {};
let paused = false;
let exited = [0, 0, 0, 0, 0, 0];
let simTime = 0;                 // seconds; stops on pause

let trails;
let showTrails = true;
let showBarrier = false;

const W = 900;
const H = 600;
const BG = [15, 18, 24];
const MAX_PEOPLE = 400;

const barrierX = 420;            // the invisible barrier
const BASE_R = 5;                // circle size before the tubes
const TUBE_BASE = 30;            // average half-width of a tube

// Six colors in rainbow order, top to bottom.
// period    = seconds for one open-and-close cycle of the gate
// amp, freq, phase = the shape of the tube (how much and how often it changes width)
const GROUPS = [
  { name: "RED",    col: [255, 70, 70],   period: 3.0, amp: 14, freq: 0.030, phase: 0.0 },
  { name: "ORANGE", col: [255, 150, 50],  period: 4.5, amp: 18, freq: 0.018, phase: 1.2 },
  { name: "YELLOW", col: [255, 220, 60],  period: 6.0, amp: 10, freq: 0.050, phase: 2.4 },
  { name: "GREEN",  col: [80, 210, 110],  period: 3.8, amp: 18, freq: 0.012, phase: 3.6 },
  { name: "BLUE",   col: [70, 150, 255],  period: 5.2, amp: 15, freq: 0.025, phase: 4.8 },
  { name: "PURPLE", col: [170, 100, 255], period: 7.0, amp: 12, freq: 0.040, phase: 0.6 },
];

// Gate height = the middle of each tube, spread evenly
GROUPS.forEach((g, i) => {
  g.gateY = (H / GROUPS.length) * (i + 0.5);
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

  controls.speed = addSlider(panel, "Desired speed", 0.5, 4, 2, 0.1);
  controls.space = addSlider(panel, "Personal space", 8, 50, 16, 1);
  controls.rhythm = addSlider(panel, "Gate rhythm speed", 0.25, 3, 1, 0.05);
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
// TUBES AND GATES
// ---------------------------------

// Half-width of a group's tube at position x
function tubeHalf(g, x) {
  return TUBE_BASE + g.amp * sin(g.freq * (x - barrierX) + g.phase);
}

// Half-width of the gate right now (0 = closed)
function gateHalf(g) {
  return tubeHalf(g, barrierX) * g.open;
}

function updateGates() {
  for (let g of GROUPS) {
    // A "squeezed" sine wave: mostly fully open or fully closed
    let s = sin(TWO_PI * simTime / g.period);
    g.open = constrain(s * 2.5, -1, 1) * 0.5 + 0.5;
  }
}

// ---------------------------------
// MOUSE: creating people (only before the barrier)
// ---------------------------------

function canSpawnHere() {
  return mouseX >= 0 && mouseX <= barrierX - 15 &&
         mouseY >= 0 && mouseY <= H;
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

  // A faint hint where you are allowed to create people
  if (canSpawnHere()) {
    noFill();
    stroke(255, 40);
    circle(mouseX, mouseY, 14);
  }

  if (showBarrier) drawBarrier();

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
    // The trail is as thick as the circle: it also changes in the tube
    trails.strokeWeight(max(1, p.r * 0.4));
    trails.line(p.prevPos.x, p.prevPos.y, p.pos.x, p.pos.y);
  }
}

// The real barrier, gates and tubes, for checking only (G key)
function drawBarrier() {
  strokeWeight(1);
  drawingContext.setLineDash([4, 6]);
  stroke(255, 60);
  line(barrierX, 0, barrierX, H);
  drawingContext.setLineDash([]);

  for (let g of GROUPS) {
    let c = g.col;

    // The gate, as wide as it is open right now
    strokeWeight(3);
    stroke(c[0], c[1], c[2], 200);
    let gh = gateHalf(g);
    line(barrierX, g.gateY - gh, barrierX, g.gateY + gh);

    // The tube walls
    strokeWeight(1);
    stroke(c[0], c[1], c[2], 90);
    noFill();
    for (let side of [-1, 1]) {
      beginShape();
      for (let x = barrierX; x <= W; x += 6) {
        vertex(x, g.gateY + side * tubeHalf(g, x));
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

  inTube() {
    return this.pos.x > barrierX;
  }

  calculateForce() {
    let g = this.g;
    let speed = controls.speed.value();

    // 1. Attraction: to the gate, and in the tube forward along its middle
    let target;
    if (!this.inTube()) {
      target = createVector(barrierX + 45, g.gateY);
    } else {
      target = createVector(this.pos.x + 60, g.gateY);
    }

    let desired = p5.Vector.sub(target, this.pos);
    desired.setMag(speed);

    let drive = p5.Vector.sub(desired, this.vel);
    drive.mult(0.12);

    // 2. Social repulsion. In the tube, personal space shrinks with the circle
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

    if (!this.inTube()) {
      // The barrier: everything except the color's own gate
      let gh = gateHalf(g);
      walls.add(wallForce(this.pos, barrierX, 0, barrierX, g.gateY - gh));
      walls.add(wallForce(this.pos, barrierX, g.gateY + gh, barrierX, H));
    } else {
      // The tube walls: a gentle push back toward the middle
      let half = tubeHalf(g, this.pos.x);
      let offset = this.pos.y - g.gateY;
      let room = half - abs(offset);
      if (room < 12) {
        walls.add(createVector(0, -Math.sign(offset) * 0.5 * (1 - room / 12)));
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

    let previousX = this.pos.x;
    this.pos.add(this.vel);

    // Circle size: follows the width of the tube
    let targetR = this.inTube()
      ? BASE_R * tubeHalf(g, this.pos.x) / TUBE_BASE
      : BASE_R;
    this.r = lerp(this.r, targetR, 0.2);

    // Canvas edges
    if (this.pos.y < this.r) {
      this.pos.y = this.r;
      this.vel.y = abs(this.vel.y) * 0.3;
    }
    if (this.pos.y > H - this.r) {
      this.pos.y = H - this.r;
      this.vel.y = -abs(this.vel.y) * 0.3;
    }
    if (this.pos.x < this.r) {
      this.pos.x = this.r;
      this.vel.x = abs(this.vel.x);
    }

    // The barrier: passing only through your own gate, while it's open
    let gh = gateHalf(g);
    let insideGate =
      this.pos.y >= g.gateY - gh + this.r &&
      this.pos.y <= g.gateY + gh - this.r;

    if (!insideGate) {
      if (previousX <= barrierX && this.pos.x + this.r > barrierX) {
        this.pos.x = barrierX - this.r;
        this.vel.x = -abs(this.vel.x) * 0.2;
      } else if (previousX >= barrierX && this.pos.x - this.r < barrierX) {
        this.pos.x = barrierX + this.r;
        this.vel.x = abs(this.vel.x) * 0.2;
      }
    }

    // In the tube: no getting out through the walls
    if (this.inTube()) {
      let half = tubeHalf(g, this.pos.x);
      let lo = g.gateY - half + this.r;
      let hi = g.gateY + half - this.r;
      if (this.pos.y < lo) {
        this.pos.y = lo;
        this.vel.y = abs(this.vel.y) * 0.3;
      }
      if (this.pos.y > hi) {
        this.pos.y = hi;
        this.vel.y = -abs(this.vel.y) * 0.3;
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
// EXITS
// ---------------------------------

function removeExited() {
  for (let i = people.length - 1; i >= 0; i--) {
    if (people[i].pos.x > W + 10) {
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
  text("SOCIAL FORCE / SIX POPULATIONS", 20, 28);

  textSize(12);
  for (let i = 0; i < GROUPS.length; i++) {
    fill(...GROUPS[i].col);
    text(GROUPS[i].name + " " + exited[i], 20 + i * 90, 50);
  }

  fill(120);
  textSize(11);
  text("click / drag left of the barrier · SPACE pause · R reset · T trails · G barrier · C clear · S save",
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
  if (key === "g" || key === "G") showBarrier = !showBarrier;
  if (key === "c" || key === "C") clearTrails();
  if (key === "s" || key === "S") saveCanvas("rainbow-tubes", "png");
}