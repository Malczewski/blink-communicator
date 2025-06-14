// Main application state and logic
let currentState = {
	mode: 'row', // Start in row selection mode
	navigationMode: 'blink', // 'blink', 'manual', 'eyeMovement'
	selectedRow: 0,
	selectedColumn: 0,
	isActive: true,
	lastBlinkTime: 0,
	pauseStartTime: 0,
	blinkCount: 0,
	blinkTimeout: null,
	fastBlinkMode: false
};

let manualMode = false;
let debugMode = false;

// Timing constants
const DOUBLE_BLINK_TIMEOUT_SLOW = 400; // Reduced from 500ms
const DOUBLE_BLINK_TIMEOUT_FAST = 250; // Reduced from 300ms
const MODE_SWITCH_DELAY = 1000; // Reduced from 1500ms for faster mode switching

// Minimum time between blinks to prevent accidental detection
const MIN_BLINK_INTERVAL = 100; // ms

// Initialize the application
async function init() {
	// Initialize localization with stored preference
	i18n.init();
	
	// Initialize localization
	setupLanguageSelector();
	i18n.updateUI();
	
	// Ensure we start in row mode with blink navigation
	currentState.mode = 'row';
	currentState.navigationMode = 'blink';
	currentState.selectedRow = 0;
	currentState.selectedColumn = 0;
	
	createGrid();
	updateHighlights(); // Add immediate highlight update after grid creation
	
	if (!manualMode) {
		await initMediaPipe();
		// Load saved calibration data after MediaPipe is initialized
		loadCalibrationData();
		
		// Show video if debug mode is enabled
		const videoContainer = document.querySelector('.video-container');
		if (videoContainer && debugMode) {
			videoContainer.classList.add('show');
		}
	}
	
	// Show/hide blink speed controls based on initial mode
	const blinkSpeedControls = document.getElementById('blinkSpeedControls');
	blinkSpeedControls.style.display = currentState.navigationMode === 'blink' ? 'inline-flex' : 'none';
	
	// Set initial blink speed button states
	document.getElementById('blinkSpeedSlowBtn').classList.toggle('active', !currentState.fastBlinkMode);
	document.getElementById('blinkSpeedFastBtn').classList.toggle('active', currentState.fastBlinkMode);
	
	// Set initial button states
	document.getElementById('manualModeBtn').classList.remove('active');
	document.getElementById('blinkModeBtn').classList.add('active');
	document.getElementById('eyeMovementModeBtn').classList.remove('active');
	
	updateModeIndicator();
	updateHighlights(); // Ensure highlights are updated after all initialization
}

// Setup language selector
function setupLanguageSelector() {
	const languageSelect = document.getElementById('languageSelect');
	languageSelect.value = i18n.getCurrentLanguage();
	
	languageSelect.addEventListener('change', async (event) => {
		const newLanguage = event.target.value;
		await i18n.setLanguage(newLanguage);
		document.documentElement.lang = newLanguage;
	});
}

function onBlink() {
	if (!currentState.isActive) return;
	
	const now = Date.now();
	
	// Prevent too rapid blinks
	if (now - currentState.lastBlinkTime < MIN_BLINK_INTERVAL) {
		return;
	}
	
	totalBlinks++;
	currentState.lastBlinkTime = now;
	currentState.blinkCount++;
	
	if (currentState.blinkTimeout) {
		clearTimeout(currentState.blinkTimeout);
	}
	
	const blinkTimeout = currentState.fastBlinkMode ? DOUBLE_BLINK_TIMEOUT_FAST : DOUBLE_BLINK_TIMEOUT_SLOW;
	
	currentState.blinkTimeout = setTimeout(() => {
		if (currentState.blinkCount === 1) {
			// Only handle single blinks if not in eye movement mode
			if (currentState.navigationMode !== 'eyeMovement') {
				handleSingleBlink();
			}
		} else if (currentState.blinkCount === 2) {
			handleDoubleBlink();
		} else if (currentState.blinkCount >= 3 && currentState.navigationMode === 'blink') {
			handleTripleBlink();
		}
		currentState.blinkCount = 0;
	}, blinkTimeout);
}

function handleSingleBlink() {
	if (currentState.mode === 'row') {
		// Move down one row
		currentState.selectedRow = (currentState.selectedRow + 1) % gridData.length;
		updateStatus(i18n.t('status.rowSelectedDown').replace('{0}', currentState.selectedRow + 1));
	} else if (currentState.mode === 'column') {
		currentState.selectedColumn = (currentState.selectedColumn + 1) % gridData[currentState.selectedRow].length;
		updateStatus(i18n.t('status.columnSelected').replace('{0}', currentState.selectedColumn + 1));
	}
	
	updateHighlights();
}

