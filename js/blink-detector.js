// Eye tracking and blink detection
let leftEAR = 0;
let rightEAR = 0;
let avgEAR = 0;
let eyesClosed = false;
let eyesClosedFrames = 0;
let eyesOpenFrames = 0;
let totalBlinks = 0;

// Detect mobile device
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Set default threshold based on device type
const DEFAULT_EAR_THRESHOLD = isMobileDevice ? 0.24 : 0.4;
const EAR_THRESHOLD = DEFAULT_EAR_THRESHOLD; // Default threshold, will be adjusted by calibration
let userEarThreshold = EAR_THRESHOLD;

// Blink calibration
let isBlinkCalibrating = false;
let blinkCalibrationPhase = 'none'; // none, countdown, prepareOpen, open, prepareClosed, closed, complete
let blinkCalibrationData = {
	open: [],
	closed: []
};
let blinkCalibrationStartTime = 0;
let blinkCalibrationCountdown = 3;
const CALIBRATION_DURATION = 3000; // 3 seconds for each measurement
const CALIBRATION_PREPARE_DURATION = 2000; // 2 seconds warning

// Eye movement tracking
let eyeMovementX = 0;
let eyeMovementY = 0;
let lastEyeMovementTime = 0;
let isEyeMovementNeutral = true;
const EYE_MOVEMENT_THRESHOLD = 0.7; // Threshold for detecting eye movement
const EYE_NEUTRAL_THRESHOLD = EYE_MOVEMENT_THRESHOLD * 0.75; // 75% of movement threshold
const EYE_MOVEMENT_COOLDOWN = 500; // ms cooldown between eye movements

// Calibration
let isCalibrating = false;
let calibrationStep = 'none'; // none, center, left, right, up, down
let calibrationData = {
	center: { x: 0, y: 0 },
	left: { x: 0, y: 0 },
	right: { x: 0, y: 0 },
	up: { x: 0, y: 0 },
	down: { x: 0, y: 0 }
};
let calibrationSamples = [];
const SAMPLES_NEEDED = 30; // Number of samples to average for each position
let calibrationOffsetX = 0;
let calibrationOffsetY = 0;
let calibrationScaleX = 1;
let calibrationScaleY = 1;
let isCalibrationPaused = false;
const CALIBRATION_PAUSE_DURATION = 1000; // 1 second pause

const CONSECUTIVE_FRAMES = 2;

// Eye landmark indices for MediaPipe Face Mesh
const LEFT_EYE_INDICES = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_INDICES = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];

// Face mesh reference points for movement detection
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

function startCalibration() {
	isCalibrating = true;
	calibrationStep = 'none';
	calibrationSamples = [];
	moveToNextCalibrationStep();
}

function moveToNextCalibrationStep() {
	isCalibrationPaused = true;
	let nextStep;
	
	switch (calibrationStep) {
		case 'none':
			nextStep = 'center';
			break;
		case 'center':
			nextStep = 'right';
			break;
		case 'right':
			nextStep = 'left';
			break;
		case 'left':
			nextStep = 'up';
			break;
		case 'up':
			nextStep = 'down';
			break;
		case 'down':
			finishCalibration();
			return;
	}
	
	// Update UI immediately to show next position
	updateCalibrationStatus(nextStep, true);
	
	// Wait for pause duration before starting to collect samples
	setTimeout(() => {
		calibrationStep = nextStep;
		calibrationSamples = [];
		isCalibrationPaused = false;
		updateCalibrationStatus(nextStep);
	}, CALIBRATION_PAUSE_DURATION);
}

function updateCalibrationStatus(step, isPaused = false) {
	if (window.updateCalibrationUI) {
		window.updateCalibrationUI(
			step,
			calibrationSamples.length,
			SAMPLES_NEEDED,
			isPaused
		);
	}
}

