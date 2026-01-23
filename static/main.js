let puzzleData;
let revealedCount = 1;
let guessCount = 0;
let solved = false;

async function loadPuzzle() {
    const res = await fetch("/puzzle");
    puzzleData = await res.json();

    guessCount = puzzleData.current_guesses || 0;
    solved = puzzleData.solved || false;
    
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
    
    // Hide BOTH buttons for hints
    document.getElementById("share-btn").classList.add("hidden");
    const supportBtn = document.getElementById("modal-support-btn");
    if(supportBtn) supportBtn.classList.add("hidden");
    
    modal.classList.remove("hidden");
    setTimeout(() => modal.classList.add("show"), 10);
}

function showModal(title, message, showShare = true) {
    const modal = document.getElementById("game-modal");
    document.getElementById("modal-title").innerText = title;
    document.getElementById("modal-message").innerText = message;
    
    const shareBtn = document.getElementById("share-btn");
    const supportBtn = document.getElementById("modal-support-btn");

    if (showShare) {
        shareBtn.classList.remove("hidden");
        // Show donate button on Game Over / Win
        if(supportBtn) supportBtn.classList.remove("hidden");
    } else {
        shareBtn.classList.add("hidden");
        // Hide donate button if not sharing (shouldn't happen here often, but good for safety)
        if(supportBtn) supportBtn.classList.add("hidden");
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

    addFeedbackRow(guess, data.status, data.answer);

    if (data.advance) {
        disableInput();
        const pBtn = document.getElementById("persistent-share-btn");
        if (pBtn) pBtn.classList.remove("hidden");

        if (data.status === "correct") {
            solved = true;
            renderBoard();
            showModal("Congratulations!", `The answer was ${data.answer}.`, true);
        } else {
            showModal("Game Over", `The answer was ${data.answer}. Try again tomorrow!`, true);
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
