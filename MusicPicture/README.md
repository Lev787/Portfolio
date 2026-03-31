# MusicPicture / Chromatune Lab

A web application where the user controls music with photos. The user uploads a photo, the app analyzes its colors and objects, and turns them into a unique music track.

## Run

1. Open a terminal in the project folder.
2. Run `npm start`.
3. Open `http://localhost:3000` in your browser.

## Core Functionality

- image upload or demo scene generation
- color palette, brightness, contrast, saturation, and edge energy analysis
- object detection with the COCO-SSD model, with a heuristic fallback
- music generation with the Web Audio API

## 10 Extra Features

1. AI-style object detection with fallback analysis
2. automatic mood detection
3. four music style presets
4. focus-region analysis
5. palette-driven scale selection
6. arrangement with intro, verse, chorus, and outro sections
7. live visualizer
8. variation shuffle
9. snapshot save/load
10. WAV export
