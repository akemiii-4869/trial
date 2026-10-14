// Pinoy Quest: Philippine Quiz Snakes & Ladders (JavaScript Engine)

// ==========================================
// MULTIPLAYER FIREBASE CONFIGURATION
// ==========================================
const firebaseConfig = {
    apiKey: "AIzaSyDVvAmovZJVFdPfkcc3pwlE1iwlYQOWIGk",
    authDomain: "snake-and-ladder-5319f.firebaseapp.com",
    databaseURL: "https://snake-and-ladder-5319f-default-rtdb.firebaseio.com",
    projectId: "snake-and-ladder-5319f",
    storageBucket: "snake-and-ladder-5319f.firebasestorage.app",
    messagingSenderId: "1039047969635",
    appId: "1:1039047969635:web:ec8fa82d7883a347316156",
    measurementId: "G-3P7JMECBVB"
};

// Initialize Firebase (Compat mode matches our database functions)
firebase.initializeApp(firebaseConfig);
const db = firebase.database();
let currentRoomId = null;
let myPlayerId = null; // 0, 1, 2, or 3 based on join order
let isMultiplayer = false;

// ==========================================
// 1. GAME CONFIGURATION & STATE VARIABLES
// ==========================================
let selectedPlayerCount = 2;
let players = [];
let currentPlayerIdx = 0;
let gameActive = false;
let isRolling = false;
let previousTile = 1;

//reset request
const modalResetRequestEl = document.getElementById('modal-reset-request');
const resetRequestTextEl = document.getElementById('reset-request-text');
const btnAcceptResetEl = document.getElementById('btn-accept-reset');
const btnDeclineResetEl = document.getElementById('btn-decline-reset');



const modalWaitingResetEl = document.getElementById('modal-waiting-reset');
const modalGameAlertEl = document.getElementById('modal-game-alert');
const gameAlertTitleEl = document.getElementById('game-alert-title');
const gameAlertMessageEl = document.getElementById('game-alert-message');
const btnCloseGameAlertEl = document.getElementById('btn-close-game-alert');

if (btnCloseGameAlertEl) {
    btnCloseGameAlertEl.addEventListener('click', () => {
        if (modalGameAlertEl) modalGameAlertEl.classList.add('hidden');
    });
}

function showGameAlert(message, title = "Notice") {
    if (gameAlertTitleEl) gameAlertTitleEl.textContent = title;
    if (gameAlertMessageEl) gameAlertMessageEl.textContent = message;
    if (modalGameAlertEl) modalGameAlertEl.classList.remove('hidden');
}
// Active Board Layout (Dynamically Generated per Game)
let LADDERS = {};
let SNAKES = {};
let QUIZ_TILES = [];

// Function to Host an Online Room
function createOnlineRoom() {
    currentRoomId = "ROOM_" + Math.random().toString(36).substring(2, 7).toUpperCase();
    isMultiplayer = true;
    myPlayerId = 0;

    const roomRef = db.ref('rooms/' + currentRoomId);
    
    roomRef.set({
        gameActive: false,
        currentPlayerIdx: 0,
        boardLayout: { ladders: LADDERS, snakes: SNAKES, quizTiles: QUIZ_TILES },
        players: [
            { id: 0, name: "Host (P1)", avatar: "🇵🇭", position: 1, color: "#f59e0b", isAI: false }
        ],
        logs: ["🌐 Room created successfully."] // Added initial log
    });

    listenToRoom(currentRoomId);
    showGameAlert(`Room Created! Share Code: ${currentRoomId}`, "Multiplayer Room");
}

// Function to Join an Existing Room
function joinOnlineRoom(roomId) {
    currentRoomId = roomId;
    isMultiplayer = true;

    const roomRef = db.ref('rooms/' + currentRoomId);
    roomRef.once('value', (snapshot) => {
        const roomData = snapshot.val();
        if (!roomData) {
            showGameAlert("Room not found!", "Error");
            return;
        }

        myPlayerId = roomData.players.length; // Assign next index (1, 2, or 3)
        
        // Push new player into room data
        roomData.players.push({
            id: myPlayerId,
            name: `Player ${myPlayerId + 1}`,
            avatar: ['🇵🇭', '🦅', '🌋', '🥭'][myPlayerId],
            position: 1,
            color: ['#f59e0b', '#3b82f6', '#10b981', '#ec4899'][myPlayerId],
            isAI: false
        });

        roomRef.update({ players: roomData.players });
        listenToRoom(currentRoomId);
    });
}

// Turn notification: shows only on a real turn change, not every Firebase update.
let lastNotifiedTurnKey = null;
let turnToastTimer = null;
function showTurnToast(player, mine) {
    const toast = document.getElementById('turn-toast');
    if (!toast || !player) return;
    document.getElementById('turn-toast-icon').textContent = mine ? '🎲' : '⏳';
    document.getElementById('turn-toast-title').textContent = mine ? 'YOUR TURN!' : `${player.name}'S TURN`;
    document.getElementById('turn-toast-detail').textContent = mine
        ? `${player.name}, roll the dice!` : `Waiting for ${player.name} to play.`;
    if (turnToastTimer) clearTimeout(turnToastTimer);
    toast.hidden = false;
    requestAnimationFrame(() => toast.classList.add('visible'));
    turnToastTimer = setTimeout(() => {
        toast.classList.remove('visible');
        setTimeout(() => { if (!toast.classList.contains('visible')) toast.hidden = true; }, 250);
    }, 2400);
}
function notifyTurnIfChanged() {
    if (!gameActive || !players.length) return;
    const player = players[currentPlayerIdx];
    if (!player) return;
    const key = `${currentPlayerIdx}:${turnNotificationEpoch}`;
    if (lastNotifiedTurnKey === key) return;
    lastNotifiedTurnKey = key;
    showTurnToast(player, !player.isAI && (!isMultiplayer || currentPlayerIdx === myPlayerId));
}
let turnNotificationEpoch = 0;
function showWinner(player) {
    if (!player) return;
    const winnerNameEl = document.getElementById('winner-name');
    if (winnerNameEl) winnerNameEl.textContent = `${player.name} (${player.avatar || '🏆'}) wins!`;
    if (modalVictoryEl) modalVictoryEl.classList.remove('hidden');
}
// Real-time Listener: Syncs changes from Firebase down to the local browser window
let previousPlayersCount = 0; // Tracks previous active player count to detect departures

