// ─── Shared Renderer State ──────────────────────────────────────────────────
const TOTAL_STEPS = 10;
let currentStep = 1;
let mediaRecorder = null;
let audioChunks = [];
let audioContext = null;
let analyserNode = null;
let audioLevelInterval = null;
let isRecording = false;
let isStarting = false;
let history = [];
let currentPreviewAudio = null;
