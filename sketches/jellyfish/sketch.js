// =================================================
// SOCIAL FORCE / RADIAL JELLYFISH
// Social Force Model (Helbing & Molnár, 1995)
//
// The jellyfish is in the center, seen from above:
// - The bell is a circle in the middle where people are created.
//   It pulses slowly.
// - Its edge is the invisible barrier, with gates in every direction.
//   Each rainbow color has two gates, on opposite sides.
//   Every gate opens and closes at its own rhythm.
// - From each gate a tentacle reaches outward: a tube that sways,
//   narrows toward its tip, and changes width along its length.
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

const W = 800;
const H = 800;
const BG = [15, 18, 24];
const MAX_PEOPLE = 400;
const BASE_R = 5;

// The bell: a circle in the center
const CX = W / 2;
const CY = H / 2;
const BELL_R = 150;

// The tentacles
const TENTACLE_BASE = 18;     // average half-width
const TENTACLE_LEN = 230;     // after this they end, and people walk freely to the edge
const GATES_PER_COLOR = 2;    // 1 = six tentacles, 2 = twelve tentacles

// Six rainbow colors.
// period = gate rhythm (seconds)
// amp, freq, phase = how the tentacle width changes along its length
// sway, wave = how much and how fast the tentacle sways
const COLORS = [
  { name: "RED",    col: [255, 70, 70],   period: 3.0, amp: 7, freq: 0.030, phase: 0.0, sway: 26, wave: 0.9 },
  { name: "ORANGE", col: [255, 150, 50],  period: 4.5, amp: 9, freq: 0.020, phase: 1.2, sway: 20, wave: 1.1 },
  { name: "YELLOW", col: [255, 220, 60],  period: 6.0, amp: 5, freq: 0.045, phase: 2.4, sway: 30, wave: 0.7 },
  { name: "GREEN",  col: [80, 210, 110],  period: 3.8, amp: 9, freq: 0.015, phase: 3.6, sway: 22, wave: 1.0 },
  { name: "BLUE",   col: [70, 150, 255],  period: 5.2, amp: 7, freq: 0.025, phase: 4.8, sway: 28, wave: 0.8 },
  { name: "PURPLE", col: [170, 100, 255], period: 7.0, amp: 6, freq: 0.040, phase: 0.6, sway: 21, wave: 1.2 },
];

// The gates, spread evenly around the bell, in rainbow order
let gates = [];

function buildGates() {
  gates = [];
  let total = COLORS.length * GATES_PER_COLOR;

  for (let i = 0; i < total; i++) {
    let c = i % COLORS.length;
    let second = floor(i / COLORS.length);  // 0 = first gate of the color, 1 = second
    let base = COLORS[c];
    let angle = -HALF_PI + (TWO_PI / total) * i;

    gates.push({
      color: c,
      angle: angle,
      dir: p5.Vector.fromAngle(angle),              // outward
      perp: p5.Vector.fromAngle(angle + HALF_PI),   // sideways
      // the second gate of each color is a little different
      period: base.period * (second === 0 ? 1 : 1.35),
      amp: base.amp,
      freq: base.freq,
      phase: base.phase + second * 2.1,
      sway: base.sway,
      wave: base.wave * (second === 0 ? 1 : 0.8),
      open: 1,
    });
  }
}

function setup() {
  createCanvas(W, H);
  trails = createGraphics(W, H);
  buildGates();
  createControls();
  resetSimulation();
}

// ---------------------------------
// CONTROLS
// ---------------------------------

