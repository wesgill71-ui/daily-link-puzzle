let puzzleData;
let revealedCount = 1;
let guessCount = 0;
let solved = false;

// 1. Fetch Daily Puzzle & Sync State
async function loadPuzzle() {
    const res = await fetch("/puzzle");
    puzzleData = await res.json();

    guessCount = puzzleData.current_guesses || 0;
    solved = puzzleData.solved || false;
    
    if (!puzzleData.history) puzzleData.history = [];

    // Set board reveal level
    revealedCount = guessCount + 1;
    if (revealedCount > puzzleData.pairs.length) {
        revealedCount = puzzleData.pairs.length;
    }

    // Clear and Rebuild Feedback (History)
    const feedback = document.getElementById("feedback");
    feedback.innerHTML = "";
    
    puzzleData.history.forEach(item => {
        addFeedbackRow(item.guess, item.status, item.answer);
    });

    renderBoard();

    // Handle Solved/Game Over State
    if (solved || (guessCount >= puzzleData.max_guesses && !solved)) {
        disableInput();
        const pBtn = document.getElementById("persistent-share-btn");
        if (pBtn) pBtn.classList.remove("hidden");
    } else {
        document.getElementById("submit-btn").disabled = false;
        document.getElementById("guess-input").focus();
    }
}

// 2. Updated Render Board: Centered 🔗 Formatting
function renderBoard() {
    const board = document.getElementById("puzzle-board");
    board.innerHTML = "";

    puzzleData.pairs.forEach((pair, i) => {
        const card = document.createElement("div");
        card.classList.add("pair-card");

        // Format logic: Word 🔗 Word vs ? 🔗 ?
        if (solved || i < revealedCount) {
            card.innerHTML = `<span>${pair[0]}</span> <span class="link-emoji">🔗</span> <span>${pair[1]}</span>`;
            if (solved) card.classList.add("pair-solved");
            else card.classList.add("pair-revealed");
        } else {
            card.innerHTML = `<span>?</span> <span class="link-emoji">🔗</span> <span>?</span>`;
            card.classList.add("pair-hidden");
        }
        board.appendChild(card);
    });
}

// 3. Feedback/History Management
function addFeedbackRow(guessWord, status, answer) {
    const feedback = document.getElementById("feedback");
    const row = document.createElement("div");

    if (status === "correct") {
        row.innerText = `🟩 ${guessWord} — Correct!`;
        row.style.color = "#4ade80";
    } else if (status === "fail") {
        row.innerText = `❌ Out of guesses`;
        row.style.color = "#ff4d4d";
    } else if (status === "close") {
        row.innerText = `🟨 ${guessWord} — Close`;
        row.style.color = "#fbbf24";
    } else {
        row.innerText = `⬜ ${guessWord}`;
        row.style.color = "#b5b5b8";
    }

    feedback.appendChild(row);
}

// 4. Enhanced Share Logic: Mobile Native Share + Clipboard Fallback
async function handleShare(btnElement) {
    const history = puzzleData.history || [];
    const dayIndex = puzzleData.day_index || 1;
    const currentGuessCount = solved ? history.length : "X";
    const maxGuesses = puzzleData.max_guesses;

    // Build the Emoji Grid text
    let shareText = `The Daily Link Puzzle #${dayIndex} ${currentGuessCount}/${maxGuesses}\n\n`;
    history.forEach(item => {
        if (item.status === "correct") shareText += "🟩\n";
        else if (item.status === "close") shareText += "🟨\n";
        else shareText += "⬜\n";
    });
    shareText += "\nPlay here: https://www.dailylinkpuzzle.com";

    // Check for Mobile Native Sharing API
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Daily Link Puzzle',
                text: shareText
            });
        } catch (err) {
            console.log("Share cancelled or failed");
        }
    } else {
        // Desktop Fallback: Copy to Clipboard
        navigator.clipboard.writeText(shareText).then(() => {
            const originalText = btnElement.innerText;
            btnElement.innerText = "Copied!";
            btnElement.style.background = "#fff";
            
            setTimeout(() => {
                btnElement.innerText = originalText;
                btnElement.style.background = "#4ade80";
            }, 2000);
        }).catch(err => {
            alert("Could not copy to clipboard.");
        });
    }
}

// 5. Submit Guess Logic
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

    addFeedbackRow(guess, data.status, data.answer);

    if (data.advance) {
        disableInput();
        const pBtn = document.getElementById("persistent-share-btn");
        if (pBtn) pBtn.classList.remove("hidden");

        if (data.status === "correct") {
            solved = true;
            renderBoard();
            showModal("Congratulations!", `The answer was ${data.answer}.`);
        } else {
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

// 6. Utility Functions & Event Listeners
function showModal(title, message) {
    const modal = document.getElementById("game-modal");
    document.getElementById("modal-title").innerText = title;
    document.getElementById("modal-message").innerText = message;
    
    modal.classList.remove("hidden");
    setTimeout(() => {
        modal.classList.add("show");
    }, 10);
}

function disableInput() {
    document.getElementById("submit-btn").disabled = true;
    document.getElementById("guess-input").disabled = true;
}

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

const modalShareBtn = document.getElementById("share-btn");
if (modalShareBtn) {
    modalShareBtn.addEventListener("click", (e) => handleShare(e.target));
}

const persistentShareBtn = document.getElementById("persistent-share-btn");
if (persistentShareBtn) {
    persistentShareBtn.addEventListener("click", (e) => handleShare(e.target));
}

window.onload = loadPuzzle;
