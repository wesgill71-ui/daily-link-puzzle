let puzzleData;
let revealedCount = 1;
let guessCount = 0;
let solved = false;

async function loadPuzzle() {
    const res = await fetch("/puzzle");
    puzzleData = await res.json();

    // 1. Sync basic state
    guessCount = puzzleData.current_guesses || 0;
    solved = puzzleData.solved || false;
    
    // Ensure history exists
    if (!puzzleData.history) puzzleData.history = [];

    // 2. Set board reveal level
    revealedCount = guessCount + 1;
    if (revealedCount > puzzleData.pairs.length) {
        revealedCount = puzzleData.pairs.length;
    }

    // 3. Clear and Rebuild Feedback (History)
    const feedback = document.getElementById("feedback");
    feedback.innerHTML = "";
    
    // Replay history
    puzzleData.history.forEach(item => {
        addFeedbackRow(item.guess, item.status, item.answer);
    });

    renderBoard();

    // 4. Handle Solved/Game Over State
    if (solved || (guessCount >= puzzleData.max_guesses && !solved)) {
        disableInput();
        // Show persistent button if it exists
        const pBtn = document.getElementById("persistent-share-btn");
        if (pBtn) pBtn.classList.remove("hidden");
    } else {
        document.getElementById("submit-btn").disabled = false;
        document.getElementById("guess-input").focus();
    }
}

function renderBoard() {
    const board = document.getElementById("puzzle-board");
    board.innerHTML = "";

    puzzleData.pairs.forEach((pair, i) => {
        const card = document.createElement("div");
        card.classList.add("pair-card");

        // If solved OR if this row should be revealed
        if (solved || i < revealedCount) {
            card.innerText = `${pair[0]} → ? → ${pair[1]}`;
            if (solved) card.classList.add("pair-solved");
            else card.classList.add("pair-revealed");
        } else {
            card.innerText = "??? → ? → ???";
            card.classList.add("pair-hidden");
        }
        board.appendChild(card);
    });
}

function addFeedbackRow(guessWord, status, answer) {
    const feedback = document.getElementById("feedback");
    const row = document.createElement("div");

    if (status === "correct") {
        row.innerText = `🟩 ${guessWord} — Correct!`;
        row.style.color = "green";
    } else if (status === "fail") {
        row.innerText = `❌ Out of guesses`; 
        row.style.color = "red";
    } else if (status === "close") {
        row.innerText = `🟨 ${guessWord} — Close`;
        row.style.color = "orange";
    } else {
        row.innerText = `⬜ ${guessWord}`;
        row.style.color = "gray";
    }

    feedback.appendChild(row);
}

function showModal(title, message) {
    const modal = document.getElementById("game-modal");
    document.getElementById("modal-title").innerText = title;
    document.getElementById("modal-message").innerText = message;
    
    modal.classList.remove("hidden");
    // Small timeout to allow CSS transition
    setTimeout(() => {
        modal.classList.add("show");
    }, 10);
}

function disableInput() {
    document.getElementById("submit-btn").disabled = true;
    document.getElementById("guess-input").disabled = true;
}

// --- SHARED COPY LOGIC ---
function handleShare(btnElement) {
    // Use the global 'puzzleData' which we are now keeping updated
    const history = puzzleData.history || [];
    const dayIndex = puzzleData.day_index || 1;
    const currentGuessCount = solved ? history.length : "X";
    const maxGuesses = puzzleData.max_guesses;

    // Build the Emoji Grid
    let text = `The Daily Link Puzzle #${dayIndex} ${currentGuessCount}/${maxGuesses}\n\n`;

    history.forEach(item => {
        if (item.status === "correct") text += "🟩\n";
        else if (item.status === "close") text += "🟨\n";
        else text += "⬜\n";
    });

    // Copy to Clipboard
    navigator.clipboard.writeText(text).then(() => {
        const originalText = btnElement.innerText;
        
        btnElement.innerText = "Copied!";
        btnElement.style.background = "#fff"; // Flash white
        
        setTimeout(() => {
            btnElement.innerText = originalText;
            btnElement.style.background = "#4ade80"; // Restore green
        }, 2000);
    }).catch(err => {
        console.error("Failed to copy:", err);
        alert("Could not copy to clipboard.");
    });
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

    // --- FIX: UPDATE THE DATA IMMEDIATELY ---
    if (!puzzleData.history) puzzleData.history = [];
    puzzleData.history.push({
        guess: guess,
        status: data.status,
        answer: data.answer
    });
    // ----------------------------------------

    addFeedbackRow(guess, data.status, data.answer);

    if (data.advance) {
        disableInput();
        
        // Show persistent share button (Safety Checked)
        const pBtn = document.getElementById("persistent-share-btn");
        if (pBtn) pBtn.classList.remove("hidden");

        if (data.status === "correct") {
            solved = true;
            renderBoard(); // Show green board
            showModal("Congratulations!", `The answer was ${data.answer || "Correct"}.`);
        } else {
            // Show Fail Modal
            showModal("Game Over", `The answer was ${data.answer}. Try again tomorrow!`);
        }
    } else {
        if (revealedCount < puzzleData.pairs.length) {
            revealedCount++;
            renderBoard();
        }
    }

    input.value = "";
    if (!solved) input.focus();
}

// --- EVENT LISTENERS ---
document.getElementById("close-modal-btn").addEventListener("click", () => {
    const modal = document.getElementById("game-modal");
    modal.classList.remove("show");
    setTimeout(() => {
        modal.classList.add("hidden");
    }, 300); 
});

document.getElementById("submit-btn").addEventListener("click", submitGuess);
document.getElementById("guess-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submitGuess();
});

// Hook up BOTH share buttons (with safety checks)
const modalShareBtn = document.getElementById("share-btn");
if (modalShareBtn) {
    modalShareBtn.addEventListener("click", (e) => handleShare(e.target));
}

const persistentShareBtn = document.getElementById("persistent-share-btn");
if (persistentShareBtn) {
    persistentShareBtn.addEventListener("click", (e) => handleShare(e.target));
}

window.onload = loadPuzzle;