function listenToRoom(roomId) {
    const roomRef = db.ref('rooms/' + roomId);
    const myPlayerRef = db.ref(`rooms/${roomId}/players/${myPlayerId}`);

    myPlayerRef.child('online').onDisconnect().set(false);
    myPlayerRef.child('online').set(true);

    roomRef.on('value', (snapshot) => {
        const data = snapshot.val();
        if (!data) return;

        const currentPlayers = data.players || [];

        currentPlayers.forEach((p, idx) => {
            if (p && p.online === false && players[idx] && players[idx].online !== false) {
                // Handle departures if needed
            }
        });

        players = currentPlayers;
        currentPlayerIdx = data.currentPlayerIdx || 0;
        gameActive = data.gameActive || false;
        if (data.winner !== undefined && data.winner !== null && data.winner !== '') {
            const winningPlayer = players.find(p => p && String(p.id) === String(data.winner));
            showWinner(winningPlayer || { name: data.winnerName || 'Player', avatar: '🏆' });
        } else if (gameActive && modalVictoryEl) {
            modalVictoryEl.classList.add('hidden');
        }

        if (data.boardLayout) {
            LADDERS = data.boardLayout.ladders || {};
            SNAKES = data.boardLayout.snakes || {};
            QUIZ_TILES = data.boardLayout.quizTiles || [];
        }

        // Synchronize and render logs across all devices
        if (data.logs && gameLogEl) {
            gameLogEl.innerHTML = '';
            data.logs.forEach(msg => {
                appendLogToDOM(msg);
            });
        }

        // --- HANDLE MULTIPLAYER RESTART REQUESTS & MODAL ---
     // --- HANDLE MULTIPLAYER RESTART REQUESTS & MODALS ---
       // --- HANDLE MULTIPLAYER RESTART REQUESTS & MODALS ---
        const resetReq = data.resetRequest;
        if (resetReq) {
            const requesterId = resetReq.requestedBy;
            const votes = resetReq.votes || {};

            if (requesterId === myPlayerId) {
                // Requester sees the waiting modal
                if (modalWaitingResetEl) modalWaitingResetEl.classList.remove('hidden');
                if (modalResetRequestEl) modalResetRequestEl.classList.add('hidden');
            } else {
                if (votes[myPlayerId] === undefined) {
                    // Player has NOT voted yet: show Accept/Decline modal
                    if (resetRequestTextEl) {
                        resetRequestTextEl.textContent = `${resetReq.requesterName} wants to restart the game. Do you accept?`;
                    }
                    if (modalResetRequestEl) modalResetRequestEl.classList.remove('hidden');
                    if (modalWaitingResetEl) modalWaitingResetEl.classList.add('hidden');
                } else {
                    // Player HAS voted (accepted): hide request modal and show waiting modal
                    if (modalResetRequestEl) modalResetRequestEl.classList.add('hidden');
                    if (modalWaitingResetEl) modalWaitingResetEl.classList.remove('hidden');
                }
            }

            // Check if all online/active players have accepted the vote
            const activePlayers = players.filter(p => p && p.online !== false);
            const totalActive = activePlayers.length;
            const acceptedVotes = Object.values(votes).filter(v => v === true).length;

            // Only the original requester executes the reset when all votes are collected
            if (requesterId === myPlayerId && acceptedVotes >= totalActive && totalActive > 0) {
                if (modalWaitingResetEl) modalWaitingResetEl.classList.add('hidden');
                executeActualReset();
            }
        } else {
            // Hide both modals if the request was canceled, declined, or completed
            if (modalResetRequestEl) modalResetRequestEl.classList.add('hidden');
            if (modalWaitingResetEl) modalWaitingResetEl.classList.add('hidden');
        }

        const currentTurnPlayer = players[currentPlayerIdx];
        if (gameActive && currentTurnPlayer && currentTurnPlayer.online === false) {
            if (myPlayerId === 0) {
                endTurn();
            }
        }

        initBoard();
        updateUI();
        drawBoardOverlays();
        // Only notify on an actual multiplayer turn change.
        if (gameActive && lastMultiplayerTurn !== currentPlayerIdx) {
            lastMultiplayerTurn = currentPlayerIdx;
            notifyTurnIfChanged();
        }
    });
}
let lastMultiplayerTurn = null;
// Function to push local actions (like rolling dice) up to Firebase
// Function to push specific local player changes up to Firebase safely
function syncPlayerPositionToFirebase(playerIndex, newPosition) {
    if (!isMultiplayer || !currentRoomId) return;

    db.ref(`rooms/${currentRoomId}/players/${playerIndex}`).update({
        position: newPosition
    });
}

