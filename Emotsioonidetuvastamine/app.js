const video = document.getElementById("camera");
const appState = document.getElementById("app-state");
const startCameraButton = document.getElementById("start-camera");
const emotionName = document.getElementById("emotion-name");
const emotionDescription = document.getElementById("emotion-description");
const confidenceValue = document.getElementById("confidence-value");
const confidenceBar = document.getElementById("confidence-bar");
const scoreElements = Array.from(document.querySelectorAll("[data-score]")).reduce((accumulator, element) => {
  accumulator[element.dataset.score] = element;
  return accumulator;
}, {});

const MODEL_BASE_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";

const EMOTION_CONFIG = {
  joy: {
    label: "Joy",
    description: "The background becomes warm and vibrant because the detected expression looks joyful.",
    theme: "joy",
  },
  sadness: {
    label: "Sadness",
    description: "The app switches to a cooler and calmer color palette that matches a sad expression.",
    theme: "sadness",
  },
  neutral: {
    label: "Neutral",
    description: "The facial expression looks balanced, so the interface stays soft and neutral.",
    theme: "neutral",
  },
  anger: {
    label: "Anger",
    description: "A stronger red background shows that the expression resembles anger.",
    theme: "anger",
  },
};

const scoreState = {
  joy: 0,
  sadness: 0,
  neutral: 0,
  anger: 0,
};

let animationFrameId = 0;
let detectionInProgress = false;
let lastDetectionAt = 0;
let missingFaceFrames = 0;
let detectorOptions = null;
let modelsLoaded = false;
let cameraStarted = false;
let isStartingCamera = false;

function setStatus(message) {
  appState.textContent = message;
}

function setButtonState(label, disabled = false) {
  startCameraButton.textContent = label;
  startCameraButton.disabled = disabled;
}

function setTheme(themeName) {
  document.body.className = `theme-${themeName}`;
}

function setConfidence(value) {
  const safeValue = Math.max(0, Math.min(1, value));
  const percentage = Math.round(safeValue * 100);
  confidenceValue.textContent = `${percentage}%`;
  confidenceBar.style.width = `${percentage}%`;
}

function updateScoreBoard(scores) {
  Object.entries(scores).forEach(([key, value]) => {
    if (scoreElements[key]) {
      scoreElements[key].textContent = `${Math.round(value * 100)}%`;
    }
  });
}

function smoothScores(nextScores) {
  const blendFactor = 0.55;

  Object.keys(scoreState).forEach((key) => {
    scoreState[key] = scoreState[key] * (1 - blendFactor) + nextScores[key] * blendFactor;
  });

  return { ...scoreState };
}

function applyEmotionState(emotionKey, confidence) {
  const emotion = EMOTION_CONFIG[emotionKey];
  emotionName.textContent = emotion.label;
  emotionDescription.textContent = emotion.description;
  setConfidence(confidence);
  setTheme(emotion.theme);
}

function resetToWaitingState(message) {
  setStatus(message);
  emotionName.textContent = "Face Not Found";
  emotionDescription.textContent = "Move into the frame and look toward the camera so the analysis can continue.";
  setTheme("waiting");
  setConfidence(0);
  updateScoreBoard({
    joy: 0,
    sadness: 0,
    neutral: 0,
    anger: 0,
  });

  Object.keys(scoreState).forEach((key) => {
    scoreState[key] = 0;
  });
}

function mapFaceApiScores(expressions) {
  return {
    joy: expressions.happy ?? 0,
    sadness: expressions.sad ?? 0,
    neutral: expressions.neutral ?? 0,
    anger: expressions.angry ?? 0,
  };
}

function getDominantEmotion(scores) {
  return Object.entries(scores).reduce(
    (best, [key, value]) => {
      if (value > best.value) {
        return { key, value };
      }

      return best;
    },
    { key: "neutral", value: 0 }
  );
}

async function loadModels() {
  if (modelsLoaded) {
    return;
  }

  setStatus("Loading models...");

  await Promise.all([
    faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_BASE_URL),
    faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_BASE_URL),
    faceapi.nets.faceExpressionNet.loadFromUri(MODEL_BASE_URL),
  ]);

  modelsLoaded = true;
}

