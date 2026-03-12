// ─── Audio Recording ────────────────────────────────────────────────────────
function setupRecordingListeners() {
  voiceAI.onStartRecording(async () => {
    await startRecording();
  });

  voiceAI.onStopRecording(async () => {
    await stopRecording();
  });
}

async function startRecording() {
  if (isRecording || isStarting) return;
  isStarting = true;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });

    // Set up audio analysis for level metering
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    analyserNode = audioContext.createAnalyser();
    analyserNode.fftSize = 512;
    source.connect(analyserNode);

    // Set up MediaRecorder
    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : 'audio/webm';

    mediaRecorder = new MediaRecorder(stream, { mimeType });
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      stream.getTracks().forEach((t) => t.stop());

      if (audioLevelInterval) {
        clearInterval(audioLevelInterval);
        audioLevelInterval = null;
      }
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }

      const blob = new Blob(audioChunks, { type: mimeType });
      const arrayBuffer = await blob.arrayBuffer();

      const result = await voiceAI.processAudio(arrayBuffer);

      if (result && !result.error) {
        const historyItem = {
          timestamp: Date.now(),
          rawTranscript: result.rawTranscript,
          cleanText: result.cleanText,
          context: result.context,
          profileName: result.profileName || null,
        };

        let currentHistory = (await voiceAI.getSetting('transcriptionHistory', [])) || [];
        currentHistory.push(historyItem);
        if (currentHistory.length > 50) {
          currentHistory = currentHistory.slice(-50);
        }
        await voiceAI.setSetting('transcriptionHistory', currentHistory);

        showTestResult(result.cleanText || result.rawTranscript);
      }

      isRecording = false;
    };

    mediaRecorder.start(100);
    isRecording = true;
    isStarting = false;

    voiceAI.signalRecordingStarted();
    showTestState('recording');

    // Start audio level monitoring
    const dataArray = new Uint8Array(analyserNode.frequencyBinCount);
    audioLevelInterval = setInterval(() => {
      if (!analyserNode) return;
      analyserNode.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const level = sum / (dataArray.length * 255);
      voiceAI.sendAudioLevel(level);
    }, 50);
  } catch (err) {
    console.error('Failed to start recording:', err);
    isRecording = false;
    isStarting = false;
    voiceAI.signalRecordingFailed(err.message || 'Microphone access denied');
  }
}

async function stopRecording() {
  if (!isRecording || !mediaRecorder) return;

  showTestState('transcribing');

  if (mediaRecorder.state === 'recording') {
    mediaRecorder.stop();
  }
}