function syncGameStateToFirebase() {
    if (!isMultiplayer || !currentRoomId) return;

    db.ref('rooms/' + currentRoomId).update({
        currentPlayerIdx: currentPlayerIdx,
        gameActive: gameActive
    });
}

const LADDER_PAIRS = [
    { start: 4, end: 14 },
    { start: 9, end: 31 },
    { start: 20, end: 38 },
    { start: 28, end: 84 },
    { start: 40, end: 59 },
    { start: 51, end: 67 },
    { start: 63, end: 81 },
    { start: 71, end: 91 }
];

const SNAKE_PAIRS = [
    { head: 17, tail: 7 },
    { head: 34, tail: 12 },
    { head: 54, tail: 36 },
    { head: 62, tail: 19 },
    { head: 64, tail: 60 },
    { head: 87, tail: 24 },
    { head: 93, tail: 73 },
    { head: 98, tail: 79 }
];

// Available Avatars
const AVATARS = ['🇵🇭', '🦅', '🌋', '🥭', '🛺', '🥥', '☀️', '⛵'];

let QUESTION_BANK = { easy: [], medium: [], hard: [], hardest: [] };
let remainingQuestionsDeck = [];
let activeQuizTimer = null;
let currentQuizData = null;
let pendingSnakeTail = null; // Tracks snake slide destination if quiz is failed

// ==========================================
// 2. WEB AUDIO API SYNTHESIZER
// ==========================================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playSFX(type) {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    const now = audioCtx.currentTime;

    if (type === 'roll') {
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, now);
        osc.frequency.exponentialRampToValueAtTime(400, now + 0.15);
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
        osc.start(now);
        osc.stop(now + 0.15);
    } else if (type === 'ladder') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(261.63, now);
        osc.frequency.exponentialRampToValueAtTime(523.25, now + 0.4);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
    } else if (type === 'snake') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(400, now);
        osc.frequency.exponentialRampToValueAtTime(120, now + 0.5);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
    } else if (type === 'correct') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now);
        osc.frequency.setValueAtTime(659.25, now + 0.1);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
        osc.start(now);
        osc.stop(now + 0.3);
    } else if (type === 'wrong') {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(220, now);
        osc.frequency.setValueAtTime(164.81, now + 0.15);
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
    } else if (type === 'victory') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(440, now);
        osc.frequency.setValueAtTime(554.37, now + 0.15);
        osc.frequency.setValueAtTime(659.25, now + 0.3);
        gain.gain.setValueAtTime(0.4, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
        osc.start(now);
        osc.stop(now + 0.6);
    }
}

// ==========================================
// 3. DOM ELEMENT REFERENCES
// ==========================================
const boardGridEl = document.getElementById('board-grid');
const ladderCanvasEl = document.getElementById('ladder-canvas');
const scoreboardListEl = document.getElementById('scoreboard-list');
const gameLogEl = document.getElementById('game-log');
const activeAvatarEl = document.getElementById('p-avatar');
const activeNameEl = document.getElementById('p-name');
const activePosEl = document.getElementById('p-pos');
const activeTypeEl = document.getElementById('p-type');
const diceEl = document.getElementById('dice');
const btnRollEl = document.getElementById('btn-roll');

const modalSetupEl = document.getElementById('modal-setup');
const modalQuizEl = document.getElementById('modal-quiz');
const modalVictoryEl = document.getElementById('modal-victory');
const playerInputsContainer = document.getElementById('player-inputs-container');
const btnStartGame = document.getElementById('btn-start-game');
const btnSetupEl = document.getElementById('btn-setup');
const btnResetEl = document.getElementById('btn-reset');
const btnVictoryRestart = document.getElementById('btn-victory-restart');
const btnVictoryNewGame = document.getElementById('btn-victory-new-game');

const quizQuestionEl = document.getElementById('quiz-question');
const quizOptionsEl = document.getElementById('quiz-options');
const quizTimerBar = document.getElementById('quiz-timer-bar');
const quizTimerText = document.getElementById('quiz-timer-text');

// ==========================================
// 4. INITIALIZATION & EVENT LISTENERS
// ==========================================
document.addEventListener('DOMContentLoaded', async () => {
    await loadQuestions();

    const urlParams = new URLSearchParams(window.location.search);
    const activeRoomCode = urlParams.get('room');
    const playerFromUrl = urlParams.get('player');

    if (activeRoomCode) {
        isMultiplayer = true;
        currentRoomId = activeRoomCode;
        myPlayerId = parseInt(playerFromUrl) || 0;

        logMessage(`🌐 Connected to Room: <strong>${activeRoomCode}</strong>`);
        
        // Hide local setup modal since room config is handled via Firebase
        if (modalSetupEl) modalSetupEl.classList.add('hidden');
        
        // Listen to room updates
        listenToRoom(activeRoomCode);
    } else {
        generateRandomBoardLayout();
        initBoard();
        renderSetupModalInputs();
    }

    setupEventListeners();
});