function processCalibrationSample(x, y) {
	if (!isCalibrating || isCalibrationPaused) return;
	
	calibrationSamples.push({ x, y });
	updateCalibrationStatus(calibrationStep);
	
	if (calibrationSamples.length >= SAMPLES_NEEDED) {
		// Average the samples
		const avg = calibrationSamples.reduce((acc, val) => ({
			x: acc.x + val.x,
			y: acc.y + val.y
		}), { x: 0, y: 0 });
		
		avg.x /= SAMPLES_NEEDED;
		avg.y /= SAMPLES_NEEDED;
		
		calibrationData[calibrationStep] = avg;
		moveToNextCalibrationStep();
	}
}

function finishCalibration() {
	isCalibrating = false;
	calibrationStep = 'none';
	
	// Calculate calibration parameters
	const centerX = calibrationData.center.x;
	const centerY = calibrationData.center.y;
	
	// Calculate the maximum distances in each direction from center
	const distanceRight = calibrationData.right.x - centerX;
	const distanceLeft = centerX - calibrationData.left.x;
	const distanceUp = centerY - calibrationData.up.y;
	const distanceDown = calibrationData.down.y - centerY;
	
	// Use the larger distance for each axis
	const maxDistanceX = Math.max(distanceLeft, distanceRight);
	const maxDistanceY = Math.max(distanceUp, distanceDown);
	
	// Set scale factors to normalize to -1 to 1 range
	calibrationScaleX = maxDistanceX > 0 ? 1 / maxDistanceX : 1;
	calibrationScaleY = maxDistanceY > 0 ? 1 / maxDistanceY : 1;
	
	// Store calibration center
	calibrationOffsetX = centerX;
	calibrationOffsetY = centerY;
	
	// Update debug display
	if (debugMode) {
		document.getElementById('eyeMovementThresholdX').textContent = EYE_MOVEMENT_THRESHOLD.toFixed(3);
		document.getElementById('eyeMovementThresholdY').textContent = EYE_MOVEMENT_THRESHOLD.toFixed(3);
	}
	
	console.log('Calibration complete:', {
		center: { x: centerX, y: centerY },
		distances: { left: distanceLeft, right: distanceRight, up: distanceUp, down: distanceDown },
		scales: { x: calibrationScaleX, y: calibrationScaleY },
		thresholds: {
			movement: EYE_MOVEMENT_THRESHOLD,
			neutral: EYE_NEUTRAL_THRESHOLD
		}
	});
	
	if (window.onCalibrationComplete) {
		window.onCalibrationComplete();
	}
}

function startBlinkCalibration() {
	if (manualMode) {
		alert(i18n.t('status.cameraRequired'));
		return;
	}

	isBlinkCalibrating = true;
	blinkCalibrationPhase = 'countdown';
	blinkCalibrationData = {
		open: [],
		closed: []
	};
	blinkCalibrationStartTime = Date.now();
	blinkCalibrationCountdown = 3;
	
	// Create or show calibration overlay
	let overlay = document.getElementById('blinkCalibrationOverlay');
	if (!overlay) {
		overlay = document.createElement('div');
		overlay.id = 'blinkCalibrationOverlay';
		overlay.innerHTML = `
			<div class="calibration-container">
				<div class="calibration-title"></div>
				<span class="eye-icon material-icons eye-open">visibility</span>
				<span class="eye-icon material-icons eye-closed">visibility_off</span>
				<div class="calibration-instructions"></div>
				<div class="calibration-progress"></div>
			</div>
		`;
		document.body.appendChild(overlay);
	}
	
	overlay.style.display = 'flex';
	updateBlinkCalibrationUI();
}

