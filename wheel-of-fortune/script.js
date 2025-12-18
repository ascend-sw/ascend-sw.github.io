const canvas = document.getElementById('wheel');
const ctx = canvas.getContext('2d');
const spinBtn = document.getElementById('spin-btn');
const resultDiv = document.getElementById('result');
const nameInput = document.getElementById('name-input');
const addBtn = document.getElementById('add-btn');
const nameList = document.getElementById('name-list');
const arrowContainer = document.querySelector('.arrow-container');
const stats = document.querySelector('.stats');
const soundBtn = document.getElementById('sound-btn');
const paletteBtn = document.getElementById('palette-btn');

const SEGMENT_COLORS = [
    "#6307a4ff", // Aura Indigo
    "#fc622aff", // Sunset Coral
    "#0606b3ff", // Deep Blue
    "#DC143C", // Crimson
    "#24c068ff", // Sea Green
    "#ffc123ff", // Goldenrod
    "#FF1493", // Deep Pink
    "#00CED1",  // Dark Turquoise,
    "#FF9F40",
    "#2ea7bcff",
];

const SEGMENT_COLORS2 = [
    "#FF6384", "#36A2EB", "#FFCE56", "#4BC0C0",
    "#9966FF", "#FF9F40", "#E7E9ED", "#76D7C4",
    "#F7464A", "#46BFBD", "#FDB45C"
];

let activeColors = SEGMENT_COLORS;

const WHEEL_STROKE_COLOR = "#dedede";
const TEXT_COLOR = "white";
const TEXT_SHADOW_COLOR = "rgba(0,0,0,0.8)";
const REMOVE_BUTTON_BG_COLOR = "rgba(0, 0, 0, 0.1)";
const REMOVE_BUTTON_ICON_COLOR = "black";
const CENTER_CIRCLE_COLOR = "white";
const CENTER_DOT_COLOR = "rgb(44, 44, 44)";
const OUTSIDE_RADIUS = 230;
const WINNER_COLOR = "crimson";

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const urlParams = new URLSearchParams(window.location.search);
const teamId = urlParams.get('team');

const landingView = document.getElementById('landing-view');
const appView = document.getElementById('app-view');

let names = [];
let participantsRef;

if (teamId) {
    landingView.classList.add('hidden');
    appView.classList.remove('hidden');
    initApp(teamId);
} else {
    landingView.classList.remove('hidden');
    appView.classList.add('hidden');
    initLanding();
}

function initLanding() {
    const createBtn = document.getElementById('landing-create-btn');
    const joinBtn = document.getElementById('landing-join-btn');
    const codeInput = document.getElementById('team-code-input');

    createBtn.addEventListener('click', () => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        window.location.search = `?team=${code}`;
    });

    joinBtn.addEventListener('click', () => {
        const code = codeInput.value.trim();
        if (code) {
            window.location.search = `?team=${code}`;
        }
    });

    codeInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const code = codeInput.value.trim();
            if (code) {
                window.location.search = `?team=${code}`;
            }
        }
    });
}

function initApp(teamId) {
    if (teamId) {
        participantsRef = db.collection('teams').doc(teamId).collection('participants');
    } else {
        // Fallback or legacy
        participantsRef = db.collection('participants');
    }

    const initialNames = [
        "Dan", "Wilco", "Andreea", "Veronika",
        "Vivek", "Claudiu", "Stefania", "Alex", "Sener"
    ];

    const newTeamNames = ["Bob", "Alice", "Dan", "Mike", "Alex", "Andreea", "Maria", "Alexandra"];

    // Seed data if empty
    participantsRef.get().then(snap => {
        if (snap.empty) {
            let namesToSeed = initialNames;

            if (teamId && teamId !== '4H794Z') {
                namesToSeed = newTeamNames;
            }

            namesToSeed.forEach(name => {
                participantsRef.add({ name, createdAt: firebase.firestore.FieldValue.serverTimestamp() });
            });
        }
    });

    let isFirstLoad = true;

    // Listen for updates
    participantsRef.orderBy('createdAt').onSnapshot(snapshot => {
        names = snapshot.docs.map(doc => ({
            id: doc.id,
            name: doc.data().name
        }));

        // If it's Thursday (day 4), remove Stefania
        if (new Date().getDay() === 4) {
            names = names.filter(n => n.name !== "Stefania");
        }

        if (isFirstLoad) {
            shuffleArray(names);
            isFirstLoad = false;
        }

        updateWheel();
        updateStats();
    });
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}