function generateRandomBoardLayout() {
    LADDERS = {};
    SNAKES = {};
    QUIZ_TILES = [];

    const shuffle = (array) => {
        const arr = [...array];
        for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [arr[i], arr[j]] = [arr[j], arr[i]];
        }
        return arr;
    };

    // Carefully spaced fixed connections: no crossing or overlapping paths.
    // Dice, quiz selection, player movement and multiplayer rules remain unchanged.
    LADDERS = { 2:20, 5:16, 11:31, 18:40, 23:38, 35:56, 48:68, 60:80 };
    SNAKES  = { 32:12, 44:25, 58:42, 69:51, 78:64, 85:65, 90:72, 96:81 };

    const occupiedTiles = new Set([1, 100, ...Object.keys(LADDERS).map(Number), ...Object.values(LADDERS), ...Object.keys(SNAKES).map(Number), ...Object.values(SNAKES)]);
    let availableTiles = [];
    for (let i = 2; i < 100; i++) {
        if (!occupiedTiles.has(i)) {
            availableTiles.push(i);
        }
    }

    availableTiles = shuffle(availableTiles);
    QUIZ_TILES = availableTiles.slice(0, 42);
}

async function loadQuestions() {
    try {
        const response = await fetch('questions.json');
        QUESTION_BANK = await response.json();
    } catch (error) {
        console.error('Failed to load questions.json, using fallback.', error);
    }
}

function renderSetupModalInputs() {
    if (!playerInputsContainer) return;
    playerInputsContainer.innerHTML = '';
    for (let i = 0; i < selectedPlayerCount; i++) {
        const pRow = document.createElement('div');
        pRow.className = 'flex items-center gap-3 bg-slate-900 p-3 rounded-xl border border-slate-700';

        pRow.innerHTML = `
            <select class="p-avatar-select bg-slate-800 text-xl p-1 rounded border border-slate-600 focus:outline-none">
                ${AVATARS.map((av, idx) => `<option value="${av}" ${idx === i ? 'selected' : ''}>${av}</option>`).join('')}
            </select>
            <input type="text" class="p-name-input bg-slate-800 text-sm font-semibold text-slate-100 px-3 py-1.5 rounded border border-slate-600 w-full focus:outline-none" value="Player ${i + 1}">
            <button type="button" class="p-type-btn bg-slate-800 text-xs font-bold text-blue-400 border border-blue-500/40 px-3 py-2 rounded-lg w-28" data-is-ai="${i > 0 ? 'true' : 'false'}">
                ${i > 0 ? '🤖 BOT AI' : '👤 HUMAN'}
            </button>
        `;
        playerInputsContainer.appendChild(pRow);
    }

    document.querySelectorAll('.p-type-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const isAI = e.target.getAttribute('data-is-ai') === 'true';
            if (isAI) {
                e.target.setAttribute('data-is-ai', 'false');
                e.target.textContent = '👤 HUMAN';
                e.target.className = 'p-type-btn bg-slate-800 text-xs font-bold text-blue-400 border border-blue-500/40 px-3 py-2 rounded-lg w-28';
            } else {
                e.target.setAttribute('data-is-ai', 'true');
                e.target.textContent = '🤖 BOT AI';
                e.target.className = 'p-type-btn bg-slate-800 text-xs font-bold text-emerald-400 border border-emerald-500/40 px-3 py-2 rounded-lg w-28';
            }
        });
    });
}

function setupEventListeners() {
    document.querySelectorAll('.btn-count').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.btn-count').forEach(b => b.classList.remove('active-count'));
            e.target.classList.add('active-count');
            selectedPlayerCount = parseInt(e.target.getAttribute('data-count'));
            renderSetupModalInputs();
        });
    });
if (btnAcceptResetEl) {
    btnAcceptResetEl.addEventListener('click', handleAcceptReset);
}
if (btnDeclineResetEl) {
    btnDeclineResetEl.addEventListener('click', handleDeclineReset);
}
    if (btnStartGame) btnStartGame.addEventListener('click', startGame);
    if (btnRollEl) btnRollEl.addEventListener('click', handleRollClick);
    if (btnSetupEl) btnSetupEl.addEventListener('click', () => modalSetupEl.classList.remove('hidden'));
    if (btnResetEl) btnResetEl.addEventListener('click', resetGame);
    if (btnVictoryRestart) btnVictoryRestart.addEventListener('click', () => {
        if (!isMultiplayer || !currentRoomId) modalVictoryEl.classList.add('hidden');
        resetGame(); // Multiplayer continues to use the existing restart approval flow.
    });

    // Start a fresh match with a new player setup. Existing online rooms must
    // not be reset unilaterally; return to the lobby to create/join a new room.
    if (btnVictoryNewGame) btnVictoryNewGame.addEventListener('click', () => {
        if (isMultiplayer && currentRoomId) {
            window.location.assign('index.html');
            return;
        }
        gameActive = false;
        isRolling = false;
        players = [];
        currentPlayerIdx = 0;
        previousTile = 1;
        generateRandomBoardLayout();
        initBoard();
        renderSetupModalInputs();
        updateUI();
        if (gameLogEl) gameLogEl.innerHTML = '';
        if (modalVictoryEl) modalVictoryEl.classList.add('hidden');
        if (modalSetupEl) modalSetupEl.classList.remove('hidden');
        setTimeout(drawBoardOverlays, 100);
    });

    window.addEventListener('resize', drawBoardOverlays);
}

