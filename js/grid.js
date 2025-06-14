// Language-specific grid data
const languageGrids = {
	// English grid - optimized for letter frequency (ETAOIN SHRDLU...)
	en: [
		['YES', 'NO', '{space}', '{backspace}', 'STOP', 'END'],
		['E', 'T', 'A', 'O', 'I', 'N'],
		['S', 'H', 'R', 'D', 'L', 'U'],
		['C', 'M', 'W', 'F', 'G', 'Y'],
		['P', 'B', 'V', 'K', 'J', 'Q'],
		['X', 'Z', '.', ',', '?', '!'],
	],
	
	// Russian grid - optimized for letter frequency
	ru: [
		['ДА', 'НЕТ', '{space}', '{backspace}', 'СТОП', 'КОНЕЦ'],
		['О', 'Е', 'А', 'И', 'Н', 'Т'],
		['С', 'Р', 'В', 'Л', 'К', 'М'],
		['Д', 'П', 'У', 'Я', 'Ы', 'Ь'],
		['З', 'Б', 'Г', 'Ч', 'Й', 'Х'],
		['Ж', 'Ш', 'Ю', 'Ц', 'Щ', 'Ф'],
	],
	
	// Ukrainian grid - optimized for letter frequency
	uk: [
		['ТАК', 'НІ', '{space}', '{backspace}', 'СТОП', 'КІНЕЦЬ'],
		['О', 'А', 'И', 'І', 'Н', 'В'],
		['Р', 'Т', 'Е', 'С', 'К', 'М'],
		['У', 'Д', 'Л', 'П', 'З', 'Я'],
		['Б', 'Г', 'Ч', 'Й', 'Х', 'Ж'],
		['Ш', 'Щ', 'Ц', 'Ь', 'Ї', 'Ф'],
	]
};

// Default to English grid if language not found
let defaultGridData = languageGrids.en;
// Initialize gridData with default
let gridData = processGridSpecialChars(defaultGridData);

function loadGridFromUrl() {
	try {
		const params = new URLSearchParams(window.location.search);
		const gridParam = params.get('grid');
		
		if (gridParam) {
			const decodedGrid = JSON.parse(atob(gridParam));
			
			// Validate grid structure
			if (!Array.isArray(decodedGrid) || !decodedGrid.length || !Array.isArray(decodedGrid[0])) {
				throw new Error('Invalid grid structure');
			}
			
			gridData = processGridSpecialChars(decodedGrid);
			console.log('Custom grid loaded:', gridData);
		} else {
			// Use language-specific grid
			const currentLang = i18n.getCurrentLanguage();
			defaultGridData = languageGrids[currentLang] || languageGrids.en;
			gridData = processGridSpecialChars(defaultGridData);
			console.log('Language-specific grid loaded:', currentLang);
		}
	} catch (error) {
		console.error('Error loading grid:', error);
		console.log('Using default language grid');
		const currentLang = i18n.getCurrentLanguage();
		defaultGridData = languageGrids[currentLang] || languageGrids.en;
		gridData = processGridSpecialChars(defaultGridData);
	}
}

// Helper function to process special characters in grid
function processGridSpecialChars(grid) {
	return grid.map(row =>
		row.map(cell => {
			switch (cell) {
				case '{space}':
					return i18n.t('grid.space');
				case '{backspace}':
					return i18n.t('grid.backspace');
				case 'YES':
				case 'ДА':
				case 'ТАК':
					return i18n.t('grid.yes');
				case 'NO':
				case 'НЕТ':
				case 'НІ':
					return i18n.t('grid.no');
				case 'STOP':
				case 'СТОП':
					return i18n.t('grid.stop');
				case 'END':
				case 'КОНЕЦ':
				case 'КІНЕЦЬ':
					return i18n.t('grid.end');
				default:
					return cell;
			}
		})
	);
}

function createGrid() {
	// Load custom grid if available
	loadGridFromUrl();
	
	const grid = document.getElementById('grid');
	grid.innerHTML = '';
	
	const numColumns = gridData[0].length;
	
	// Update grid CSS to match the number of columns
	grid.style.gridTemplateColumns = `repeat(${numColumns}, minmax(0, 1fr))`;
	
	gridData.forEach((row, rowIndex) => {
		row.forEach((cell, colIndex) => {
			const cellElement = document.createElement('div');
			cellElement.className = 'cell';
			cellElement.textContent = cell;
			cellElement.dataset.row = rowIndex;
			cellElement.dataset.col = colIndex;
			grid.appendChild(cellElement);
		});
	});
	
	// Reset selection state when creating grid
	currentState.selectedRow = 0;
	currentState.selectedColumn = 0;
	currentState.mode = 'row'; // Always start in row selection mode
	currentState.navigationMode = currentState.navigationMode || 'blink'; // Keep navigation mode or default to blink
	
	updateHighlights();
}

function updateHighlights() {
	const cells = document.querySelectorAll('.cell');
	cells.forEach((cell) => {
		cell.classList.remove('row-highlighted', 'row-selected', 'cell-highlighted');
		
		const row = parseInt(cell.dataset.row);
		const col = parseInt(cell.dataset.col);
		
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

// Update grid translations when language changes
function updateGridTranslations() {
	if (!gridData) return;
	
	const params = new URLSearchParams(window.location.search);
	if (params.has('grid')) {
		try {
			const decodedGrid = JSON.parse(atob(params.get('grid')));
			gridData = processGridSpecialChars(decodedGrid);
			updateHighlights(); // Refresh the grid display
		} catch (error) {
			console.error('Error updating grid translations:', error);
		}
	} else {
		// Update default grid based on current language
		const currentLang = i18n.getCurrentLanguage();
		defaultGridData = languageGrids[currentLang] || languageGrids.en;
		gridData = processGridSpecialChars(defaultGridData);
		updateHighlights();
	}
}