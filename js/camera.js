// Camera and MediaPipe initialization
let video;
let faceMesh;
let camera;
let canvasCtx;
let canvasElement;

// Drawing settings
const drawingSettings = {
	showVideo: false,
	showLandmarks: true,
	showEyeRegions: true,
	showIris: true,
	landmarkColor: 'rgba(255, 255, 255, 0.5)',
	eyeRegionColor: 'rgba(74, 222, 128, 0.6)',
	irisColor: 'rgba(168, 85, 247, 0.8)',
	connectionColor: 'rgba(255, 255, 255, 0.3)'
};

async function initMediaPipe() {
	try {
		document.getElementById('cameraStatus').textContent = 'Initializing MediaPipe...';
		document.getElementById('cameraStatus').className = 'camera-status camera-loading';

		// Initialize canvas
		canvasElement = document.getElementById('output-canvas');
		canvasCtx = canvasElement.getContext('2d');

		// Initialize MediaPipe Face Mesh
		faceMesh = new FaceMesh({
			locateFile: (file) => {
				return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
			}
		});

		faceMesh.setOptions({
			maxNumFaces: 1,
			refineLandmarks: true, // Enable iris tracking
			minDetectionConfidence: 0.5, // Reduced from 0.7 for faster detection
			minTrackingConfidence: 0.5, // Reduced from 0.6 for faster tracking
			processEveryNthFrame: 1 // Process every frame for more responsive blink detection
		});
		faceMesh.onResults(onResults);

		// Initialize camera with lower resolution for better performance
		video = document.getElementById('video');
		camera = new Camera(video, {
			onFrame: async () => {
				await faceMesh.send({image: video});
			},
			width: 320,
			height: 240,
			facingMode: 'user'
		});

		await camera.start();
		
		document.getElementById('cameraStatus').textContent = 'Eye-tracking is active';
		document.getElementById('cameraStatus').className = 'camera-status camera-ready';

	} catch (error) {
		console.error('MediaPipe initialization error:', error);
		document.getElementById('cameraStatus').textContent = 'MediaPipe Error - manual mode enabled';
		document.getElementById('cameraStatus').className = 'camera-status camera-error';
		manualMode = true;
		updateManualModeUI();
	}
}

function drawFaceMesh(results) {
	if (!canvasCtx || !canvasElement) return;

	// Set canvas size to match video
	canvasElement.width = video.videoWidth;
	canvasElement.height = video.videoHeight;

	// Clear the canvas
	canvasCtx.clearRect(0, 0, canvasElement.width, canvasElement.height);

	if (!results.multiFaceLandmarks || results.multiFaceLandmarks.length === 0) return;

	const landmarks = results.multiFaceLandmarks[0];

	// Draw face mesh connections
	if (drawingSettings.showLandmarks) {
		canvasCtx.lineWidth = 1;
		canvasCtx.strokeStyle = drawingSettings.connectionColor;
		canvasCtx.fillStyle = drawingSettings.landmarkColor;

		// Draw face oval connections
		for (let i = 0; i < FACE_OVAL.length - 1; i++) {
			const start = landmarks[FACE_OVAL[i]];
			const end = landmarks[FACE_OVAL[i + 1]];
			if (start && end) {
				canvasCtx.beginPath();
				canvasCtx.moveTo(start.x * canvasElement.width, start.y * canvasElement.height);
				canvasCtx.lineTo(end.x * canvasElement.width, end.y * canvasElement.height);
				canvasCtx.stroke();
			}
		}
	}

	// Draw eye regions
	if (drawingSettings.showEyeRegions) {
		canvasCtx.strokeStyle = drawingSettings.eyeRegionColor;
		canvasCtx.lineWidth = 2;

		// Draw left eye
		drawEyeRegion(LEFT_EYE_INDICES, landmarks, canvasCtx, canvasElement);
		// Draw right eye
		drawEyeRegion(RIGHT_EYE_INDICES, landmarks, canvasCtx, canvasElement);
	}

	// Draw iris landmarks
	if (drawingSettings.showIris) {
		canvasCtx.fillStyle = drawingSettings.irisColor;
		canvasCtx.strokeStyle = drawingSettings.irisColor;
		canvasCtx.lineWidth = 2;

		// Draw left iris
		drawIris(LEFT_IRIS_LANDMARKS, landmarks, canvasCtx, canvasElement);
		// Draw right iris
		drawIris(RIGHT_IRIS_LANDMARKS, landmarks, canvasCtx, canvasElement);
	}
}

function drawEyeRegion(indices, landmarks, ctx, canvas) {
	if (!ctx || indices.length < 3) return;

	ctx.beginPath();
	
	const firstPoint = landmarks[indices[0]];
	ctx.moveTo(
		firstPoint.x * canvas.width,
		firstPoint.y * canvas.height
	);

	// Draw lines connecting all points
	for (let i = 1; i < indices.length; i++) {
		const point = landmarks[indices[i]];
		ctx.lineTo(
			point.x * canvas.width,
			point.y * canvas.height
		);
	}

	// Connect back to the first point
	ctx.lineTo(
		firstPoint.x * canvas.width,
		firstPoint.y * canvas.height
	);
	ctx.stroke();
}

function drawIris(indices, landmarks, ctx, canvas) {
	if (!ctx || indices.length < 5) return;

	// Draw iris center point
	const center = landmarks[indices[0]];
	const centerX = center.x * canvas.width;
	const centerY = center.y * canvas.height;
	
	// Draw iris outline using the other points
	ctx.beginPath();
	for (let i = 1; i < indices.length; i++) {
		const point = landmarks[indices[i]];
		const x = point.x * canvas.width;
		const y = point.y * canvas.height;
		
		if (i === 1) {
			ctx.moveTo(x, y);
		} else {
			ctx.lineTo(x, y);
		}
	}
	ctx.closePath();
	ctx.stroke();
	
	// Draw iris center with a larger, more visible point
	ctx.beginPath();
	ctx.arc(centerX, centerY, 4, 0, 2 * Math.PI);
	ctx.fill();
	
	// Draw crosshair at iris center
	const crosshairSize = 8;
	ctx.beginPath();
	ctx.moveTo(centerX - crosshairSize, centerY);
	ctx.lineTo(centerX + crosshairSize, centerY);
	ctx.moveTo(centerX, centerY - crosshairSize);
	ctx.lineTo(centerX, centerY + crosshairSize);
	ctx.stroke();
}