function updateBlinkCalibrationUI() {
	const title = document.querySelector('#blinkCalibrationOverlay .calibration-title');
	const instructions = document.querySelector('#blinkCalibrationOverlay .calibration-instructions');
	const progress = document.querySelector('#blinkCalibrationOverlay .calibration-progress');
	const eyeOpenIcon = document.querySelector('#blinkCalibrationOverlay .eye-open');
	const eyeClosedIcon = document.querySelector('#blinkCalibrationOverlay .eye-closed');
	
	title.textContent = i18n.t('calibration.blinkTitle');
	
	const now = Date.now();
	const elapsed = now - blinkCalibrationStartTime;

	// Hide both icons initially
	eyeOpenIcon.classList.remove('show', 'animate');
	eyeClosedIcon.classList.remove('show');
	
	switch (blinkCalibrationPhase) {
		case 'countdown':
			instructions.textContent = i18n.t('calibration.blinkWait').replace('{0}', blinkCalibrationCountdown);
			progress.textContent = '';
			eyeOpenIcon.classList.add('show', 'animate');
			break;
		case 'prepareOpen':
			instructions.textContent = i18n.t('calibration.blinkPrepareOpen');
			progress.textContent = i18n.t('calibration.blinkWait')
				.replace('{0}', Math.ceil((CALIBRATION_PREPARE_DURATION - elapsed) / 1000));
			eyeOpenIcon.classList.add('show');
			break;
		case 'open':
			instructions.textContent = i18n.t('calibration.blinkOpenEyes');
			progress.textContent = i18n.t('calibration.blinkProgress')
				.replace('{0}', Math.ceil((CALIBRATION_DURATION - elapsed) / 1000));
			eyeOpenIcon.classList.add('show');
			break;
		case 'prepareClosed':
			instructions.textContent = i18n.t('calibration.blinkPrepareClosed');
			progress.textContent = i18n.t('calibration.blinkWait')
				.replace('{0}', Math.ceil((CALIBRATION_PREPARE_DURATION - elapsed) / 1000));
			eyeClosedIcon.classList.add('show');
			break;
		case 'closed':
			instructions.textContent = i18n.t('calibration.blinkCloseEyes');
			progress.textContent = i18n.t('calibration.blinkProgress')
				.replace('{0}', Math.ceil((CALIBRATION_DURATION - elapsed) / 1000));
			eyeClosedIcon.classList.add('show');
			break;
		case 'complete':
			instructions.textContent = i18n.t('calibration.blinkComplete');
			progress.textContent = '';
			eyeOpenIcon.classList.add('show');
			break;
	}
}

function processBlinkCalibration() {
	if (!isBlinkCalibrating) return;
	
	const now = Date.now();
	const elapsed = now - blinkCalibrationStartTime;
	
	// Handle countdown
	if (blinkCalibrationPhase === 'countdown') {
		const newCountdown = 3 - Math.floor(elapsed / 1000);
		
		if (newCountdown !== blinkCalibrationCountdown) {
			blinkCalibrationCountdown = newCountdown;
			if (blinkCalibrationCountdown <= 0) {
				blinkCalibrationPhase = 'prepareOpen';
				blinkCalibrationStartTime = now;
			}
			updateBlinkCalibrationUI();
		}
		return;
	}
	
	// Handle prepare phases
	if (blinkCalibrationPhase === 'prepareOpen' && elapsed >= CALIBRATION_PREPARE_DURATION) {
		blinkCalibrationPhase = 'open';
		blinkCalibrationStartTime = now;
		blinkCalibrationData.open = [];
		updateBlinkCalibrationUI();
		return;
	}
	
	if (blinkCalibrationPhase === 'prepareClosed' && elapsed >= CALIBRATION_PREPARE_DURATION) {
		blinkCalibrationPhase = 'closed';
		blinkCalibrationStartTime = now;
		blinkCalibrationData.closed = [];
		updateBlinkCalibrationUI();
		return;
	}
	
	// Collect samples during measurement phases
	if (blinkCalibrationPhase === 'open') {
		blinkCalibrationData.open.push(avgEAR);
		if (elapsed >= CALIBRATION_DURATION) {
			blinkCalibrationPhase = 'prepareClosed';
			blinkCalibrationStartTime = now;
			updateBlinkCalibrationUI();
		} else {
			updateBlinkCalibrationUI();
		}
	} else if (blinkCalibrationPhase === 'closed') {
		blinkCalibrationData.closed.push(avgEAR);
		if (elapsed >= CALIBRATION_DURATION) {
			finishBlinkCalibration();
		} else {
			updateBlinkCalibrationUI();
		}
	}
}

