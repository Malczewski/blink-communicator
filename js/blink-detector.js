// Eye tracking and blink detection
let leftEAR = 0;
let rightEAR = 0;
let avgEAR = 0;
let eyesClosed = false;
let eyesClosedFrames = 0;
let eyesOpenFrames = 0;
let totalBlinks = 0;
let lastProcessedTime = 0;

// Detect mobile device
const isMobileDevice = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

// Set default threshold based on device type
const DEFAULT_EAR_THRESHOLD = isMobileDevice ? 0.24 : 0.35; // Adjusted for better detection
const EAR_THRESHOLD = DEFAULT_EAR_THRESHOLD;
let userEarThreshold = EAR_THRESHOLD;

// Blink detection constants
const MIN_FRAMES_EYES_CLOSED = 1; // Minimum frames eyes must be closed (reduced from 2)
const MIN_FRAMES_EYES_OPEN = 1; // Minimum frames eyes must be open (reduced from 2)
const PROCESS_INTERVAL_MS = 16; // Process at ~60fps

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
const EYE_MOVEMENT_THRESHOLD = 0.15; // Raw threshold value
const EYE_NEUTRAL_THRESHOLD = EYE_MOVEMENT_THRESHOLD * 0.5; // Neutral zone is half of movement threshold
const EYE_MOVEMENT_COOLDOWN = 500; // ms cooldown between eye movements

// Calibration
let isCalibrating = false;
let calibrationStep = 'none'; // none, center, left, right, up, down
let calibrationData = {
	center: { x: 0, y: 0 },
	maxDistances: {
		left: 0,
		right: 0,
		up: 0,
		down: 0
	}
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

// Iris landmark indices
const LEFT_IRIS_LANDMARKS = [468, 469, 470, 471, 472]; // Center, right, top, left, bottom
const RIGHT_IRIS_LANDMARKS = [473, 474, 475, 476, 477]; // Center, right, top, left, bottom

// Face mesh reference points for movement detection
const FACE_OVAL = [10, 338, 297, 332, 284, 251, 389, 356, 454, 323, 361, 288, 397, 365, 379, 378, 400, 377, 152, 148, 176, 149, 150, 136, 172, 58, 132, 93, 234, 127, 162, 21, 54, 103, 67, 109];

// Add storage keys at the top with other constants
const STORAGE_KEY_BLINK = 'blinkCalibrationData';
const STORAGE_KEY_EYE_MOVEMENT = 'eyeMovementCalibrationData';

// Add variables for movement smoothing
let previousX = 0;
let previousY = 0;

// Make threshold dynamic since it will be set during calibration
let eyeMovementThresholdX = 0.15;
let eyeMovementThresholdY = 0.15;
let eyeNeutralThresholdX = 0.075;
let eyeNeutralThresholdY = 0.075;

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
		
		// Store in calibrationData
		if (calibrationStep === 'center') {
			calibrationData.center = avg;
		} else {
			calibrationData[calibrationStep] = avg;
		}
		
		moveToNextCalibrationStep();
	}
}

