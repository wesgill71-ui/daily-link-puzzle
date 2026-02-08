let puzzleData;
let revealedCount = 1;
let guessCount = 0;
let solved = false;

let userStats = {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedIndex: -1,
    guessDistribution: [0, 0, 0, 0, 0, 0, 0]
};

async function loadPuzzle() {
    loadStats();

    const res = await fetch("/puzzle");
    puzzleData = await res.json();

    validateStreak();
    restoreGameState();
    updateStatsUI();

    guessCount = puzzleData.history ? puzzleData.history.length : 0;
    
    if (puzzleData.solved) {
        solved = true;
    }
    
    if (!puzzleData.history) puzzleData.history = [];
    if (!puzzleData.extra_revealed) puzzleData.extra_revealed = [];

    revealedCount = guessCount + 1;
    if (revealedCount > puzzleData.pairs.length) {
        revealedCount = puzzleData.pairs.length;
    }

    const guessList = document.getElementById("guess-list");
    guessList.innerHTML = "";
    puzzleData.history.forEach(item => {
        addFeedbackRow(item.guess, item.status, item.answer);
    });

    renderBoard();
    checkFirstVisit();

    if (solved || (guessCount >= puzzleData.max_guesses && !solved)) {
        disableInput();
        const pBtn = document.getElementById("persistent-share-btn");
        if (pBtn) pBtn.classList.remove("hidden");
    } else {
        document.getElementById("submit-btn").disabled = false;
        document.getElementById("guess-input").focus();
    }
}

function checkFirstVisit() {
    const hasVisited = localStorage.getItem('dailyLinkVisited');
    if (!hasVisited) {
        document.getElementById('instructions-modal').classList.add('show');
        localStorage.setItem('dailyLinkVisited', 'true');
    }
}

// --- GAME STATE PERSISTENCE ---
function saveGameState() {
    const state = {
        day_index: puzzleData.day_index,
        history: puzzleData.history,
        solved: solved,
        extra_revealed: puzzleData.extra_revealed
    };
    localStorage.setItem('dailyLinkProgress', JSON.stringify(state));
}

function restoreGameState() {
    const savedJSON = localStorage.getItem('dailyLinkProgress');
    if (!savedJSON) return;
    try {
        const saved = JSON.parse(savedJSON);
        if (saved.day_index === puzzleData.day_index) {
            puzzleData.history = saved.history;
            puzzleData.solved = saved.solved;
            if (saved.extra_revealed) puzzleData.extra_revealed = saved.extra_revealed;
            solved = saved.solved;
        }
    } catch (e) {
        console.error("Error parsing saved game state", e);
    }
}

// --- STATS LOGIC ---
function loadStats() {
    const stored = localStorage.getItem('dailyLinkStats');
    if (stored) {
        const parsed = JSON.parse(stored);
        userStats = { ...userStats, ...parsed };
        if (!userStats.guessDistribution || !Array.isArray(userStats.guessDistribution)) {
            userStats.guessDistribution = [0, 0, 0, 0, 0, 0, 0];
        }
        if (userStats.guessDistribution.length === 6) {
            userStats.guessDistribution.push(0);
        }
    }
}

function saveStats() {
    localStorage.setItem('dailyLinkStats', JSON.stringify(userStats));
}

function validateStreak() {
    if (userStats.lastPlayedIndex === -1) return;
    const currentDay = puzzleData.day_index;
    const lastPlayed = userStats.lastPlayedIndex;
    const gap = currentDay - lastPlayed;
    if (gap > 1) {
        userStats.currentStreak = 0;
        saveStats();
    }
}

function updateStats(isWin) {
    if (userStats.lastPlayedIndex === puzzleData.day_index) return;
    userStats.gamesPlayed++;
    userStats.lastPlayedIndex = puzzleData.day_index;
    if (isWin) {
        userStats.gamesWon++;
        userStats.currentStreak++;
        if (userStats.currentStreak > userStats.maxStreak) {
            userStats.maxStreak = userStats.currentStreak;
        }
        const distIndex = Math.min(guessCount, 6) - 1;
        if (distIndex >= 0) userStats.guessDistribution[distIndex]++;
    } else {
        userStats.currentStreak = 0;
        if (userStats.guessDistribution.length > 6) userStats.guessDistribution[6]++;
    }
    saveStats();
    updateStatsUI();
}