// ==========================================
// 5. BOARD GRID & OVERLAY RENDERER
// ==========================================
function initBoard() {
    if (!boardGridEl) return;
    boardGridEl.innerHTML = '';
    for (let r = 10; r >= 1; r--) {
        const isEvenRow = (r % 2 === 0);
        for (let c = 1; c <= 10; c++) {
            let tileNum;
            if (isEvenRow) {
                tileNum = (r - 1) * 10 + (11 - c);
            } else {
                tileNum = (r - 1) * 10 + c;
            }

            const tileEl = document.createElement('div');
            tileEl.id = `tile-${tileNum}`;
            tileEl.className = 'board-tile bg-slate-900 border border-slate-700/60 relative flex flex-col justify-between p-1 select-none';

            const numSpan = document.createElement('span');
            numSpan.className = 'text-[10px] font-bold text-slate-400';
            numSpan.textContent = tileNum;
            tileEl.appendChild(numSpan);

            if (SNAKES[tileNum]) {
                const snakeBadge = document.createElement('span');
                snakeBadge.className = 'text-[9px] font-extrabold text-rose-400 bg-rose-500/20 px-1 py-0.5 rounded self-start mt-0.5';
                snakeBadge.textContent = `🐍 TO ${SNAKES[tileNum]}`;
                tileEl.appendChild(snakeBadge);
            } else if (LADDERS[tileNum]) {
                const ladderBadge = document.createElement('span');
                ladderBadge.className = 'text-[9px] font-extrabold text-emerald-400 bg-emerald-500/20 px-1 py-0.5 rounded self-start mt-0.5';
                ladderBadge.textContent = `🪜 TO ${LADDERS[tileNum]}`;
                tileEl.appendChild(ladderBadge);
            } else if (QUIZ_TILES.includes(tileNum) && tileNum !== 100) {
                const quizBadge = document.createElement('span');
                quizBadge.className = 'text-[9px] font-extrabold text-amber-400 bg-amber-500/20 px-1 py-0.5 rounded quiz-tile-glow self-start mt-0.5';
                quizBadge.textContent = '❓ QUIZ';
                tileEl.appendChild(quizBadge);
            }

            const tokenContainer = document.createElement('div');
            tokenContainer.id = `tokens-${tileNum}`;
            tokenContainer.className = 'token-container mt-auto';
            tileEl.appendChild(tokenContainer);

            boardGridEl.appendChild(tileEl);
        }
    }
}

function drawBoardOverlays() {
    if (!ladderCanvasEl || !boardGridEl) return;
    ladderCanvasEl.innerHTML = '';
    const rectBoard = boardGridEl.getBoundingClientRect();
    
    Object.keys(LADDERS).forEach(start => {
        const end = LADDERS[start];
        const startEl = document.getElementById(`tile-${start}`);
        const endEl = document.getElementById(`tile-${end}`);
        
        if (startEl && endEl) {
            const rStart = startEl.getBoundingClientRect();
            const rEnd = endEl.getBoundingClientRect();

            const x1 = rStart.left + rStart.width / 2 - rectBoard.left;
            const y1 = rStart.top + rStart.height / 2 - rectBoard.top;
            const x2 = rEnd.left + rEnd.width / 2 - rectBoard.left;
            const y2 = rEnd.top + rEnd.height / 2 - rectBoard.top;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', '#10b981');
            line.setAttribute('stroke-width', '4');
            line.setAttribute('stroke-dasharray', '6 4');
            line.setAttribute('opacity', '0.75');

            ladderCanvasEl.appendChild(line);
        }
    });

    Object.keys(SNAKES).forEach(head => {
        const tail = SNAKES[head];
        const headEl = document.getElementById(`tile-${head}`);
        const tailEl = document.getElementById(`tile-${tail}`);
        
        if (headEl && tailEl) {
            const rHead = headEl.getBoundingClientRect();
            const rTail = tailEl.getBoundingClientRect();

            const x1 = rHead.left + rHead.width / 2 - rectBoard.left;
            const y1 = rHead.top + rHead.height / 2 - rectBoard.top;
            const x2 = rTail.left + rTail.width / 2 - rectBoard.left;
            const y2 = rTail.top + rTail.height / 2 - rectBoard.top;

            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x1);
            line.setAttribute('y1', y1);
            line.setAttribute('x2', x2);
            line.setAttribute('y2', y2);
            line.setAttribute('stroke', '#f43f5e');
            line.setAttribute('stroke-width', '4');
            line.setAttribute('opacity', '0.8');

            ladderCanvasEl.appendChild(line);
        }
    });
}

// ==========================================
// 6. QUESTION DECK & TRIVIA MANAGEMENT
// ==========================================
function prepareRumbledDeck() {
    const shuffleArray = (arr) => {
        const copied = [...arr];
        for (let i = copied.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [copied[i], copied[j]] = [copied[j], copied[i]];
        }
        return copied;
    };

    const rumbledEasy = shuffleArray(QUESTION_BANK.easy || []);
    const rumbledMedium = shuffleArray(QUESTION_BANK.medium || []);
    const rumbledHard = shuffleArray(QUESTION_BANK.hard || []);

    remainingQuestionsDeck = [...rumbledEasy, ...rumbledMedium, ...rumbledHard];
}

function drawNextQuestion() {
    if (remainingQuestionsDeck.length === 0) {
        prepareRumbledDeck();
    }
    return remainingQuestionsDeck.pop();
}

function drawHardestquestion() {
    const hardestPool = QUESTION_BANK.hardest || [];
    if (hardestPool.length > 0) {
        const randomIndex = Math.floor(Math.random() * hardestPool.length);
        return hardestPool[randomIndex];
    }
    return drawNextQuestion();
}

