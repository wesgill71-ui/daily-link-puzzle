let puzzleData;
let revealedCount = 1;
let guessCount = 0;
let solved = false;

// Default Stats Object
let userStats = {
    gamesPlayed: 0,
    gamesWon: 0,
    currentStreak: 0,
    maxStreak: 0,
    lastPlayedIndex: -1,
    // Index 0-5 = 1-6 guesses. Index 6 = Failed (X)
    guessDistribution: [0, 0, 0, 0, 0, 0, 0]
};

async function loadPuzzle() {
    // 1. Load User Stats
    loadStats();

    const res = await fetch("/puzzle");
    puzzleData = await res.json();

    // 2. Validate Streak (Reset if they skipped a day)
    validateStreak();

    // 3. Restore Game Progress (if they refreshed or came back)
    restoreGameState();

    // 4. Update UI (Show Streak in Header)
    updateStatsUI();

    // 5. Initialize Game Variables
    guessCount = puzzleData.history ? puzzleData.history.length : 0;
    
    if (puzzleData.solved) {
        solved = true;
    }
    
    if (!puzzleData.history) puzzleData.history = [];

    revealedCount = guessCount + 1;
    if (revealedCount > puzzleData.pairs.length) {
        revealedCount = puzzleData.pairs.length;
    }

    // 6. Render History
    const guessList = document.getElementById("guess-list");
    guessList.innerHTML = "";
    
    puzzleData.history.forEach(item => {
        addFeedbackRow(item.guess, item.status, item.answer);
    });

    renderBoard();
    checkFirstVisit();

    // 7. Check Game Over State
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
        solved: solved
    };
    localStorage.setItem('dailyLinkProgress', JSON.stringify(state));
}