function finishCalibration() {
	isCalibrating = false;
	calibrationStep = 'none';
	
	// Store calibration center
	calibrationOffsetX = calibrationData.center.x;
	calibrationOffsetY = calibrationData.center.y;
	
	// Calculate max distances from center for each direction
	calibrationData.maxDistances = {
		left: Math.abs(calibrationOffsetX - calibrationData.left.x),
		right: Math.abs(calibrationData.right.x - calibrationOffsetX),
		up: Math.abs(calibrationOffsetY - calibrationData.up.y),
		down: Math.abs(calibrationData.down.y - calibrationOffsetY)
	};
	
	// Set thresholds to 50% of the average max distance in each axis
	eyeMovementThresholdX = (calibrationData.maxDistances.left + calibrationData.maxDistances.right) / 4; // 50% of average
	eyeMovementThresholdY = (calibrationData.maxDistances.up + calibrationData.maxDistances.down) / 4; // 50% of average
	eyeNeutralThresholdX = eyeMovementThresholdX * 0.5;
	eyeNeutralThresholdY = eyeMovementThresholdY * 0.5;
	
	// Save the calibration data
	saveEyeMovementCalibration(calibrationOffsetX, calibrationOffsetY, calibrationData.maxDistances);
	
	// Update debug display
	if (debugMode) {
		document.getElementById('eyeMovementThresholdX').textContent = eyeMovementThresholdX.toFixed(3);
		document.getElementById('eyeMovementThresholdY').textContent = eyeMovementThresholdY.toFixed(3);
	}
	
	console.log('Calibration complete:', {
		center: { x: calibrationOffsetX, y: calibrationOffsetY },
		maxDistances: calibrationData.maxDistances,
		thresholds: {
			x: eyeMovementThresholdX,
			y: eyeMovementThresholdY,
			neutralX: eyeNeutralThresholdX,
			neutralY: eyeNeutralThresholdY
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
	
	// Save the calibration data
	saveBlinkCalibration(userEarThreshold);
	
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

	const now = performance.now();
	const timeSinceLastProcess = now - lastProcessedTime;
	
	// Limit processing frequency
	if (timeSinceLastProcess < PROCESS_INTERVAL_MS) {
		return;
	}
	lastProcessedTime = now;

	// Draw face mesh visualization
	if (debugMode) {
		drawFaceMesh(results);
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

	// Always calculate eye movement for debugging, regardless of mode
	calculateEyeMovement(landmarks);

	// Update debug info
	if (debugMode) {
		document.getElementById('leftEAR').textContent = leftEAR.toFixed(3);
		document.getElementById('rightEAR').textContent = rightEAR.toFixed(3);
		document.getElementById('avgEAR').textContent = avgEAR.toFixed(3);
		document.getElementById('blinkThreshold').textContent = userEarThreshold.toFixed(3);
		document.getElementById('eyeState').textContent = eyesClosed ? 'closed' : 'open';
		document.getElementById('blinkCount').textContent = totalBlinks;
	}

	// Blink detection logic using calibrated threshold
	if (avgEAR < userEarThreshold) {
		if (!eyesClosed) {
			eyesClosedFrames++;
			if (eyesClosedFrames >= MIN_FRAMES_EYES_CLOSED) {
				eyesClosed = true;
				eyesOpenFrames = 0;
			}
		}
	} else {
		if (eyesClosed) {
			eyesOpenFrames++;
			if (eyesOpenFrames >= MIN_FRAMES_EYES_OPEN) {
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
	// Calculate eye corners and iris centers for both eyes
	const leftEyeCorners = {
		left: landmarks[33],   // Left corner of left eye
		right: landmarks[133], // Right corner of left eye
		top: landmarks[159],   // Top point of left eye
		bottom: landmarks[145] // Bottom point of left eye
	};
	
	const rightEyeCorners = {
		left: landmarks[362],  // Left corner of right eye
		right: landmarks[263], // Right corner of right eye
		top: landmarks[386],   // Top point of right eye
		bottom: landmarks[374] // Bottom point of right eye
	};
	
	const leftIris = landmarks[LEFT_IRIS_LANDMARKS[0]];  // Center of left iris
	const rightIris = landmarks[RIGHT_IRIS_LANDMARKS[0]]; // Center of right iris
	
	// Calculate relative position of iris within eye bounds for both eyes
	const leftEyeRelative = {
		x: -((leftIris.x - leftEyeCorners.left.x) / (leftEyeCorners.right.x - leftEyeCorners.left.x) - 0.5),
		y: ((leftIris.y - leftEyeCorners.top.y) / (leftEyeCorners.bottom.y - leftEyeCorners.top.y) - 0.5)
	};
	
	const rightEyeRelative = {
		x: -((rightIris.x - rightEyeCorners.left.x) / (rightEyeCorners.right.x - rightEyeCorners.left.x) - 0.5),
		y: ((rightIris.y - rightEyeCorners.top.y) / (rightEyeCorners.bottom.y - rightEyeCorners.top.y) - 0.5)
	};
	
	// Average the relative positions from both eyes
	let rawX = (leftEyeRelative.x + rightEyeRelative.x) / 2;
	let rawY = -(leftEyeRelative.y + rightEyeRelative.y) / 2; // Invert Y so up is positive
	
	// Center the values around calibrated center
	eyeMovementX = rawX - calibrationOffsetX;
	eyeMovementY = rawY - calibrationOffsetY;
	
	// Apply smoothing using exponential moving average
	const smoothingFactor = 0.2; // Lower = more smoothing
	eyeMovementX = eyeMovementX * smoothingFactor + (1 - smoothingFactor) * (previousX || 0);
	eyeMovementY = eyeMovementY * smoothingFactor + (1 - smoothingFactor) * (previousY || 0);
	previousX = eyeMovementX;
	previousY = eyeMovementY;

	// Always update debug display if enabled, regardless of mode
	if (debugMode) {
		document.getElementById('eyeMovementX').textContent = eyeMovementX.toFixed(3);
		document.getElementById('eyeMovementY').textContent = eyeMovementY.toFixed(3);
		document.getElementById('eyeMovementThresholdX').textContent = eyeMovementThresholdX.toFixed(3);
		document.getElementById('eyeMovementThresholdY').textContent = eyeMovementThresholdY.toFixed(3);
		document.getElementById('eyeMovementCenterX').textContent = '0.000'; // Center is now always 0,0
		document.getElementById('eyeMovementCenterY').textContent = '0.000'; // Center is now always 0,0
		
		// Update cursor position - scale to ±100px for visualization
		const cursor = document.querySelector('.eye-cursor');
		if (cursor) {
			const scale = 300; // Increase visualization scale since raw values are smaller
			const cursorX = scale * eyeMovementX;
			const cursorY = -scale * eyeMovementY; // Invert Y for screen coordinates
			cursor.style.transform = `translate(calc(-50% + ${cursorX}px), calc(-50% + ${cursorY}px))`;
			
			// Update cursor color based on neutral state
			cursor.classList.toggle('neutral', isEyeMovementNeutral);
		}
	}

	if (isCalibrating) {
		processCalibrationSample(rawX, rawY);
		return;
	}

	const now = Date.now();
	const movementMagnitudeX = Math.abs(eyeMovementX);
	const movementMagnitudeY = Math.abs(eyeMovementY);

	// Check if eyes have returned to neutral position using separate X/Y thresholds
	if (movementMagnitudeX <= eyeNeutralThresholdX && movementMagnitudeY <= eyeNeutralThresholdY) {
		isEyeMovementNeutral = true;
	} else {
		// Only process movement if we're in neutral state and past cooldown
		if (isEyeMovementNeutral && now - lastEyeMovementTime > EYE_MOVEMENT_COOLDOWN) {
			const direction = getEyeMovementDirection(eyeMovementX, eyeMovementY);
			if (direction) {
				onEyeMovement(direction);
				lastEyeMovementTime = now;
				isEyeMovementNeutral = false;
			}
		}
	}
}

function getEyeMovementDirection(x, y) {
	// Check for diagonal movements first using separate X/Y thresholds
	if (Math.abs(x) > eyeMovementThresholdX * 0.7 && Math.abs(y) > eyeMovementThresholdY * 0.7) {
		if (x > 0 && y > 0) return 'up-right';
		if (x < 0 && y > 0) return 'up-left';
		if (x > 0 && y < 0) return 'down-right';
		if (x < 0 && y < 0) return 'down-left';
	}
	
	// Check for cardinal directions using separate thresholds
	if (Math.abs(x) > eyeMovementThresholdX) return x > 0 ? 'right' : 'left';
	if (Math.abs(y) > eyeMovementThresholdY) return y > 0 ? 'up' : 'down';
	
	return null;
}

function onEyeMovement(direction) {
	if (window.handleEyeMovement) {
		window.handleEyeMovement(direction);
	}
}

// Add after other initialization code
function loadCalibrationData() {
	try {
		// Load blink calibration
		const blinkData = localStorage.getItem(STORAGE_KEY_BLINK);
		if (blinkData) {
			const { threshold } = JSON.parse(blinkData);
			userEarThreshold = threshold;
			console.log('Loaded blink calibration:', { threshold });
			
			// Update threshold display if debug mode is on
			if (debugMode) {
				document.getElementById('blinkThreshold').textContent = userEarThreshold.toFixed(3);
			}
		}

		// Load eye movement calibration
		const eyeMovementData = localStorage.getItem(STORAGE_KEY_EYE_MOVEMENT);
		if (eyeMovementData) {
			const data = JSON.parse(eyeMovementData);
			calibrationOffsetX = data.offsetX;
			calibrationOffsetY = data.offsetY;
			
			if (data.maxDistances) {
				calibrationData.maxDistances = data.maxDistances;
			}
			
			// Load thresholds
			if (data.thresholds) {
				eyeMovementThresholdX = data.thresholds.x;
				eyeMovementThresholdY = data.thresholds.y;
				eyeNeutralThresholdX = eyeMovementThresholdX * 0.5;
				eyeNeutralThresholdY = eyeMovementThresholdY * 0.5;
			}
			
			console.log('Loaded eye movement calibration:', {
				center: { x: calibrationOffsetX, y: calibrationOffsetY },
				maxDistances: calibrationData.maxDistances,
				thresholds: {
					x: eyeMovementThresholdX,
					y: eyeMovementThresholdY
				}
			});
			
			// Update debug display if it exists
			if (debugMode) {
				document.getElementById('eyeMovementThresholdX').textContent = eyeMovementThresholdX.toFixed(3);
				document.getElementById('eyeMovementThresholdY').textContent = eyeMovementThresholdY.toFixed(3);
			}
		}
	} catch (error) {
		console.error('Error loading calibration data:', error);
	}
}

function saveBlinkCalibration(threshold) {
	try {
		const data = {
			threshold,
			timestamp: Date.now()
		};
		localStorage.setItem(STORAGE_KEY_BLINK, JSON.stringify(data));
		console.log('Saved blink calibration:', data);
	} catch (error) {
		console.error('Error saving blink calibration:', error);
	}
}

function saveEyeMovementCalibration(offsetX, offsetY, maxDistances) {
	try {
		const data = {
			offsetX,
			offsetY,
			maxDistances,
			thresholds: {
				x: eyeMovementThresholdX,
				y: eyeMovementThresholdY
			},
			timestamp: Date.now()
		};
		localStorage.setItem(STORAGE_KEY_EYE_MOVEMENT, JSON.stringify(data));
		console.log('Saved eye movement calibration:', data);
	} catch (error) {
		console.error('Error saving eye movement calibration:', error);
	}
}

function clearCalibrationData() {
	try {
		localStorage.removeItem(STORAGE_KEY_BLINK);
		localStorage.removeItem(STORAGE_KEY_EYE_MOVEMENT);
		console.log('Cleared all calibration data');
		
		// Reset to default values
		userEarThreshold = DEFAULT_EAR_THRESHOLD;
		calibrationOffsetX = 0;
		calibrationOffsetY = 0;
		eyeMovementThresholdX = 0.15;
		eyeMovementThresholdY = 0.15;
		eyeNeutralThresholdX = 0.075;
		eyeNeutralThresholdY = 0.075;
		
		// Reset calibration data structure
		calibrationData = {
			center: { x: 0, y: 0 },
			maxDistances: {
				left: 0,
				right: 0,
				up: 0,
				down: 0
			}
		};
		
		// Update debug display if needed
		if (debugMode) {
			document.getElementById('blinkThreshold').textContent = userEarThreshold.toFixed(3);
			document.getElementById('eyeMovementThresholdX').textContent = eyeMovementThresholdX.toFixed(3);
			document.getElementById('eyeMovementThresholdY').textContent = eyeMovementThresholdY.toFixed(3);
		}
	} catch (error) {
		console.error('Error clearing calibration data:', error);
	}
}

// Update the HTML structure for debug info in index.html
function updateDebugDisplay() {
	if (!debugMode) return;
	
	const debugInfo = document.getElementById('debugInfo');
	if (!debugInfo) return;
	
	// Find the eye movement debug section
	let eyeMovementDebug = debugInfo.querySelector('.eye-movement-debug');
	if (!eyeMovementDebug) {
		eyeMovementDebug = document.createElement('div');
		eyeMovementDebug.className = 'eye-movement-debug';
		debugInfo.appendChild(eyeMovementDebug);
	}
	
	// Update or create the eye movement debug content
	eyeMovementDebug.innerHTML = `
		<div><span>Eye X:</span> <span id="eyeMovementX">0.000</span></div>
		<div><span>Eye Y:</span> <span id="eyeMovementY">0.000</span></div>
		<div><span>Center X:</span> <span id="eyeMovementCenterX">0.000</span></div>
		<div><span>Center Y:</span> <span id="eyeMovementCenterY">0.000</span></div>
		<div><span>X Threshold:</span> <span id="eyeMovementThresholdX">0.000</span></div>
		<div><span>Y Threshold:</span> <span id="eyeMovementThresholdY">0.000</span></div>
		<div class="eye-cursor-container">
			<div class="eye-cursor-center"></div>
			<div class="eye-cursor"></div>
		</div>
	`;
}

function toggleDebug() {
	debugMode = !debugMode;
	const debugInfo = document.getElementById('debugInfo');
	const debugBtn = document.getElementById('debugBtn');
	
	if (debugMode) {
		debugInfo.style.display = 'block';
		debugBtn.textContent = i18n.t('buttons.hideDebug');
		updateDebugDisplay(); // Initialize debug display
		
		// Update current values
		document.getElementById('blinkThreshold').textContent = userEarThreshold.toFixed(3);
		document.getElementById('eyeMovementThresholdX').textContent = eyeMovementThresholdX.toFixed(3);
		document.getElementById('eyeMovementThresholdY').textContent = eyeMovementThresholdY.toFixed(3);
		document.getElementById('eyeMovementCenterX').textContent = (calibrationData.center.x * calibrationScaleX).toFixed(3);
		document.getElementById('eyeMovementCenterY').textContent = (calibrationData.center.y * calibrationScaleY).toFixed(3);
	} else {
		debugInfo.style.display = 'none';
		debugBtn.textContent = i18n.t('buttons.debug');
	}
}