function handleDoubleBlink() {
	if (currentState.navigationMode === 'eyeMovement') {
		// In eye movement mode, double blink always selects the current cell
		selectCell();
		return;
	}

	// For other modes, handle row/column selection
	if (currentState.mode === 'row') {
		switchToColumnMode();
	} else if (currentState.mode === 'column') {
		selectCell();
	}
}

function handleTripleBlink() {
	if (currentState.navigationMode !== 'blink') return;
	
	if (currentState.mode === 'column') {
		// Go back to row selection
		currentState.mode = 'row';
		updateModeIndicator();
		updateStatus(i18n.t('status.backToRows'));
		updateHighlights();
	} else if (currentState.mode === 'row') {
		// Move up one row (opposite of single blink which moves down)
		currentState.selectedRow = (currentState.selectedRow - 1 + gridData.length) % gridData.length;
		updateStatus(i18n.t('status.rowSelectedUp').replace('{0}', currentState.selectedRow + 1));
		updateHighlights();
	}
}

function switchToColumnMode() {
	currentState.mode = 'column';
	currentState.selectedColumn = 0;
	updateModeIndicator();
	updateStatus(i18n.t('status.columnMode'));
	updateHighlights();
}

function selectCell() {
	const selectedValue = gridData[currentState.selectedRow][currentState.selectedColumn];
	
	// Animate selection
	const cellElements = document.querySelectorAll('.cell');
	const selectedCellIndex = currentState.selectedRow * 6 + currentState.selectedColumn;
	const selectedCell = cellElements[selectedCellIndex];
	
	if (selectedCell) {
		selectedCell.classList.add('selected-animation');
		setTimeout(() => {
			selectedCell.classList.remove('selected-animation');
		}, 800);
	}
	
	// Process the selected value
	processSelection(selectedValue);
	
	// Reset to row mode
	resetToRowMode();
}

function processSelection(value) {
	const textInput = document.getElementById('textInput');
	let currentText = textInput.value;
	
	switch (value) {
		case i18n.t('grid.space'):
			textInput.value = currentText + ' ';
			break;
		case i18n.t('grid.backspace'):
			textInput.value = currentText.slice(0, -1);
			break;
		case i18n.t('grid.yes'):
			textInput.value = currentText + ' ' + i18n.t('grid.yes') + ' ';
			break;
		case i18n.t('grid.no'):
			textInput.value = currentText + ' ' + i18n.t('grid.no') + ' ';
			break;
		case i18n.t('grid.stop'):
			textInput.value = currentText + ' ' + i18n.t('grid.stop') + ' ';
			break;
		case i18n.t('grid.end'):
			updateStatus(i18n.t('status.messageComplete').replace('{0}', textInput.value));
			break;
		default:
			textInput.value = currentText + value;
			break;
	}
}

function resetToRowMode() {
	currentState.mode = 'row';
	currentState.selectedRow = 0;
	currentState.selectedColumn = 0;
	updateModeIndicator();
	updateStatus(i18n.t('status.selectRow'));
	updateHighlights();
}

function updateModeIndicator() {
	const indicator = document.getElementById('modeIndicator');
	switch (currentState.navigationMode) {
		case 'eyeMovement':
			indicator.textContent = i18n.t('mode.eyeMovement');
			break;
		case 'manual':
			indicator.textContent = i18n.t('mode.manual');
			break;
		default:
			indicator.textContent = currentState.mode === 'row' ? i18n.t('mode.row') : i18n.t('mode.column');
			break;
	}
}

function updateStatus(message) {
	document.getElementById('status').textContent = message;
}

// Control functions
function resetSelection() {
	currentState.isActive = true;
	resetToRowMode();
}

function clearText() {
	document.getElementById('textInput').value = '';
}

function toggleCamera() {
	if (camera) {
		camera.stop();
	}
	// Clear calibration when restarting camera
	clearCalibrationData();
	init();
}

function toggleManualMode() {
	setMode('manual');
}

function toggleEyeMovement() {
	setMode('eyeMovement');
}

function setBlinkSpeed(isFast) {
	currentState.fastBlinkMode = isFast;
	
	// Update button states
	document.getElementById('blinkSpeedSlowBtn').classList.toggle('active', !isFast);
	document.getElementById('blinkSpeedFastBtn').classList.toggle('active', isFast);
}