function finishBlinkCalibration() {
	isBlinkCalibrating = false;
	blinkCalibrationPhase = 'complete';
	updateBlinkCalibrationUI();
	
	// Calculate average EAR for open and closed states
	const avgOpenEAR = blinkCalibrationData.open.reduce((a, b) => a + b, 0) / blinkCalibrationData.open.length;
	const avgClosedEAR = blinkCalibrationData.closed.reduce((a, b) => a + b, 0) / blinkCalibrationData.closed.length;
	
	// Set threshold to midpoint between open and closed states
	userEarThreshold = (avgOpenEAR + avgClosedEAR) / 2;
	
	// Update threshold display immediately
	if (debugMode) {
		document.getElementById('blinkThreshold').textContent = userEarThreshold.toFixed(3);
	}
	
	console.log('Blink calibration complete:', {
		avgOpenEAR,
		avgClosedEAR,
		threshold: userEarThreshold,
		samples: {
			open: blinkCalibrationData.open.length,
			closed: blinkCalibrationData.closed.length
		}
	});
	
	// Hide overlay after a delay
	setTimeout(() => {
		const overlay = document.getElementById('blinkCalibrationOverlay');
		if (overlay) {
			overlay.style.display = 'none';
		}
	}, 2000);
}

function onResults(results) {
	if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) {
		return;
	}

	const landmarks = results.multiFaceLandmarks[0];
	
	// Calculate Eye Aspect Ratio (EAR) for both eyes
	leftEAR = calculateEAR(landmarks, LEFT_EYE_INDICES);
	rightEAR = calculateEAR(landmarks, RIGHT_EYE_INDICES);
	avgEAR = (leftEAR + rightEAR) / 2;

	// Handle calibration if active
	if (isBlinkCalibrating) {
		processBlinkCalibration();
		return;
	}

	// Calculate eye movement
	if (currentState.mode === 'eye_movement') {
		calculateEyeMovement(landmarks);
	}

	// Update debug info
	if (debugMode) {
		document.getElementById('leftEAR').textContent = leftEAR.toFixed(3);
		document.getElementById('rightEAR').textContent = rightEAR.toFixed(3);
		document.getElementById('avgEAR').textContent = avgEAR.toFixed(3);
		document.getElementById('blinkThreshold').textContent = userEarThreshold.toFixed(3);
		document.getElementById('eyeState').textContent = eyesClosed ? 'closed' : 'open';
		document.getElementById('blinkCount').textContent = totalBlinks;
		if (currentState.mode === 'eye_movement') {
			document.getElementById('eyeMovementX').textContent = eyeMovementX.toFixed(3);
			document.getElementById('eyeMovementY').textContent = eyeMovementY.toFixed(3);
		}
	}

	// Blink detection logic using calibrated threshold
	if (avgEAR < userEarThreshold) {
		if (!eyesClosed) {
			eyesClosedFrames++;
			if (eyesClosedFrames >= CONSECUTIVE_FRAMES) {
				eyesClosed = true;
				eyesOpenFrames = 0;
			}
		}
	} else {
		if (eyesClosed) {
			eyesOpenFrames++;
			if (eyesOpenFrames >= CONSECUTIVE_FRAMES) {
				eyesClosed = false;
				eyesClosedFrames = 0;
				onBlink(); // Blink detected!
			}
		} else {
			eyesClosedFrames = 0;
		}
	}
}

function calculateEAR(landmarks, eyeIndices) {
	let eyePoints;
	if (eyeIndices === LEFT_EYE_INDICES) {
		eyePoints = [
			landmarks[33],  // left corner
			landmarks[159], // top 1
			landmarks[158], // top 2
			landmarks[133], // right corner
			landmarks[153], // bottom 2
			landmarks[144]  // bottom 1
		];
	} else {
		eyePoints = [
			landmarks[362], // left corner
			landmarks[385], // top 1
			landmarks[386], // top 2
			landmarks[263], // right corner
			landmarks[380], // bottom 2
			landmarks[374]  // bottom 1
		];
	}
	
	// EAR formula: (|p2-p6| + |p3-p5|) / (2 * |p1-p4|)
	const d1 = distance(eyePoints[1], eyePoints[5]); // vertical 1
	const d2 = distance(eyePoints[2], eyePoints[4]); // vertical 2
	const d3 = distance(eyePoints[0], eyePoints[3]); // horizontal
	
	const ear = (d1 + d2) / (2.0 * d3);
	return ear;
}

