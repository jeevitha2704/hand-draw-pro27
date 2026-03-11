# ✋ Hand Draw Pro

Real-time hand-tracking drawing app — Python backend + beautiful web UI.

## Project Structure

```
hand-draw/
├── app.py              ← Flask server + OpenCV + MediaPipe
├── gesture.py          ← Gesture classification logic
├── requirements.txt
├── templates/
│   └── index.html      ← Main HTML template
└── static/
    ├── css/
    │   └── style.css   ← All styling (dark futuristic theme)
    └── js/
        ├── particles.js ← Spark particle system
        ├── canvas.js    ← Drawing engine (strokes, erase, move)
        ├── gestures.js  ← SSE listener → gesture→action bridge
        └── main.js      ← App bootstrap + UI wiring
```

## Setup & Run

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Run the server
python app.py

# 3. Open browser
# http://localhost:5000
```

## Gestures

| Gesture | Action |
|---|---|
| ☝️ Index finger only | **Draw** — neon glow follows your fingertip |
| 🤌 Index + Thumb pinch | **Move** — grab & drag any drawn shape |
| ✌️ Index + Middle finger | **Erase** — wipe strokes you hover over |
| 🖐️ Open palm / any other | **Idle** — nothing happens |

## Tips
- Good lighting = better hand detection
- Keep hand 1–2 feet from camera
- Camera preview (bottom-right of guide panel) shows skeleton overlay
- Use `Ctrl+Z` to undo, `Esc` to clear all