function setMode(newMode) {
	if (newMode === currentState.navigationMode) return;
	
	const wasManual = currentState.navigationMode === 'manual';
	
	// Update mode buttons
	document.getElementById('manualModeBtn').classList.remove('active');
	document.getElementById('blinkModeBtn').classList.remove('active');
	document.getElementById('eyeMovementModeBtn').classList.remove('active');
	
	document.getElementById(newMode + 'ModeBtn').classList.add('active');
	
	// Show/hide blink speed controls based on mode
	const blinkSpeedControls = document.getElementById('blinkSpeedControls');
	blinkSpeedControls.style.display = newMode === 'blink' ? 'inline-flex' : 'none';
	
	// Handle mode-specific setup
	if (newMode === 'manual') {
		if (camera) {
			camera.stop();
		}
		currentState.navigationMode = 'manual';
		updateManualModeUI();
	} else if (newMode === 'eyeMovement') {
		currentState.navigationMode = 'eyeMovement';
		if (wasManual || !camera) {
			init();
		}
		updateStatus(i18n.t('status.eyeMovement'));
	} else { // blink mode
		currentState.navigationMode = 'blink';
		if (wasManual || !camera) {
			init();
		}
		resetToRowMode();
	}
	
	updateModeIndicator();
	updateHighlights(); // Always update highlights when changing modes
}

function startEyeMovementCalibration() {
	// Create calibration overlay if it doesn't exist
	let overlay = document.getElementById('calibrationOverlay');
	if (!overlay) {
		overlay = document.createElement('div');
		overlay.id = 'calibrationOverlay';
		overlay.innerHTML = `
			<div class="calibration-container">
				<div class="calibration-target target-center">
					<span class="material-icons">radio_button_checked</span>
				</div>
				<div class="calibration-target target-left">
					<span class="material-icons">arrow_back</span>
				</div>
				<div class="calibration-target target-right">
					<span class="material-icons">arrow_forward</span>
				</div>
				<div class="calibration-target target-up">
					<span class="material-icons">arrow_upward</span>
				</div>
				<div class="calibration-target target-down">
					<span class="material-icons">arrow_downward</span>
				</div>
				<div class="calibration-instructions"></div>
				<div class="calibration-progress"></div>
			</div>
		`;
		document.body.appendChild(overlay);
	}
	
	overlay.style.display = 'flex';
	startCalibration();
}

// Callback for calibration UI updates
window.updateCalibrationUI = function(step, sampleCount, totalSamples, isPaused) {
	const instructions = document.querySelector('.calibration-instructions');
	const progress = document.querySelector('.calibration-progress');
	const target = document.querySelector('.calibration-target');
	
	if (step === 'none') {
		document.getElementById('calibrationOverlay').style.display = 'none';
		return;
	}
	
	// Update target position
	target.className = 'calibration-target target-' + step;
	if (isPaused) {
		target.classList.add('target-paused');
	} else {
		target.classList.remove('target-paused');
	}
	
	// Update instructions
	if (isPaused) {
		instructions.textContent = i18n.t('calibration.prepare').replace('{0}', i18n.t('calibration.' + step).toLowerCase());
		progress.textContent = i18n.t('calibration.countdown');
	} else {
		instructions.textContent = i18n.t('calibration.' + step);
		progress.textContent = i18n.t('calibration.progress')
			.replace('{0}', sampleCount)
			.replace('{1}', totalSamples);
	}
};

// Callback for calibration completion
window.onCalibrationComplete = function() {
	document.getElementById('calibrationOverlay').style.display = 'none';
	updateStatus(i18n.t('status.eyeMovement'));
};

function updateManualModeUI() {
	document.getElementById('cameraStatus').textContent = i18n.t('manualMode');
	document.getElementById('cameraStatus').className = 'camera-status camera-ready';
}

function toggleDebug() {
	debugMode = !debugMode;
	const debugInfo = document.getElementById('debugInfo');
	const debugBtn = document.getElementById('debugBtn');
	
	if (debugMode) {
		debugInfo.style.display = 'block';
		debugBtn.textContent = i18n.t('buttons.hideDebug');
	} else {
		debugInfo.style.display = 'none';
		debugBtn.textContent = i18n.t('buttons.debug');
	}
}