function restoreGameState() {
    const savedJSON = localStorage.getItem('dailyLinkProgress');
    if (!savedJSON) return;

    try {
        const saved = JSON.parse(savedJSON);
        // Only restore if it matches TODAY'S puzzle
        if (saved.day_index === puzzleData.day_index) {
            puzzleData.history = saved.history;
            puzzleData.solved = saved.solved;
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
        
        // Safety: ensure distribution exists and is array
        if (!userStats.guessDistribution || !Array.isArray(userStats.guessDistribution)) {
            userStats.guessDistribution = [0, 0, 0, 0, 0, 0, 0];
        }

        // MIGRATION: If user has old version (length 6), add the 7th slot for Fails
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

    // If gap > 1, they missed a day. Reset streak.
    if (gap > 1) {
        userStats.currentStreak = 0;
        saveStats();
    }
}

function updateStats(isWin) {
    // If we already played today's index, don't double count
    if (userStats.lastPlayedIndex === puzzleData.day_index) {
        return;
    }

    userStats.gamesPlayed++;
    userStats.lastPlayedIndex = puzzleData.day_index;

    if (isWin) {
        userStats.gamesWon++;
        userStats.currentStreak++;
        if (userStats.currentStreak > userStats.maxStreak) {
            userStats.maxStreak = userStats.currentStreak;
        }
        
        // Win Distribution (Index 0-5)
        const distIndex = Math.min(guessCount, 6) - 1;
        if (distIndex >= 0) {
            userStats.guessDistribution[distIndex]++;
        }

    } else {
        userStats.currentStreak = 0;
        // Fail Distribution (Index 6)
        // Ensure the array has enough slots (handled in loadStats, but safe to check)
        if (userStats.guessDistribution.length > 6) {
            userStats.guessDistribution[6]++;
        }
    }
    saveStats();
    updateStatsUI();
}

function renderDistribution(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    container.innerHTML = "";
    
    // Find max value to normalize bar widths
    const maxVal = Math.max(...userStats.guessDistribution, 1);

    // We expect 7 items now: 1, 2, 3, 4, 5, 6, X
    userStats.guessDistribution.forEach((count, index) => {
        const row = document.createElement("div");
        row.className = "dist-row";

        // Logic to determine label (1-6 or X)
        const isFailRow = (index === 6);
        const label = isFailRow ? "X" : (index + 1);

        // Highlight logic
        // If solved: highlight the row matching guessCount
        // If NOT solved (and game over): highlight the X row
        let isToday = false;
        if (solved) {
            isToday = (guessCount === index + 1);
        } else {
            // Check if game is over (failed)
            if (guessCount >= puzzleData.max_guesses && isFailRow) {
                isToday = true;
            }
        }
        
        // Calculate percentage width (minimum 7% so 0 isn't invisible)
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

    // 1. Update Header Streak Display
    const headerStreak = document.getElementById("header-streak-val");
    const headerContainer = document.getElementById("header-streak-container");
    
    if (headerStreak && headerContainer) {
        headerStreak.innerText = userStats.currentStreak;
        headerContainer.classList.remove("hidden");
    }

    // Helper to safely set text
    const setText = (id, val) => {
        const el = document.getElementById(id);
        if(el) el.innerText = val;
    };

    // 2. Update Header Stats Modal
    setText('stat-played', userStats.gamesPlayed);
    setText('stat-win-pct', winPct);
    setText('stat-streak', userStats.currentStreak);
    setText('stat-max-streak', userStats.maxStreak);
    renderDistribution("stats-distribution");

    // 3. Update Game Over Modal Stats
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

        if (solved || i < revealedCount) {
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

function showHint() {
    let hintText = "No hint available for this puzzle.";
    
    if (puzzleData.synonyms && puzzleData.synonyms.length > 0) {
        hintText = `Synonym: ${puzzleData.synonyms[0]}`;
    } else if (puzzleData.synonym) {
        hintText = `Synonym: ${puzzleData.synonym}`;
    }

    const modal = document.getElementById("game-modal");
    document.getElementById("modal-title").innerText = "Hint";
    document.getElementById("modal-message").innerText = hintText;
    
    // Hide buttons AND stats for Hints
    document.getElementById("share-btn").classList.add("hidden");
    const supportBtn = document.getElementById("modal-support-btn");
    if(supportBtn) supportBtn.classList.add("hidden");
    
    const statsContainer = document.getElementById("modal-stats-container");
    if(statsContainer) statsContainer.classList.add("hidden");
    
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.add("show"), 10);
}

function showModal(title, message, showShare = true) {
    const modal = document.getElementById("game-modal");
    document.getElementById("modal-title").innerText = title;
    document.getElementById("modal-message").innerText = message;
    
    const shareBtn = document.getElementById("share-btn");
    const supportBtn = document.getElementById("modal-support-btn");
    const statsContainer = document.getElementById("modal-stats-container");

    if (showShare) {
        // Game Over or Win: Show everything
        shareBtn.classList.remove("hidden");
        supportBtn.classList.remove("hidden");
        
        // Populate and Show Stats
        updateStatsUI();
        statsContainer.classList.remove("hidden");
    } else {
        // Generic/Hint: Hide buttons and stats
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
        try {
            await navigator.share({
                title: 'Daily Link Puzzle',
                text: shareText
            });
        } catch (err) {
            console.log("Share cancelled");
        }
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
    guessCount++; // Increment global guess count

    if (!puzzleData.history) puzzleData.history = [];
    puzzleData.history.push({
        guess: guess,
        status: data.status,
        answer: data.answer
    });

    // Save progress immediately after guess
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
            updateStats(true); // Record Win & update Distribution
            showModal("Congratulations!", `The answer was ${data.answer}.`, true);
        } else {
            saveGameState();
            updateStats(false); // Record Loss
            showModal("Game Over", `The answer was ${data.answer}. Try again tomorrow!`, true);
        }
    } else {
        if (revealedCount < puzzleData.pairs.length) {
            revealedCount++;
            renderBoard();
        }
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

document.getElementById("close-modal-btn").addEventListener("click", () => {
    const modal = document.getElementById("game-modal");
    modal.classList.remove("show");
    setTimeout(() => modal.classList.add("hidden"), 300);
});

// Stats Button in Header
document.getElementById("stats-btn").addEventListener("click", () => {
    updateStatsUI();
    document.getElementById("stats-modal").classList.add("show");
});

document.getElementById("close-stats-btn").addEventListener("click", () => {
    document.getElementById("stats-modal").classList.remove("show");
});

document.getElementById("hint-btn").addEventListener("click", showHint);

document.getElementById("help-btn").addEventListener("click", () => {
    document.getElementById("instructions-modal").classList.add("show");
});

document.getElementById("close-instructions-btn").addEventListener("click", () => {
    document.getElementById("instructions-modal").classList.remove("show");
});

const modalShareBtn = document.getElementById("share-btn");
if (modalShareBtn) modalShareBtn.addEventListener("click", (e) => handleShare(e.target));

const persistentShareBtn = document.getElementById("persistent-share-btn");
if (persistentShareBtn) persistentShareBtn.addEventListener("click", (e) => handleShare(e.target));

window.onload = loadPuzzle;
