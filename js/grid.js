// Grid data and UI management
const gridData = [
	['ДА', 'НЕТ', 'ПРОБЕЛ', 'ОТМЕНА', 'СТОП', 'КОНЕЦ'],
	['О', 'А', 'Е', 'И', 'Н', 'Т'],
	['Р', 'С', 'Л', 'В', 'К', 'М'],
	['П', 'У', 'Д', 'Я', 'Ы', 'З'],
	['Б', 'Г', 'Ч', 'Й', 'Х', 'Ж'],
	['Ш', 'Ю', 'Ц', 'Щ', 'Э', 'Ф'],
];

function createGrid() {
	const grid = document.getElementById('grid');
	grid.innerHTML = '';
	
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
	
	updateHighlights();
}

function updateHighlights() {
	const cells = document.querySelectorAll('.cell');
	cells.forEach((cell, index) => {
		cell.classList.remove('row-highlighted', 'row-selected', 'cell-highlighted');
		
		const row = Math.floor(index / 6);
		const col = index % 6;
		
		if (currentState.mode === 'row') {
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