shuffleArray(SEGMENT_COLORS);
shuffleArray(SEGMENT_COLORS2);

function updateStats() {
    stats.innerHTML = `${names.length} participants, ${Math.trunc((1 / names.length) * 100)}% chance to win`;
}
updateStats();

let startAngle = 0;
let arc = Math.PI / (names.length / 2);
let spinTimeout = null;

let spinAngleStart = 10;
let spinTime = 0;
let spinTimeTotal = 0;
let accelerationTime = 0;
let startTime = null;
let lastFrameTime = null;

let currentRotation = 0;
let hoveredNameIndex = -1;
let winningIndex = -1;
let audioCtx = null;
let lastSoundIndex = -1;
let isSoundEnabled = false;

function drawRouletteWheel() {
    if (canvas.getContext) {
        const outsideRadius = OUTSIDE_RADIUS;

        const insideRadius = 20;

        ctx.clearRect(0, 0, 500, 500);

        ctx.strokeStyle = WHEEL_STROKE_COLOR;
        ctx.lineWidth = 1;

        ctx.font = 'bold 26px Helvetica, Arial';
        ctx.textAlign = "left";

        for (let i = 0; i < names.length; i++) {
            const angle = startAngle + i * arc;

            // Draw segment
            ctx.fillStyle = activeColors[i % activeColors.length];
            ctx.beginPath();
            ctx.arc(250, 250, outsideRadius, angle, angle + arc, false);
            ctx.arc(250, 250, insideRadius, angle + arc, angle, true);

            if (i === winningIndex) {
                ctx.save();
                ctx.filter = "brightness(0.8)";
                // ctx.fill();
                ctx.fillStyle = WINNER_COLOR;
                ctx.fill();
                ctx.restore();
            } else {
                ctx.fill();
            }
            ctx.stroke();

            // Draw text
            ctx.save();
            ctx.shadowColor = TEXT_SHADOW_COLOR;
            ctx.shadowBlur = 5;
            ctx.fillStyle = TEXT_COLOR;
            ctx.translate(250 + Math.cos(angle + arc / 2) * (outsideRadius - 20),
                250 + Math.sin(angle + arc / 2) * (outsideRadius - 20));
            ctx.rotate(angle + arc / 2 + Math.PI);
            const text = names[i].name;
            ctx.fillText(text, 0, 8);
            ctx.restore();

            // Draw Remove button
            ctx.save();
            ctx.translate(250 + Math.cos(angle + arc / 2) * (outsideRadius + 10),
                250 + Math.sin(angle + arc / 2) * (outsideRadius + 10));
            ctx.rotate(angle + arc / 2 + Math.PI / 2);

            ctx.fillStyle = "white";
            ctx.beginPath();
            ctx.arc(0, 0, 15, 0, 2 * Math.PI);
            ctx.fill();

            ctx.strokeStyle = activeColors[i % activeColors.length];
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(0, -5);
            ctx.lineTo(0, 5);
            ctx.stroke();
            ctx.restore();
        }

        // Draw Arrow (Static on canvas if needed, but we used CSS for the pointer)
        // But let's draw a center circle for aesthetics
        ctx.fillStyle = CENTER_CIRCLE_COLOR;
        ctx.beginPath();
        ctx.arc(250, 250, insideRadius - 5, 0, 2 * Math.PI);
        ctx.fill();

        // Center decoration
        ctx.fillStyle = CENTER_DOT_COLOR;
        ctx.beginPath();
        ctx.arc(250, 250, 10, 0, 2 * Math.PI);
        ctx.fill();
    }

    // Rotate arrow container in opposite direction
    if (arrowContainer) {
        arrowContainer.style.transform = `rotate(${-startAngle * 180 / Math.PI}deg)`;
    }
}


