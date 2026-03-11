"""
gesture.py — Pure gesture classification from MediaPipe landmarks.

Landmark indices (MediaPipe Hand):
  0  = wrist
  4  = thumb tip
  8  = index tip       6 = index pip
  12 = middle tip     10 = middle pip
  16 = ring tip       14 = ring pip
  20 = pinky tip      18 = pinky pip
"""


class GestureDetector:
    PINCH_THRESHOLD = 0.07   # normalized distance for pinch
    OPEN_PALM_MIN   = 3       # fingers up to count as "open / idle"

    def detect(self, lm) -> str:
        """
        Returns one of:
          'draw'   — index finger only up
          'pinch'  — index + thumb touching (move mode)
          'erase'  — index + middle up, rest down
          'idle'   — open palm or unrecognised
        """
        index_up  = self._finger_up(lm, tip=8,  pip=6)
        middle_up = self._finger_up(lm, tip=12, pip=10)
        ring_up   = self._finger_up(lm, tip=16, pip=14)
        pinky_up  = self._finger_up(lm, tip=20, pip=18)

        pinch_dist = self._dist(lm[8], lm[4])
        is_pinch   = pinch_dist < self.PINCH_THRESHOLD

        # Priority order matters
        if is_pinch and not middle_up and not ring_up and not pinky_up:
            return 'pinch'

        if index_up and middle_up and not ring_up and not pinky_up:
            return 'erase'

        if index_up and not middle_up and not ring_up and not pinky_up:
            return 'draw'

        return 'idle'

    # ── Helpers ───────────────────────────────────────────────────
    @staticmethod
    def _finger_up(lm, tip: int, pip: int) -> bool:
        """Finger is 'up' when tip is higher (smaller y) than PIP joint."""
        return lm[tip].y < lm[pip].y

    @staticmethod
    def _dist(a, b) -> float:
        return ((a.x - b.x) ** 2 + (a.y - b.y) ** 2) ** 0.5
