# Eye Blink Communication System

A web-based communication system that allows users to select letters and words using eye blinks, eye movements, or manual controls. The system supports multiple languages and customizable grids.

## Features

- **Multiple Input Methods**:
  - Eye Blink Detection
  - Eye Movement Navigation
  - Manual Keyboard Control
  
- **Customization**:
  - Configurable Grid Layout
  - Multiple Languages (English, Russian, Ukrainian)
  - Adjustable Blink Speed (Fast/Slow)
  
- **Calibration Tools**:
  - Eye Movement Calibration
  - Blink Detection Calibration
  
- **Debug Mode**:
  - Real-time Eye Metrics
  - Visual Feedback
  - Performance Monitoring

## Grid Configuration

### Using the Grid Editor

1. Navigate to `grid.html` in your browser
2. Enter your grid content in CSV format
3. Use special keys:
   - `{space}` for space character
   - `{backspace}` for delete function
4. Click "Generate Link" to create a URL with your custom grid
5. Use the generated link to load your custom grid

### Example Grid CSV:
```csv
YES,NO,{space},{backspace},STOP,END
A,B,C,D,E,F
G,H,I,J,K,L
M,N,O,P,Q,R
S,T,U,V,W,X
Y,Z,!,?,.,@
```

### Grid Rules:
- All rows must have the same number of columns
- Grid dimensions are flexible (not limited to 6x6)
- Special keys are case-sensitive
- Empty cells are allowed (use empty value between commas)

## Usage Instructions

### Camera Mode:
1. Allow camera access when prompted
2. Position yourself in a well-lit area
3. Ensure your face is clearly visible
4. Choose your preferred input method:

#### Blink Mode:
- Single blink: Move down one row / next column
- Double blink: Select row / Select character
- Triple blink: Move up one row / Return to row selection
- Adjust blink speed using the Fast/Slow buttons

#### Eye Movement Mode:
- Look in desired direction to navigate
- Double blink to select
- Calibrate eye movement for better accuracy

#### Manual Mode:
- Space: Move to next item
- Enter: Select current item
- Arrow keys: Navigate grid
- Useful for testing without camera

## Language Support

The system supports three languages:
- English
- Russian (Русский)
- Ukrainian (Українська)

Language can be changed using the dropdown menu. When using the default grid, changing language will update the grid content to match the selected language. Custom grids are not affected by language changes.

## Browser Support

- Chrome (recommended)
- Firefox
- Edge
- Safari (limited support)

Requires webcam access and modern browser features.

## Performance Tips

1. Use Chrome for best performance
2. Ensure good lighting conditions
3. Calibrate before first use
4. Position camera at eye level
5. Avoid rapid head movements

## Troubleshooting

If experiencing issues:
1. Check camera permissions
2. Ensure good lighting
3. Try recalibrating
4. Clear browser cache
5. Restart browser
6. Switch to manual mode if needed

## Development

Built using:
- MediaPipe for face tracking
- Vanilla JavaScript
- CSS Grid for layout
- Base64 for grid data encoding