// ==========================================
// 7. CORE GAMEPLAY LOGIC & TURN ENGINE
// ==========================================
function startGame() {
    const avatarSelects = document.querySelectorAll('.p-avatar-select');
    const nameInputs = document.querySelectorAll('.p-name-input');
    const typeBtns = document.querySelectorAll('.p-type-btn');

    players = [];
    for (let i = 0; i < selectedPlayerCount; i++) {
        players.push({
            id: i,
            name: nameInputs[i] ? nameInputs[i].value.trim() || `Player ${i + 1}` : `Player ${i + 1}`,
            avatar: avatarSelects[i] ? avatarSelects[i].value : AVATARS[i],
            isAI: typeBtns[i] ? typeBtns[i].getAttribute('data-is-ai') === 'true' : (i > 0),
            position: 1,
            color: getPlayerColor(i)
        });
    }

    prepareRumbledDeck();
    currentPlayerIdx = 0;
    gameActive = true;
    if (modalSetupEl) modalSetupEl.classList.add('hidden');
    
    logMessage(`Game started with ${selectedPlayerCount} players! Roll the dice to move.`);
    updateUI();
    setTimeout(drawBoardOverlays, 100);
    syncGameStateToFirebase();
    if (!isMultiplayer) notifyTurnIfChanged();
}

function getPlayerColor(idx) {
    const colors = ['#f59e0b', '#3b82f6', '#10b981', '#ec4899'];
    return colors[idx % colors.length];
}

function handleRollClick() {
    if (!gameActive || isRolling) return;
    
    if (isMultiplayer && currentPlayerIdx !== myPlayerId) {
        showGameAlert("It's not your turn yet!", "Hold On");
        return;
    }

    const p = players[currentPlayerIdx];
    if (p && p.isAI) return;

    executeTurn();
}

function executeTurn() {
    isRolling = true;
    if (btnRollEl) btnRollEl.disabled = true;
    if (diceEl) diceEl.classList.add('dice-rolling');
    playSFX('roll');

    setTimeout(() => {
        const roll = Math.floor(Math.random() * 6) + 1;
        if (diceEl) {
            diceEl.textContent = getDiceEmoji(roll);
            diceEl.classList.remove('dice-rolling');
        }

        const p = players[currentPlayerIdx];
        if (!p) return;
        previousTile = p.position;
        logMessage(`${p.name} rolled a <strong>${roll}</strong>.`);

        if (p.position + roll > 100) {
            logMessage(`${p.name} needs an exact roll to land on 100! Turn skipped.`);
            endTurn();
        } else {
            movePlayerSteps(p, roll);
        }
    }, 600);
}

function getDiceEmoji(val) {
    const diceIcons = ['⚀ 1', '⚁ 2', '⚂ 3', '⚃ 4', '⚄ 5', '⚅ 6'];
    return diceIcons[val - 1] || val;
}

function movePlayerSteps(player, steps) {
    player.position += steps;
    updateUI();
    
    // Sync ONLY this player's position directly to Firebase to avoid array conflicts
    syncPlayerPositionToFirebase(player.id, player.position);

    const currentTile = player.position;

    if (currentTile === 100) {
        gameActive = false;
        playSFX('victory');
        const winnerNameEl = document.getElementById('winner-name');
        showWinner(player);
        if (isMultiplayer && currentRoomId) {
            db.ref(`rooms/${currentRoomId}`).update({ winner: player.id, winnerName: player.name });
        }
        syncGameStateToFirebase();
        return;
    }

    const isMyTurn = (!isMultiplayer || currentPlayerIdx === myPlayerId);

    if (SNAKES[currentTile]) {
        setTimeout(() => {
            playSFX('snake');
            pendingSnakeTail = SNAKES[currentTile];
            logMessage(`🐍 Oh no! ${player.name} stepped on a snake head at tile ${currentTile}! Answer a <strong>HARDEST</strong> question correctly to avoid sliding down!`);
            
            if (isMyTurn) {
                triggerSnakeQuizModal(player);
            }
        }, 500);
    } 
    else if (LADDERS[currentTile]) {
        setTimeout(() => {
            playSFX('ladder');
            const dest = LADDERS[currentTile];
            logMessage(`🪜 ${player.name} climbed a ladder from ${currentTile} to <strong>${dest}</strong>!`);
            player.position = dest;
            updateUI();
            syncPlayerPositionToFirebase(player.id, player.position); // <--- Sync ladder jump
            
            if (isMyTurn) {
                checkTileAction(player);
            } else {
                endTurn();
            }
        }, 500);
    } else {
        if (isMyTurn) {
            checkTileAction(player);
        } else {
            endTurn();
        }
    }
}

function checkTileAction(player) {
    const currentTile = player.position;

    if (QUIZ_TILES.includes(currentTile)) {
        setTimeout(() => {
            triggerQuizModal(player);
        }, 400);
    } else {
        setTimeout(endTurn, 500);
    }
}
function handleQuizTimeout(player, isSnakeBite) {
    playSFX('wrong');
    if (modalQuizEl) modalQuizEl.classList.add('hidden');

    if (isSnakeBite) {
        logMessage(`⌛ ${player.name} ran out of time on the hardest snake question! Sliding down to Tile <strong>${pendingSnakeTail}</strong>.`);
        player.position = pendingSnakeTail;
    } else {
        logMessage(`⌛ ${player.name} ran out of time! Returning to Tile ${previousTile}.`);
        player.position = previousTile;
    }

    updateUI();
    syncPlayerPositionToFirebase(player.id, player.position);
    pendingSnakeTail = null; // Clear pending state
    endTurn();
}

