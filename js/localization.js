// Localization system
const i18n = {
	currentLanguage: 'en',
	STORAGE_KEY: 'preferred_language',
	
	// Default language data
	translations: locales,
	
	// Initialize with stored language preference
	init() {
		const storedLang = localStorage.getItem(this.STORAGE_KEY);
		if (storedLang && this.translations[storedLang]) {
			this.currentLanguage = storedLang;
			this.updateUI();
			
			// Update grid if needed
			const params = new URLSearchParams(window.location.search);
			if (params.has('grid')) {
				if (window.updateGridTranslations) {
					window.updateGridTranslations();
				}
			} else {
				createGrid();
			}
			
			// Update language selector
			const languageSelect = document.getElementById('languageSelect');
			if (languageSelect) {
				languageSelect.value = storedLang;
			}
		}
	},
	
	// Get current language
	getCurrentLanguage() {
		return this.currentLanguage;
	},
	
	// Set language and update UI
	async setLanguage(lang) {
		if (this.translations[lang]) {
			this.currentLanguage = lang;
			
			// Store the preference
			try {
				localStorage.setItem(this.STORAGE_KEY, lang);
			} catch (error) {
				console.warn('Could not save language preference:', error);
			}
			
			this.updateUI();
			
			// Check if we're using a custom grid
			const params = new URLSearchParams(window.location.search);
			if (params.has('grid')) {
				// Update translations in custom grid
				if (window.updateGridTranslations) {
					window.updateGridTranslations();
				}
			} else {
				// Using default grid, recreate it
				createGrid();
			}
		}
	},
	
	// Translate a key
	t(key) {
		const keys = key.split('.');
		let value = this.translations[this.currentLanguage];
		
		for (const k of keys) {
			if (value && value[k]) {
				value = value[k];
			} else {
				console.warn(`Translation missing for key: ${key} in language: ${this.currentLanguage}`);
				return key;
			}
		}
		
		return value;
	},
	
	// Update all UI elements with data-i18n attributes
	updateUI() {
		document.querySelectorAll('[data-i18n]').forEach(element => {
			const key = element.getAttribute('data-i18n');
			element.textContent = this.t(key);
		});
		
		document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
			const key = element.getAttribute('data-i18n-placeholder');
			element.placeholder = this.t(key);
		});
		
		// Update any visible status or mode messages
		if (window.updateModeIndicator) {
			window.updateModeIndicator();
		}
		if (window.updateStatus) {
			const status = document.getElementById('status');
			if (status && status.textContent) {
				window.updateStatus(status.textContent);
			}
		}
	}
};