function rotateWheel(timestamp) {
    if (!startTime) startTime = timestamp;
    if (!lastFrameTime) lastFrameTime = timestamp;

    const deltaTime = timestamp - lastFrameTime;
    lastFrameTime = timestamp;

    spinTime = timestamp - startTime;

    if (spinTime >= spinTimeTotal) {
        stopRotateWheel();
        return;
    }

    let spinAngle;
    if (spinTime < accelerationTime) {
        spinAngle = easeIn(spinTime, 0, spinAngleStart, accelerationTime);
    } else {
        const decelerationTime = spinTime - accelerationTime;
        const decelerationTotal = spinTimeTotal - accelerationTime;
        spinAngle = spinAngleStart - easeOut(decelerationTime, 0, spinAngleStart, decelerationTotal);
    }

    // Normalize speed to time (assuming 15ms baseline)
    const frameScale = deltaTime / 15;
    startAngle += (spinAngle * frameScale * Math.PI / 180);

    const currentSoundIndex = Math.floor(startAngle / arc);
    if (currentSoundIndex !== lastSoundIndex) {
        if (lastSoundIndex !== -1) {
            playTick();
        }
        lastSoundIndex = currentSoundIndex;
    }

    drawRouletteWheel();
    spinTimeout = requestAnimationFrame(rotateWheel);
}

function stopRotateWheel() {
    cancelAnimationFrame(spinTimeout);

    // Calculate winner based on relative rotation
    // Wheel rotates by startAngle, Arrow rotates by -startAngle
    // Relative angle is 2 * startAngle
    const degrees = 2 * startAngle * 180 / Math.PI + 90;
    const arcd = arc * 180 / Math.PI;
    const index = Math.floor((360 - degrees % 360) % 360 / arcd);
    winningIndex = index;
    drawRouletteWheel();

    ctx.save();
    ctx.font = 'bold 30px Helvetica, Arial';
    const text = names[index].name;

    // Highlight the winner on the wheel? Maybe just show text below.
    resultDiv.textContent = `Winner: ${text}`;
    resultDiv.classList.add('show');
    resultDiv.classList.remove('hidden');

    spinBtn.disabled = false;
    ctx.restore();
}

function easeIn(t, b, c, d) {
    t /= d;
    return c * t * t * t + b;
}

function easeOut(t, b, c, d) {
    t /= d;
    t--;
    return c * (t * t * t * t * t + 1) + b;
}

function playTick() {
    if (!audioCtx || !isSoundEnabled) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    osc.type = 'square';
    osc.frequency.setValueAtTime(1000, audioCtx.currentTime);

    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + 0.05);

    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
}

function spin() {
    if (names.length === 0) {
        alert("Please add at least one name to the wheel!");
        return;
    }

    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    lastSoundIndex = Math.floor(startAngle / arc);

    spinBtn.disabled = true;
    resultDiv.classList.remove('show');
    resultDiv.classList.add('hidden');
    winningIndex = -1;

    spinAngleStart = Math.random() * 10 + 10; // 10 to 20 degrees per 15ms
    spinTime = 0;
    startTime = null;
    lastFrameTime = null;
    accelerationTime = 3000; // 3 seconds acceleration
    spinTimeTotal = 12000; // 15 seconds total
    requestAnimationFrame(rotateWheel);
}

function updateWheel() {
    winningIndex = -1;
    arc = Math.PI / (names.length / 2);
    drawRouletteWheel();
}


