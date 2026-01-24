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
    lastPlayedIndex: -1
};

async function loadPuzzle() {
    loadStats();

    const res = await fetch("/puzzle");
    puzzleData = await res.json();

    restoreGameState();

    guessCount = puzzleData.history ? puzzleData.history.length : 0;
    
    if (puzzleData.solved) {
        solved = true;
    }
    
    if (!puzzleData.history) puzzleData.history = [];

    revealedCount = guessCount + 1;
    if (revealedCount > puzzleData.pairs.length) {
        revealedCount = puzzleData.pairs.length;
    }

    const feedback = document.getElementById("feedback");
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
        solved: solved
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
        userStats = JSON.parse(stored);
    }
}

function saveStats() {
    localStorage.setItem('dailyLinkStats', JSON.stringify(userStats));
}

function updateStats(isWin) {
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
    } else {
        userStats.currentStreak = 0;
    }
    saveStats();
}

// Updated to populate BOTH the Header Modal and the Game Over Modal
function populateStatsModal() {
    let winPct = 0;
    if (userStats.gamesPlayed > 0) {
        winPct = Math.round((userStats.gamesWon / userStats.gamesPlayed) * 100);
    }

    // 1. Update Header Stats Modal
    document.getElementById('stat-played').innerText = userStats.gamesPlayed;
    document.getElementById('stat-win-pct').innerText = winPct;
    document.getElementById('stat-streak').innerText = userStats.currentStreak;
    document.getElementById('stat-max-streak').innerText = userStats.maxStreak;

    // 2. Update Game Over Modal Stats
    // Check if element exists first (safety check)
    if(document.getElementById('gm-stat-played')) {
        document.getElementById('gm-stat-played').innerText = userStats.gamesPlayed;
        document.getElementById('gm-stat-win-pct').innerText = winPct;
        document.getElementById('gm-stat-streak').innerText = userStats.currentStreak;
        document.getElementById('gm-stat-max-streak').innerText = userStats.maxStreak;
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
    document.getElementById("modal-support-btn").classList.add("hidden");
    document.getElementById("modal-stats-container").classList.add("hidden");
    
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
        populateStatsModal();
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
    guessCount++;

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
    populateStatsModal();
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