function renderDistribution(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = "";
    const maxVal = Math.max(...userStats.guessDistribution, 1);

    userStats.guessDistribution.forEach((count, index) => {
        const row = document.createElement("div");
        row.className = "dist-row";
        const isFailRow = (index === 6);
        const label = isFailRow ? "X" : (index + 1);

        let isToday = false;
        if (solved) {
            isToday = (guessCount === index + 1);
        } else {
            if (guessCount >= puzzleData.max_guesses && isFailRow) isToday = true;
        }
        
        const widthPct = Math.max(7, (count / maxVal) * 100);

        row.innerHTML = `
            <div class="dist-label">${label}</div>
            <div class="dist-bar-container">
                <div class="dist-bar ${isToday ? (isFailRow ? 'fail' : 'highlight') : ''}" style="width: ${widthPct}%">
                    ${count}
                </div>
            </div>
        `;
        container.appendChild(row);
    });
}

function updateStatsUI() {
    let winPct = 0;
    if (userStats.gamesPlayed > 0) {
        winPct = Math.round((userStats.gamesWon / userStats.gamesPlayed) * 100);
    }
    const headerStreak = document.getElementById("header-streak-val");
    const headerContainer = document.getElementById("header-streak-container");
    if (headerStreak && headerContainer) {
        headerStreak.innerText = userStats.currentStreak;
        headerContainer.classList.remove("hidden");
    }
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.innerText = val;
    };
    setText('stat-played', userStats.gamesPlayed);
    setText('stat-win-pct', winPct);
    setText('stat-streak', userStats.currentStreak);
    setText('stat-max-streak', userStats.maxStreak);
    renderDistribution("stats-distribution");

    if(document.getElementById('gm-stat-played')) {
        setText('gm-stat-played', userStats.gamesPlayed);
        setText('gm-stat-win-pct', winPct);
        setText('gm-stat-streak', userStats.currentStreak);
        setText('gm-stat-max-streak', userStats.maxStreak);
        renderDistribution("modal-distribution");
    }
}

// --- RENDER & LOGIC ---

function renderBoard() {
    const board = document.getElementById("puzzle-board");
    board.innerHTML = "";

    puzzleData.pairs.forEach((pair, i) => {
        const card = document.createElement("div");
        card.classList.add("pair-card");

        const linkIcon = `<img src="/static/logo.png" class="link-icon" alt="link">`;

        const isSequentiallyRevealed = i < revealedCount;
        const isExtraRevealed = puzzleData.extra_revealed && puzzleData.extra_revealed.includes(i);

        if (solved || isSequentiallyRevealed || isExtraRevealed) {
            card.innerHTML = `<span>${pair[0]}</span> ${linkIcon} <span>${pair[1]}</span>`;
            if (solved) card.classList.add("pair-solved");
            else card.classList.add("pair-revealed");
        } else {
            card.innerHTML = `<span>?</span> ${linkIcon} <span>?</span>`;
            card.classList.add("pair-hidden");
        }
        board.appendChild(card);
    });
}

function addFeedbackRow(guessWord, status, answer) {
    const guessList = document.getElementById("guess-list");
    const row = document.createElement("div");
    row.className = "guess-row";
    const box = document.createElement("span");
    box.className = "color-box";
    const text = document.createElement("span");

    if (status === "correct") {
        box.classList.add("green");
        text.innerText = `${guessWord} — Correct!`;
        text.style.color = "#4ade80";
    } else if (status === "fail") {
        box.classList.add("red");
        text.innerText = "Out of guesses";
        text.style.color = "#ff4d4d";
    } else if (status === "close") {
        box.classList.add("orange");
        text.innerText = `${guessWord} — Close`;
        text.style.color = "#fbbf24";
    } else {
        box.classList.add("white");
        text.innerText = guessWord;
        text.style.color = "#b5b5b8";
    }

    row.appendChild(box);
    row.appendChild(text);
    guessList.appendChild(row);
}

// NEW: Toast Notification
function showToast(message) {
    const toast = document.getElementById("toast-msg");
    if (!toast) return;
    
    toast.innerText = message;
    toast.classList.add("show");

    setTimeout(() => {
        toast.classList.remove("show");
    }, 2000);
}

// NEW: Shake Animation Helper
function shakeInput() {
    const input = document.getElementById("guess-input");
    input.classList.add("shake");
    setTimeout(() => {
        input.classList.remove("shake");
    }, 500);
}