async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error("This browser does not support the camera API.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: "user",
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  });

  video.srcObject = stream;

  await new Promise((resolve) => {
    video.onloadedmetadata = () => resolve();
  });

  await video.play();
}

async function analyzeFrame(now) {
  animationFrameId = window.requestAnimationFrame(analyzeFrame);

  if (detectionInProgress || video.readyState < 2 || now - lastDetectionAt < 350) {
    return;
  }

  detectionInProgress = true;
  lastDetectionAt = now;

  try {
    const detection = await faceapi
      .detectSingleFace(video, detectorOptions)
      .withFaceLandmarks()
      .withFaceExpressions();

    if (!detection) {
      missingFaceFrames += 1;

      if (missingFaceFrames >= 2) {
        resetToWaitingState("No face detected in the frame.");
      }

      return;
    }

    missingFaceFrames = 0;
    setStatus("Face detected. Emotion analysis is running...");

    const mappedScores = mapFaceApiScores(detection.expressions);
    const smoothedScores = smoothScores(mappedScores);
    const dominantEmotion = getDominantEmotion(smoothedScores);

    applyEmotionState(dominantEmotion.key, dominantEmotion.value);
    updateScoreBoard(smoothedScores);
  } catch (error) {
    console.error(error);
    window.cancelAnimationFrame(animationFrameId);
    setTheme("error");
    setStatus("An error occurred during analysis.");
    emotionName.textContent = "Error";
    emotionDescription.textContent = "Check your network connection, camera permission, and try reloading the page.";
    setConfidence(0);
  } finally {
    detectionInProgress = false;
  }
}

async function bootstrap() {
  try {
    if (!window.faceapi) {
      throw new Error("face-api.js did not load.");
    }

    await faceapi.tf.ready();
    detectorOptions = new faceapi.SsdMobilenetv1Options({
      minConfidence: 0.35,
    });
    setTheme("waiting");
    setStatus("Press the button to turn on the camera.");
    emotionName.textContent = "Waiting";
    emotionDescription.textContent = "The camera will start only after you press the button.";
    setButtonState("Turn On Camera");
  } catch (error) {
    console.error(error);
    setTheme("error");
    setStatus("The app could not start.");
    emotionName.textContent = "Startup Error";
    emotionDescription.textContent = "Camera startup or model loading failed. Open the app on localhost and allow camera access.";
    setConfidence(0);
    setButtonState("Camera Unavailable", true);
  }
}

async function handleStartCamera() {
  if (cameraStarted || isStartingCamera) {
    return;
  }

  isStartingCamera = true;
  setButtonState("Starting Camera...", true);

  try {
    await startCamera();
    cameraStarted = true;
    setStatus("Camera is on. Loading models...");
    setButtonState("Camera Is On", true);
    await loadModels();
    setStatus("Camera is on. Waiting for a face...");
    animationFrameId = window.requestAnimationFrame(analyzeFrame);
  } catch (error) {
    console.error(error);
    setTheme("error");
    const cameraWasStarted = cameraStarted;
    setStatus(cameraWasStarted ? "Model loading failed." : "Could not start the camera.");
    emotionName.textContent = cameraWasStarted ? "Model Error" : "Camera Error";
    emotionDescription.textContent = cameraWasStarted
      ? "The camera turned on, but the emotion models failed to load. Check your network connection and try again."
      : "Check camera permission so the browser can access the video feed, then try again.";
    setConfidence(0);
    setButtonState("Try Again", false);
    if (cameraWasStarted) {
      cameraStarted = false;
      if (video.srcObject instanceof MediaStream) {
        video.srcObject.getTracks().forEach((track) => track.stop());
        video.srcObject = null;
      }
    }
  } finally {
    isStartingCamera = false;
  }
}

window.addEventListener("beforeunload", () => {
  window.cancelAnimationFrame(animationFrameId);

  if (video.srcObject instanceof MediaStream) {
    video.srcObject.getTracks().forEach((track) => track.stop());
  }
});

startCameraButton.addEventListener("click", handleStartCamera);

bootstrap();