function distance(point1, point2) {
	return Math.sqrt(
		Math.pow(point1.x - point2.x, 2) + 
		Math.pow(point1.y - point2.y, 2)
	);
}

function calculateEyeMovement(landmarks) {
	// Get face center point (average of face oval points)
	let centerX = 0, centerY = 0;
	FACE_OVAL.forEach(idx => {
		centerX += landmarks[idx].x;
		centerY += landmarks[idx].y;
	});
	centerX /= FACE_OVAL.length;
	centerY /= FACE_OVAL.length;

	// Calculate average eye position
	let eyeX = 0, eyeY = 0;
	const eyePoints = [...LEFT_EYE_INDICES, ...RIGHT_EYE_INDICES];
	eyePoints.forEach(idx => {
		eyeX += landmarks[idx].x;
		eyeY += landmarks[idx].y;
	});
	eyeX /= eyePoints.length;
	eyeY /= eyePoints.length;

	// Calculate relative movement from calibration center
	const relativeX = eyeX - calibrationOffsetX;
	const relativeY = eyeY - calibrationOffsetY;
	
	// Apply calibration to normalize to -1 to 1 range
	eyeMovementX = relativeX * calibrationScaleX;
	// Invert Y axis so up is positive
	eyeMovementY = -relativeY * calibrationScaleY;

	// Clamp values to [-1, 1] range
	eyeMovementX = Math.max(-1, Math.min(1, eyeMovementX));
	eyeMovementY = Math.max(-1, Math.min(1, eyeMovementY));

	if (isCalibrating) {
		processCalibrationSample(eyeX, eyeY);
		return;
	}

	const now = Date.now();
	const movementMagnitude = Math.max(Math.abs(eyeMovementX), Math.abs(eyeMovementY));

	// Check if eyes have returned to neutral position
	if (movementMagnitude <= EYE_NEUTRAL_THRESHOLD) {
		isEyeMovementNeutral = true;
		return;
	}

	// Only process movement if we're in neutral state and past cooldown
	if (isEyeMovementNeutral && now - lastEyeMovementTime > EYE_MOVEMENT_COOLDOWN) {
		const direction = getEyeMovementDirection(eyeMovementX, eyeMovementY);
		if (direction) {
			onEyeMovement(direction);
			lastEyeMovementTime = now;
			isEyeMovementNeutral = false;
		}
	}

	// Update debug display
	if (debugMode) {
		document.getElementById('eyeMovementX').textContent = eyeMovementX.toFixed(3);
		document.getElementById('eyeMovementY').textContent = eyeMovementY.toFixed(3);
		document.getElementById('eyeMovementThresholdX').textContent = EYE_MOVEMENT_THRESHOLD.toFixed(3);
		document.getElementById('eyeMovementThresholdY').textContent = EYE_MOVEMENT_THRESHOLD.toFixed(3);
	}
}

function getEyeMovementDirection(x, y) {
	// Check for diagonal movements first
	if (Math.abs(x) > EYE_MOVEMENT_THRESHOLD * 0.7 && Math.abs(y) > EYE_MOVEMENT_THRESHOLD * 0.7) {
		if (x > 0 && y > 0) return 'up-right';
		if (x < 0 && y > 0) return 'up-left';
		if (x > 0 && y < 0) return 'down-right';
		if (x < 0 && y < 0) return 'down-left';
	}
	
	// Check for cardinal directions
	if (Math.abs(x) > EYE_MOVEMENT_THRESHOLD) return x > 0 ? 'right' : 'left';
	if (Math.abs(y) > EYE_MOVEMENT_THRESHOLD) return y > 0 ? 'up' : 'down';
	
	return null;
}

function onEyeMovement(direction) {
	if (window.handleEyeMovement) {
		window.handleEyeMovement(direction);
	}
}