async function submitGuess() {
    if (solved) return;
    const input = document.getElementById("guess-input");
    const guess = input.value.trim();
    if (!guess) return;

    const res = await fetch("/guess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guess })
    });

    const data = await res.json();

    // 1. Handle Invalid Word (Early Exit)
    if (data.status === "invalid") {
        shakeInput();
        showToast("Not a valid word");
        return; // Do NOT increment guesses, do NOT add to history
    }

    guessCount++;

    if (data.extra_revealed) {
        puzzleData.extra_revealed = data.extra_revealed;
    }

    if (!puzzleData.history) puzzleData.history = [];
    puzzleData.history.push({
        guess: guess,
        status: data.status,
        answer: data.answer
    });

    saveGameState();
    addFeedbackRow(guess, data.status, data.answer);

    if (data.advance) {
        disableInput();
        const pBtn = document.getElementById("persistent-share-btn");
        if (pBtn) pBtn.classList.remove("hidden");

        if (data.status === "correct") {
            solved = true;
            saveGameState();
            renderBoard();
            updateStats(true);
            showModal("Congratulations!", `The answer was ${data.answer}.`, true);
        } else {
            saveGameState();
            updateStats(false);
            showModal("Game Over", `The answer was ${data.answer}. Try again tomorrow!`, true);
        }
    } else {
        if (revealedCount < puzzleData.pairs.length) {
            revealedCount++;
        }
        renderBoard();
        saveGameState();
    }

    input.value = "";
    if (!solved) input.focus();
}

function disableInput() {
    document.getElementById("submit-btn").disabled = true;
    document.getElementById("guess-input").disabled = true;
}

document.getElementById("submit-btn").addEventListener("click", submitGuess);
document.getElementById("guess-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitGuess();
});

// Hint, Help, and Stats Button Listeners (Standard)
document.getElementById("close-modal-btn").addEventListener("click", () => {
    const modal = document.getElementById("game-modal");
    modal.classList.remove("show");
    setTimeout(() => modal.classList.add("hidden"), 300);
});
document.getElementById("stats-btn").addEventListener("click", () => {
    updateStatsUI();
    document.getElementById("stats-modal").classList.add("show");
});
document.getElementById("close-stats-btn").addEventListener("click", () => {
    document.getElementById("stats-modal").classList.remove("show");
});
function showHint() {
    let hintText = "No hint available for this puzzle.";
    if (puzzleData.synonyms && puzzleData.synonyms.length > 0) {
        hintText = `Synonym: ${puzzleData.synonyms[0]}`;
    } else if (puzzleData.synonym) {
        hintText = `Synonym: ${puzzleData.synonym}`;
    }
    showModal("Hint", hintText, false);
}
document.getElementById("hint-btn").addEventListener("click", showHint);
document.getElementById("help-btn").addEventListener("click", () => {
    document.getElementById("instructions-modal").classList.add("show");
});
document.getElementById("close-instructions-btn").addEventListener("click", () => {
    document.getElementById("instructions-modal").classList.remove("show");
});
function showModal(title, message, showShare = true) {
    const modal = document.getElementById("game-modal");
    document.getElementById("modal-title").innerText = title;
    document.getElementById("modal-message").innerText = message;
    const shareBtn = document.getElementById("share-btn");
    const supportBtn = document.getElementById("modal-support-btn");
    const statsContainer = document.getElementById("modal-stats-container");
    if (showShare) {
        shareBtn.classList.remove("hidden");
        supportBtn.classList.remove("hidden");
        updateStatsUI();
        statsContainer.classList.remove("hidden");
    } else {
        shareBtn.classList.add("hidden");
        supportBtn.classList.add("hidden");
        statsContainer.classList.add("hidden");
    }
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.add("show"), 10);
}
async function handleShare(btnElement) {
    const history = puzzleData.history || [];
    const dayIndex = puzzleData.day_index || 1;
    const currentGuessCount = solved ? history.length : "X";
    const maxGuesses = puzzleData.max_guesses;
    let shareText = `The Daily Link Puzzle #${dayIndex} ${currentGuessCount}/${maxGuesses}\n\n`;
    history.forEach(item => {
        if (item.status === "correct") shareText += "🟩\n";
        else if (item.status === "close") shareText += "🟨\n";
        else shareText += "⬜\n";
    });
    shareText += "\nPlay here: https://www.dailylinkpuzzle.com";
    if (navigator.share) {
        try { await navigator.share({ title: 'Daily Link Puzzle', text: shareText }); }
        catch (err) { console.log("Share cancelled"); }
    } else {
        navigator.clipboard.writeText(shareText).then(() => {
            const originalText = btnElement.innerText;
            btnElement.innerText = "Copied!";
            btnElement.style.background = "#fff";
            setTimeout(() => {
                btnElement.innerText = originalText;
                btnElement.style.background = "#4ade80";
            }, 2000);
        }).catch(err => alert("Could not copy to clipboard."));
    }
}
const modalShareBtn = document.getElementById("share-btn");
if (modalShareBtn) modalShareBtn.addEventListener("click", (e) => handleShare(e.target));
const persistentShareBtn = document.getElementById("persistent-share-btn");
if (persistentShareBtn) persistentShareBtn.addEventListener("click", (e) => handleShare(e.target));

window.onload = loadPuzzle;