// Handle eye movement navigation
window.handleEyeMovement = function(direction) {
	if (currentState.navigationMode !== 'eyeMovement') return;

	const gridWidth = gridData[0].length;
	const gridHeight = gridData.length;
	let newRow = currentState.selectedRow;
	let newCol = currentState.selectedColumn;

	switch (direction) {
		case 'up':
			newRow = (newRow - 1 + gridHeight) % gridHeight;
			break;
		case 'down':
			newRow = (newRow + 1) % gridHeight;
			break;
		case 'left':
			newCol = (newCol - 1 + gridWidth) % gridWidth;
			break;
		case 'right':
			newCol = (newCol + 1) % gridWidth;
			break;
		case 'up-left':
			newRow = (newRow - 1 + gridHeight) % gridHeight;
			newCol = (newCol - 1 + gridWidth) % gridWidth;
			break;
		case 'up-right':
			newRow = (newRow - 1 + gridHeight) % gridHeight;
			newCol = (newCol + 1) % gridWidth;
			break;
		case 'down-left':
			newRow = (newRow + 1) % gridHeight;
			newCol = (newCol - 1 + gridWidth) % gridWidth;
			break;
		case 'down-right':
			newRow = (newRow + 1) % gridHeight;
			newCol = (newCol + 1) % gridWidth;
			break;
	}

	currentState.selectedRow = newRow;
	currentState.selectedColumn = newCol;
	
	updateHighlights();
	updateStatus(i18n.t('status.eyeMovementCell')
		.replace('{0}', newRow + 1)
		.replace('{1}', newCol + 1));
};

function updateHighlights() {
	const cells = document.querySelectorAll('.cell');
	cells.forEach((cell, index) => {
		cell.classList.remove('row-highlighted', 'row-selected', 'cell-highlighted');
		
		const row = Math.floor(index / 6);
		const col = index % 6;
		
		if (currentState.navigationMode === 'eyeMovement') {
			// In eye movement mode, only highlight the current cell
			if (row === currentState.selectedRow && col === currentState.selectedColumn) {
				cell.classList.add('cell-highlighted');
			}
		} else if (currentState.mode === 'row') {
			if (row === currentState.selectedRow) {
				cell.classList.add('row-highlighted');
			}
		} else if (currentState.mode === 'column') {
			if (row === currentState.selectedRow) {
				cell.classList.add('row-selected');
				if (col === currentState.selectedColumn) {
					cell.classList.add('cell-highlighted');
				}
			}
		}
	});
}

// Keyboard controls for manual mode
document.addEventListener('keydown', function(event) {
	if (!manualMode) return;
	
	if (event.code === 'Space') {
		event.preventDefault();
		handleSingleBlink();
	} else if (event.code === 'Enter') {
		event.preventDefault();
		handleDoubleBlink();
	} else if (event.code.startsWith('Arrow')) {
		event.preventDefault();
		handleArrowKey(event.code);
	}
});

function handleArrowKey(keyCode) {
	if (!manualMode) return;

	const gridWidth = gridData[0].length;
	const gridHeight = gridData.length;
	let newRow = currentState.selectedRow;
	let newCol = currentState.selectedColumn;

	switch (keyCode) {
		case 'ArrowUp':
			newRow = (newRow - 1 + gridHeight) % gridHeight;
			break;
		case 'ArrowDown':
			newRow = (newRow + 1) % gridHeight;
			break;
		case 'ArrowLeft':
			newCol = (newCol - 1 + gridWidth) % gridWidth;
			break;
		case 'ArrowRight':
			newCol = (newCol + 1) % gridWidth;
			break;
	}

	if (currentState.mode === 'row') {
		currentState.selectedRow = newRow;
	} else {
		currentState.selectedRow = newRow;
		currentState.selectedColumn = newCol;
	}
	
	updateHighlights();
	updateStatus(i18n.t('status.manualCell')
		.replace('{0}', currentState.selectedRow + 1)
		.replace('{1}', currentState.selectedColumn + 1));
}

// Add a function to clear calibration data
function clearCalibrationData() {
	try {
		localStorage.removeItem(STORAGE_KEY_BLINK);
		localStorage.removeItem(STORAGE_KEY_EYE_MOVEMENT);
		console.log('Cleared all calibration data');
		
		// Reset to default values
		userEarThreshold = DEFAULT_EAR_THRESHOLD;
		calibrationOffsetX = 0;
		calibrationOffsetY = 0;
		calibrationScaleX = 1;
		calibrationScaleY = 1;
		
		// Update debug display if needed
		if (debugMode) {
			document.getElementById('blinkThreshold').textContent = userEarThreshold.toFixed(3);
			document.getElementById('eyeMovementThresholdX').textContent = EYE_MOVEMENT_THRESHOLD.toFixed(3);
			document.getElementById('eyeMovementThresholdY').textContent = EYE_MOVEMENT_THRESHOLD.toFixed(3);
		}
	} catch (error) {
		console.error('Error clearing calibration data:', error);
	}
}

// Initialize on page load
window.addEventListener('load', () => {
	// Initialize the app
	init();
	// Ensure initial highlighting is set
	updateHighlights();
});