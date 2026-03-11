# ✋ Hand Draw Pro

Real-time hand-tracking drawing app with custom logo and multiple line drawing options.

## Features

- 🎨 **Custom Logo**: Branded design with neon glow effects
- 🖊️ **Multiple Line Types**: Normal, Straight, Dashed, Dotted, Double lines
- 📹 **Optimized Tracking**: 60fps capture with improved hand detection
- 🎯 **Continuous Drawing**: Smooth lines even with brief tracking interruptions
- 💫 **Neon Effects**: Beautiful glow effects and particle system
- 🎮 **Gesture Controls**: Draw, Move, Erase with hand gestures

## Project Structure

```
hand-draw/
├── app.py              ← Flask server + OpenCV + MediaPipe
├── gesture.py          ← Gesture classification logic
├── requirements.txt
├── templates/
│   └── index.html      ← Main HTML template with custom logo
└── static/
    ├── css/
    │   └── style.css   ← Dark futuristic theme with line type styles
    ├── js/
    │   ├── particles.js ← Spark particle system
    │   ├── canvas.js    ← Drawing engine with line type support
    │   ├── gestures.js  ← SSE listener with improved tracking
    │   └── main.js      ← App bootstrap + UI wiring
    └── logo.png         ← Custom logo image
```

## Setup & Run

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Download MediaPipe model
# The app will automatically download hand_landmarker.task

# 3. Run the server
python app.py

# 4. Open browser
# http://localhost:5001 (changed from 5000 to avoid conflicts)
```

## Line Drawing Options

| Line Type | Description |
|---|---|
| **Normal** | Curved freehand drawing with smooth curves |
| **Straight** | Direct straight lines from start to end |
| **Dashed** | Dashed line pattern |
| **Dotted** | Dotted line pattern |
| **Double** | Two parallel lines |

## Gestures

| Gesture | Action |
|---|---|
| ☝️ Index finger only | **Draw** — neon glow follows your fingertip |
| 🤌 Index + Thumb pinch | **Move** — grab & drag any drawn shape |
| ✌️ Index + Middle finger | **Erase** — wipe strokes you hover over |
| 🖐️ Open palm / any other | **Idle** — nothing happens |

## Performance Improvements

- **60fps capture** for smoother tracking
- **Lower confidence thresholds** (0.3) for better detection
- **Gap tolerance** for continuous drawing during brief tracking losses
- **Optimized rendering** for better performance

## Deployment

This repository is ready for deployment on platforms like:
- **Heroku** (with webcam support)
- **DigitalOcean** (Docker container)
- **Vercel** (serverless functions)
- **AWS** (EC2 or Lambda)

## Tips

- Good lighting = better hand detection
- Keep hand 1–2 feet from camera
- Camera preview shows skeleton overlay
- Use `Ctrl+Z` to undo, `Esc` to clear all
- Try different line types for creative effects