function submitAnswer(chosenIdx, player, isSnakeBite = false) {
    if (activeQuizTimer) clearInterval(activeQuizTimer);

    const isCorrect = (chosenIdx === currentQuizData.ans);
    if (modalQuizEl) modalQuizEl.classList.add('hidden');

    if (isCorrect) {
        playSFX('correct');
        if (isSnakeBite) {
            logMessage(`✅ ${player.name} answered the hardest snake question correctly! They bravely resisted the slide and stay on Tile ${player.position}!`);
        } else {
            logMessage(`✅ ${player.name} answered correctly! Stays on Tile ${player.position}.`);
        }
    } else {
        playSFX('wrong');
        if (isSnakeBite) {
            logMessage(`❌ ${player.name} failed the hardest question! Sliding down to Tile <strong>${pendingSnakeTail}</strong>.`);
            player.position = pendingSnakeTail; // Move down to snake tail
        } else {
            logMessage(`❌ ${player.name} gave an incorrect answer! Going back to Tile ${previousTile}.`);
            player.position = previousTile; // Return to pre-roll tile
        }
        updateUI();
    }

    syncPlayerPositionToFirebase(player.id, player.position);
    pendingSnakeTail = null; // Clear pending state
    endTurn();
}
function checkTileAction(player) {
    const currentTile = player.position;

    if (QUIZ_TILES.includes(currentTile)) {
        setTimeout(() => {
            triggerQuizModal(player);
        }, 400);
    } else {
        setTimeout(endTurn, 500);
    }
}

// ==========================================
// 8. TRIVIA QUIZ MODAL & TIMER ENGINE
// ==========================================
function triggerQuizModal(player) {
    currentQuizData = drawNextQuestion();
    setupQuizUI(player, false);
}

function triggerSnakeQuizModal(player) {
    currentQuizData = drawHardestquestion();
    setupQuizUI(player, true);
}

function setupQuizUI(player, isSnakeBite) {
    if (quizQuestionEl) quizQuestionEl.textContent = `[${isSnakeBite ? '⚠️ SNAKE BITE - HARDEST' : 'TRIVIA'}] ${currentQuizData.q}`;
    if (quizOptionsEl) quizOptionsEl.innerHTML = '';

    currentQuizData.options.forEach((optText, idx) => {
        const optBtn = document.createElement('button');
        optBtn.className = 'quiz-opt-btn bg-slate-700 hover:bg-amber-500 hover:text-slate-950 text-slate-100 font-semibold p-3 rounded-xl text-left text-sm transition border border-slate-600';
        optBtn.textContent = `${['A', 'B', 'C', 'D'][idx]}. ${optText}`;
        optBtn.addEventListener('click', () => submitAnswer(idx, player, isSnakeBite));
        if (quizOptionsEl) quizOptionsEl.appendChild(optBtn);
    });

    if (modalQuizEl) modalQuizEl.classList.remove('hidden');
    startQuizTimer(15, player, player.isAI, isSnakeBite);
}

function startQuizTimer(seconds, player, isAI, isSnakeBite = false) {
    let timeLeft = seconds;
    if (quizTimerText) quizTimerText.textContent = `⏱️ ${timeLeft}s`;
    if (quizTimerBar) quizTimerBar.style.width = '100%';

    if (activeQuizTimer) clearInterval(activeQuizTimer);

    activeQuizTimer = setInterval(() => {
        timeLeft--;
        if (quizTimerText) quizTimerText.textContent = `⏱️ ${timeLeft}s`;
        if (quizTimerBar) quizTimerBar.style.width = `${(timeLeft / seconds) * 100}%`;

        if (isAI && timeLeft === 12) {
            const successChance = isSnakeBite ? 0.25 : 0.65;
            const isCorrect = Math.random() < successChance;
            const chosenAns = isCorrect ? currentQuizData.ans : (currentQuizData.ans + 1) % 4;
            submitAnswer(chosenAns, player, isSnakeBite);
        }

        if (timeLeft <= 0) {
            clearInterval(activeQuizTimer);
            handleQuizTimeout(player, isSnakeBite);
        }
    }, 1000);
}





// ==========================================
// 9. TURN CYCLING & UI RENDERERS
// ==========================================
function endTurn() {
    isRolling = false;
    if (btnRollEl) btnRollEl.disabled = false;

    if (!gameActive) return;

    currentPlayerIdx = (currentPlayerIdx + 1) % players.length;
    updateUI();
    if (!isMultiplayer) notifyTurnIfChanged();
    syncGameStateToFirebase();

    const nextPlayer = players[currentPlayerIdx];
    if (nextPlayer && nextPlayer.isAI) {
        setTimeout(executeTurn, 1000);
    }
}

