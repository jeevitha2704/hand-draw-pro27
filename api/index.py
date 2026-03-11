import json
from flask import Flask, Response
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

@app.route('/')
def hello():
    return {
        "message": "Hand Draw Pro API",
        "status": "Serverless mode - Limited functionality",
        "note": "Full webcam functionality requires server deployment"
    }

@app.route('/api/health')
def health():
    return {"status": "ok"}

# Vercel handler
def handler(request):
    return app(request.environ, lambda status, headers: None)