function addName() {
    const name = nameInput.value.trim();
    if (name) {
        participantsRef.add({
            name: name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });
        nameInput.value = '';
    }
}

function removeName(index) {
    if (names[index] && names[index].id) {
        participantsRef.doc(names[index].id).delete();
    }
}


// Expose removeName to global scope for onclick
window.removeName = removeName;

spinBtn.addEventListener('click', spin);
addBtn.addEventListener('click', addName);
nameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        addName();
    }
});

// Canvas click handler for X buttons
canvas.addEventListener('click', (e) => {
    if (spinBtn.disabled) return; // Don't allow clicking while spinning

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = 250;
    const centerY = 250;
    const closeButtonRadius = OUTSIDE_RADIUS + 10;
    const buttonSize = 15; // Hit area radius

    for (let i = 0; i < names.length; i++) {
        const angle = startAngle + i * arc + arc / 2;
        const btnX = centerX + Math.cos(angle) * closeButtonRadius;
        const btnY = centerY + Math.sin(angle) * closeButtonRadius;

        const dist = Math.sqrt((x - btnX) ** 2 + (y - btnY) ** 2);
        if (dist < buttonSize) {
            removeName(i);
            return;
        }
    }
});

// Change cursor on hover over X buttons
canvas.addEventListener('mousemove', (e) => {
    if (spinBtn.disabled) {
        canvas.style.cursor = 'default';
        return;
    }

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = 250;
    const centerY = 250;
    const closeButtonRadius = OUTSIDE_RADIUS + 10;
    const buttonSize = 15;

    let newHoveredIndex = -1;
    for (let i = 0; i < names.length; i++) {
        const angle = startAngle + i * arc + arc / 2;
        const btnX = centerX + Math.cos(angle) * closeButtonRadius;
        const btnY = centerY + Math.sin(angle) * closeButtonRadius;

        const dist = Math.sqrt((x - btnX) ** 2 + (y - btnY) ** 2);
        if (dist < buttonSize) {
            newHoveredIndex = i;
            break;
        }
    }

    canvas.style.cursor = newHoveredIndex !== -1 ? 'pointer' : 'default';

    if (newHoveredIndex !== hoveredNameIndex) {
        hoveredNameIndex = newHoveredIndex;
        drawRouletteWheel();
    }
});

canvas.addEventListener('mouseleave', () => {
    if (hoveredNameIndex !== -1) {
        hoveredNameIndex = -1;
        drawRouletteWheel();
    }
});

soundBtn.addEventListener('click', () => {
    isSoundEnabled = !isSoundEnabled;
    if (isSoundEnabled) {
        soundBtn.textContent = "🔊";
        soundBtn.classList.remove('muted');
        // Resume context if it was suspended (though spin handles this too)
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    } else {
        soundBtn.textContent = "🔇";
        soundBtn.classList.add('muted');
    }
});

paletteBtn.addEventListener('click', () => {
    if (activeColors === SEGMENT_COLORS) {
        activeColors = SEGMENT_COLORS2;
        paletteBtn.classList.remove('palette-def');
        paletteBtn.classList.add('palette-alt');
    } else {
        activeColors = SEGMENT_COLORS;
        paletteBtn.classList.remove('palette-alt');
        paletteBtn.classList.add('palette-def');
    }
    drawRouletteWheel();
});

const createTeamBtn = document.getElementById('create-team-btn');
if (createTeamBtn) {
    createTeamBtn.addEventListener('click', () => {
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        window.location.search = `?team=${code}`;
    });
}

// Initial draw
if (activeColors === SEGMENT_COLORS) {
    paletteBtn.classList.add('palette-def');
} else {
    paletteBtn.classList.add('palette-alt');
}
updateWheel();

if (soundBtn && !isSoundEnabled) {
    soundBtn.textContent = "🔇";
    soundBtn.classList.add('muted');
}