function updateUI() {
    // 1. Clear all token containers on the board safely
    for (let i = 1; i <= 100; i++) {
        const tokBox = document.getElementById(`tokens-${i}`);
        if (tokBox) tokBox.innerHTML = '';
    }

    // 2. Filter active players (exclude those who left / online === false)
    const activePlayers = players.filter(p => p && p.online !== false);

    // 3. Render board tokens only for active online players
    activePlayers.forEach(p => {
        const tileNum = parseInt(p.position);
        const tokBox = document.getElementById(`tokens-${tileNum}`);
        if (tokBox) {
            const token = document.createElement('span');
            token.className = 'player-token text-xs px-1 py-0.5 rounded shadow text-slate-950 font-bold inline-block m-0.5';
            token.style.backgroundColor = p.color || '#f59e0b';
            token.textContent = p.avatar || '👤';
            token.title = p.name || 'Player';
            tokBox.appendChild(token);
        }
    });

    // 4. Update Current Turn display
    const currP = players[currentPlayerIdx];
    if (currP) {
        if (activeAvatarEl) activeAvatarEl.textContent = currP.avatar;
        if (activeNameEl) {
            activeNameEl.textContent = currP.name;
            activeNameEl.style.color = currP.color;
        }
        if (activePosEl) activePosEl.textContent = `Position: Tile ${currP.position}`;
        if (activeTypeEl) activeTypeEl.textContent = currP.isAI ? '🤖 BOT AI' : '👤 HUMAN';
    }

    // 5. Update Scoreboard (exclude offline players)
    if (scoreboardListEl) {
        scoreboardListEl.innerHTML = '';
        const sorted = [...activePlayers].sort((a, b) => b.position - a.position);
        sorted.forEach((p, rank) => {
            const item = document.createElement('div');
            item.className = 'flex items-center justify-between bg-slate-900/60 p-2.5 rounded-lg border border-slate-700/60 text-xs';
            item.innerHTML = `
                <div class="flex items-center space-x-2">
                    <span class="font-mono text-slate-500">#${rank + 1}</span>
                    <span>${p.avatar}</span>
                    <span class="font-bold text-slate-200">${p.name}</span>
                </div>
                <span class="font-extrabold text-amber-400">Tile ${p.position}</span>
            `;
            scoreboardListEl.appendChild(item);
        });
    }
}
function resetGame() {
    if (players.length === 0) return;

    // Single-player mode resets immediately
    if (!isMultiplayer || !currentRoomId) {
        executeActualReset();
        return;
    }

    const requestingPlayer = players[myPlayerId];
    const requesterName = requestingPlayer ? requestingPlayer.name : `Player ${myPlayerId + 1}`;

    // Create a reset request on Firebase
    db.ref(`rooms/${currentRoomId}/resetRequest`).set({
        requestedBy: myPlayerId,
        requesterName: requesterName,
        votes: {
            [myPlayerId]: true // Auto-accept for the requester
        }
    });

    // Show the waiting modal for the requester
    if (modalWaitingResetEl) modalWaitingResetEl.classList.remove('hidden');

    logMessage(`⏳ <strong>${requesterName}</strong> requested to restart the game. Waiting for players to accept...`);
}
function logMessage(msg) {
    if (!isMultiplayer || !currentRoomId) {
        // Fallback for single-player / offline mode
        appendLogToDOM(msg);
        return;
    }

    // Push log to Firebase room reference
    const logsRef = db.ref(`rooms/${currentRoomId}/logs`);
    logsRef.once('value', (snapshot) => {
        let logs = snapshot.val() || [];
        logs.push(msg);
        
        // Keep only the latest 50 logs to optimize performance
        if (logs.length > 50) {
            logs = logs.slice(logs.length - 50);
        }

        logsRef.set(logs);
    });
}

// Helper function to handle actual DOM rendering
function appendLogToDOM(msg) {
    if (!gameLogEl) return;
    const p = document.createElement('p');
    p.innerHTML = msg;
    gameLogEl.appendChild(p);
    gameLogEl.scrollTop = gameLogEl.scrollHeight;
}

// Executes the actual board reset
function executeActualReset() {
    generateRandomBoardLayout();
    initBoard();

    players.forEach(p => p.position = 1);
    currentPlayerIdx = 0;
    gameActive = true;
    turnNotificationEpoch++;
    lastNotifiedTurnKey = null;
    lastMultiplayerTurn = null;
    prepareRumbledDeck();

    updateUI();
    setTimeout(drawBoardOverlays, 100);

    if (isMultiplayer && currentRoomId) {
        // Reset player positions on Firebase individually
        players.forEach(p => {
            db.ref(`rooms/${currentRoomId}/players/${p.id}`).update({ position: 1 });
        });

        // Update room properties and clear the request
        db.ref(`rooms/${currentRoomId}`).update({
            winner: null,
            winnerName: null,
            gameActive: true,
            currentPlayerIdx: 0,
            boardLayout: { ladders: LADDERS, snakes: SNAKES, quizTiles: QUIZ_TILES },
            resetRequest: null
        });

        logMessage("🔄 The game has been restarted with a clean board layout!");
    } else {
        logMessage("Game reset with a clean board layout!");
    }
}

// Handler when local player clicks Accept
// Handler when local player clicks Accept
function handleAcceptReset() {
    if (modalResetRequestEl) modalResetRequestEl.classList.add('hidden');
    if (modalWaitingResetEl) modalWaitingResetEl.classList.remove('hidden'); // <--- Show waiting modal upon accepting
    
    if (!isMultiplayer || !currentRoomId) return;

    db.ref(`rooms/${currentRoomId}/resetRequest/votes/${myPlayerId}`).set(true);
}

// Handler when local player clicks Decline
function handleDeclineReset() {
    if (modalResetRequestEl) modalResetRequestEl.classList.add('hidden');
    if (modalWaitingResetEl) modalWaitingResetEl.classList.add('hidden'); // <--- Ensure waiting modal closes too
    if (!isMultiplayer || !currentRoomId) return;

    const decliningPlayer = players[myPlayerId];
    const declinerName = decliningPlayer ? decliningPlayer.name : `Player ${myPlayerId + 1}`;

    db.ref(`rooms/${currentRoomId}/resetRequest`).remove();
    logMessage(`❌ <strong>${declinerName}</strong> declined the restart request. Game continues!`);
}