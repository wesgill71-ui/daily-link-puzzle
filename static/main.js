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
    const history = puzzleData.history || [];

    // 2. Set board reveal level
    revealedCount = guessCount + 1;
    if (revealedCount > puzzleData.pairs.length) {
        revealedCount = puzzleData.pairs.length;
    }

    // 3. Clear and Rebuild Feedback (History)
    const feedback = document.getElementById("feedback");
    feedback.innerHTML = "";
    
    // Replay history
    history.forEach(item => {
        addFeedbackRow(item.guess, item.status, item.answer);
    });

    renderBoard();

    // 4. Handle Solved/Game Over State
    if (solved || (guessCount >= puzzleData.max_guesses && !solved)) {
        disableInput();
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

// --- NEW: Helper to show the popup ---
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

    addFeedbackRow(guess, data.status, data.answer);

    if (data.advance) {
        disableInput();
        
        if (data.status === "correct") {
            solved = true;
            renderBoard(); // Show green board
            
            // Show Success Modal
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

// --- NEW: Close Modal Event ---
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

window.onload = loadPuzzle;