function createControls() {
  let panel = createDiv();
  panel.style("width", W + "px");
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

// The bell pulses
function bellR() {
  return BELL_R + 8 * sin(simTime * 1.3);
}

// A point in "tentacle coordinates":
// s   = how far beyond the bell edge, along the tentacle
// lat = how far to the side of the tentacle's straight axis
function tentacleCoords(g, p) {
  let rel = createVector(p.x - CX, p.y - CY);
  return {
    s: rel.dot(g.dir) - bellR(),
    lat: rel.dot(g.perp),
  };
}

// 0 at the bell, 1 at the tip
function along(s) {
  return constrain(s / TENTACLE_LEN, 0, 1);
}

// How far the tentacle has swayed to the side at distance s
function swayOffset(g, s) {
  return g.sway * along(s) * sin(s * 0.015 - simTime * g.wave + g.phase);
}

// Half-width of the tentacle at distance s
function tentacleHalf(g, s) {
  let wave = TENTACLE_BASE + g.amp * sin(g.freq * s + g.phase);
  return wave * (1 - 0.45 * along(s));
}

// The middle of the tentacle at distance s, as a point on the canvas
function tentaclePoint(g, s) {
  let r = bellR() + s;
  let side = swayOffset(g, s);
  return createVector(
    CX + g.dir.x * r + g.perp.x * side,
    CY + g.dir.y * r + g.perp.y * side
  );
}

function gateHalf(g) {
  return tentacleHalf(g, 0) * g.open;
}

function updateGates() {
  for (let g of gates) {
    let s = sin(TWO_PI * simTime / g.period + g.phase);
    g.open = constrain(s * 2.5, -1, 1) * 0.5 + 0.5;
  }
}

// Is this point lined up with the opening of this gate?
function alignedWithGate(g, p, margin) {
  let rel = createVector(p.x - CX, p.y - CY);
  return rel.dot(g.dir) > 0 && abs(rel.dot(g.perp)) <= gateHalf(g) - margin;
}

// ---------------------------------
// MOUSE: creating people (only inside the bell)
// ---------------------------------

function canSpawnHere() {
  return dist(mouseX, mouseY, CX, CY) < bellR() - 12;
}

function spawnAtMouse() {
  if (!canSpawnHere() || people.length >= MAX_PEOPLE) return;

  let c = floor(random(COLORS.length));
  people.push(new Person(c, mouseX + random(-3, 3), mouseY + random(-3, 3)));
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
    let c = COLORS[p.color].col;
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
  drawingContext.setLineDash([4, 6]);
  stroke(255, 60);
  circle(CX, CY, bellR() * 2);
  drawingContext.setLineDash([]);

  for (let g of gates) {
    let c = COLORS[g.color].col;

    // The gate, as wide as it is open right now
    strokeWeight(3);
    stroke(c[0], c[1], c[2], 200);
    let mid = tentaclePoint(g, 0);
    let gh = gateHalf(g);
    line(mid.x - g.perp.x * gh, mid.y - g.perp.y * gh,
         mid.x + g.perp.x * gh, mid.y + g.perp.y * gh);

    // The tentacle walls
    strokeWeight(1);
    stroke(c[0], c[1], c[2], 90);
    for (let side of [-1, 1]) {
      beginShape();
      for (let s = 0; s <= TENTACLE_LEN; s += 6) {
        let p = tentaclePoint(g, s);
        let h = tentacleHalf(g, s) * side;
        vertex(p.x + g.perp.x * h, p.y + g.perp.y * h);
      }
      endShape();
    }
  }
}

// ---------------------------------
// PERSON
// ---------------------------------

class Person {
  constructor(colorIndex, x, y) {
    this.color = colorIndex;
    this.col = color(...COLORS[colorIndex].col);

    this.pos = createVector(x, y);
    this.prevPos = this.pos.copy();
    this.vel = createVector(0, 0);
    this.r = BASE_R;
    this.stress = 0;

    // "bell" → "tentacle" → "free" (beyond the tip, on the way out)
    this.state = "bell";

    // Head for the nearest gate of my color
    this.gate = this.nearestGate();
  }

  nearestGate() {
    let best = null;
    let bestD = Infinity;
    for (let g of gates) {
      if (g.color !== this.color) continue;
      let p = tentaclePoint(g, 0);
      let d = dist(this.pos.x, this.pos.y, p.x, p.y);
      if (d < bestD) {
        bestD = d;
        best = g;
      }
    }
    return best;
  }

  calculateForce() {
    let g = this.gate;
    let speed = controls.speed.value();
    let tc = tentacleCoords(g, this.pos);

    // 1. Attraction: to my gate, then out along the tentacle
    let target;
    if (this.state === "bell") {
      target = tentaclePoint(g, 45);
    } else if (this.state === "tentacle") {
      target = tentaclePoint(g, tc.s + 60);
    } else {
      target = p5.Vector.add(this.pos, p5.Vector.mult(g.dir, 100));
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

    if (this.state === "bell") {
      // The bell edge pushes inward, except at my own open gate
      let d = bellR() - dist(this.pos.x, this.pos.y, CX, CY);
      if (d > 0 && d < 45 && !alignedWithGate(g, this.pos, 0)) {
        let strength = min(0.5 * exp((15 - d) / 12), 2);
        walls.add(createVector(CX - this.pos.x, CY - this.pos.y).setMag(strength));
      }
    } else if (this.state === "tentacle") {
      // The tentacle walls push toward its middle
      let offset = tc.lat - swayOffset(g, tc.s);
      let room = tentacleHalf(g, tc.s) - abs(offset);
      if (room < 10) {
        walls.add(p5.Vector.mult(g.perp, -Math.sign(offset) * 0.5 * (1 - room / 10)));
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
    let g = this.gate;
    this.prevPos.set(this.pos);

    this.vel.add(force);
    this.vel.limit(controls.speed.value() * 1.4);
    this.pos.add(this.vel);

    let tc = tentacleCoords(g, this.pos);

    // Circle size: follows the width of the tentacle
    let targetR = this.state === "tentacle"
      ? BASE_R * tentacleHalf(g, tc.s) / TENTACLE_BASE
      : BASE_R;
    this.r = lerp(this.r, targetR, 0.2);

    if (this.state === "bell") {
      // The bell edge: out only through my own gate, while it's open
      let rel = createVector(this.pos.x - CX, this.pos.y - CY);
      let rho = rel.mag();
      let edge = bellR();

      if (rho + this.r > edge) {
        if (alignedWithGate(g, this.pos, this.r)) {
          if (rho > edge) this.state = "tentacle";
        } else {
          // Glass: push back in, with a small bounce
          let n = rel.copy().div(rho);
          this.pos.set(CX + n.x * (edge - this.r), CY + n.y * (edge - this.r));
          let vn = this.vel.dot(n);
          if (vn > 0) this.vel.sub(p5.Vector.mult(n, vn * 1.2));
        }
      }
    } else if (this.state === "tentacle") {
      // No going back into the bell
      if (tc.s < this.r) {
        this.pos.add(p5.Vector.mult(g.dir, this.r - tc.s));
      }

      // No getting out through the tentacle walls
      let offset = tc.lat - swayOffset(g, tc.s);
      let limit = max(0, tentacleHalf(g, tc.s) - this.r);
      if (abs(offset) > limit) {
        let fix = Math.sign(offset) * limit - offset;
        this.pos.add(p5.Vector.mult(g.perp, fix));
        let vp = this.vel.dot(g.perp);
        this.vel.sub(p5.Vector.mult(g.perp, vp * 1.3));
      }

      // Past the tip: free
      if (tc.s > TENTACLE_LEN) this.state = "free";
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
// EXITS (off the canvas)
// ---------------------------------

function removeExited() {
  for (let i = people.length - 1; i >= 0; i--) {
    let p = people[i].pos;
    if (p.x < -10 || p.x > W + 10 || p.y < -10 || p.y > H + 10) {
      exited[people[i].color]++;
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
  for (let i = 0; i < COLORS.length; i++) {
    fill(...COLORS[i].col);
    text(COLORS[i].name + " " + exited[i], 20, 52 + i * 18);
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