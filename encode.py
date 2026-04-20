"""
Encode a local audio file to Base64 for API testing.

Usage:
    python encode_audio.py path/to/audio.mp3
    python encode_audio.py path/to/audio.mp3 --out encoded.txt
"""

import argparse
import base64
import os
import sys


def encode_audio(input_path: str, output_path: str | None = None) -> str:
    if not os.path.exists(input_path):
        print(f"Error: file not found: {input_path}", file=sys.stderr)
        sys.exit(1)

    with open(input_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode("utf-8")

    if output_path:
        with open(output_path, "w") as f:
            f.write(encoded)
        print(f"Saved to {output_path}  ({len(encoded)} chars)")
    else:
        print(encoded)

    return encoded


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Base64-encode an audio file")
    parser.add_argument("input", help="Path to .mp3 or .wav file")
    parser.add_argument("--out", default=None, help="Output file path (optional)")
    args = parser.parse_args()
    encode_audio(args.input, args.out)