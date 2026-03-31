# Emotion Detector

This is a simple web app that:

- uses a webcam;
- detects emotion from a person's facial expression;
- maps the result into four categories: `joy`, `sadness`, `neutral`, `anger`;
- changes the entire app background based on the detected emotion;
- starts the camera with the `Turn On Camera` button.

## Files

- `index.html` - app structure
- `styles.css` - visual design and dynamic backgrounds
- `app.js` - camera startup, model loading, and emotion analysis

## Running

Camera access in the browser usually works only through `http://localhost` or `https`. Because of that, do not open the file by double-clicking it.

Good options:

1. run the project with VS Code Live Server;
2. or use any other simple local web server.

For example, if Python is installed:

```powershell
python -m http.server 8000
```

Then open in the browser:

```text
http://localhost:8000
```

## Notes

- The app loads the `face-api.js` library from a CDN and the models from the official `face-api.js` GitHub repository, so an internet connection is required the first time it is opened.
- For better results, use good lighting and keep your face clearly inside the frame.
