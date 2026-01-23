from flask import Flask, render_template, jsonify, request, session
import json
from datetime import datetime, date, time

# Set the start date (Naive datetime, assuming midnight)
START_DATE = datetime.combine(date(2026, 1, 16), time.min)

app = Flask(__name__)

app.secret_key = "dev-secret-key"  # required for sessions

MAX_GUESSES = 6

def load_puzzles():
    with open("puzzles.json") as f:
        return json.load(f)

def get_daily_index():
    # RELIES ON SERVER SYSTEM TIME (Controlled by Railway Variable)
    today = datetime.combine(date.today(), time.min)
    
    days_since_start = (today - START_DATE).days
    
    if days_since_start < 0:
        days_since_start = 0
    
    puzzles = load_puzzles()
    return days_since_start % len(puzzles)
    
@app.route("/")
def index():
    return render_template("index.html")

@app.route("/puzzle")
def get_puzzle():
    puzzles = load_puzzles()
    idx = get_daily_index()
    puzzle = puzzles[idx]

    # RESET Logic: New Day
    if session.get("daily_index") != idx:
        session["daily_index"] = idx
        session["guess_count"] = 0
        session["history"] = []
        session["solved"] = False

    return jsonify({
        "pairs": puzzle["pairs"],
        "max_guesses": MAX_GUESSES,
        "current_guesses": session.get("guess_count", 0),
        "history": session.get("history", []),
        "solved": session.get("solved", False),
        "day_index": idx + 1,
        # Send Synonyms to Frontend for the Hint Button
        "synonyms": puzzle.get("synonyms", ["No hint available"])
    })

@app.route("/guess", methods=["POST"])
def guess():
    puzzles = load_puzzles()
    data = request.json
    guess_text = data["guess"].strip().lower()

    idx = get_daily_index()
    puzzle = puzzles[idx]

    # Normalization Logic
    def normalize(word):
        word = word.lower().strip()
        if word.endswith("ing"):
            base = word[:-3]
            if len(base) >= 2 and base[-1] == base[-2]: base = base[:-1]
            return base
        elif word.endswith("e"):
            return word[:-1]
        if word.endswith("ed"):
            base = word[:-2]
            if base.endswith("i"): base = base[:-1] + "y"
            return base
        if word.endswith("es"): return word[:-2]
        if word.endswith("s"): return word[:-1]
        return word

    answer = puzzle["answer"].lower()
    # Safely load synonyms
    synonyms = [s.lower() for s in puzzle.get("synonyms", [])]
    
    guess_norm = normalize(guess_text)
    answer_norm = normalize(answer)

    status = "wrong"
    advance = False
    reveal_answer = None

    # 1. Check Logic
    if guess_text == answer:
        status = "correct"
        advance = True
        session["solved"] = True
        reveal_answer = puzzle["answer"]
    elif guess_text in synonyms:
        status = "close"
    elif guess_norm == answer_norm:
        status = "close"
    
    # 2. Update Session
    session["guess_count"] += 1
    
    # Check for game over (loss)
    if not session["solved"] and session["guess_count"] >= MAX_GUESSES:
        status = "fail"
        advance = True
        reveal_answer = puzzle["answer"]

    # 3. Save to History
    history_entry = {
        "guess": guess_text,
        "status": status,
        "answer": reveal_answer
    }
    
    current_history = session.get("history", [])
    current_history.append(history_entry)
    session["history"] = current_history

    return jsonify({
        "status": status,
        "advance": advance,
        "answer": reveal_answer
    })

if __name__ == "__main__":
    app.run(debug=True, extra_files=['static/styles.css'], port=5001)
