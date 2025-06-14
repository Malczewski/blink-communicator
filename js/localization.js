// Localization system
class Localization {
	constructor() {
		this.currentLanguage = 'ru';
		this.translations = locales;
		this.supportedLanguages = ['ru', 'en', 'uk'];
	}

	async setLanguage(language) {
		if (!this.supportedLanguages.includes(language)) {
			console.warn(`Language ${language} not supported`);
			return false;
		}

		if (!this.translations[language]) {
			return false;
		}

		this.currentLanguage = language;
		this.updateUI();
		return true;
	}

	t(key) {
		const translation = this.translations[this.currentLanguage];
		if (!translation) return key;
		
		const keys = key.split('.');
		let value = translation;
		
		for (const k of keys) {
			if (value && typeof value === 'object' && k in value) {
				value = value[k];
			} else {
				return key; // Return key if translation not found
			}
		}
		
		return value;
	}

	updateUI() {
		// Update all elements with data-i18n attribute
		document.querySelectorAll('[data-i18n]').forEach(element => {
			const key = element.getAttribute('data-i18n');
			element.textContent = this.t(key);
		});

		// Update placeholders
		document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
			const key = element.getAttribute('data-i18n-placeholder');
			element.placeholder = this.t(key);
		});

		// Update grid if it exists
		if (typeof updateGrid === 'function') {
			updateGrid();
		}

		// Update current status
		if (currentState) {
			const statusKey = currentState.mode === 'row' ? 'status.selectRow' : 'status.selectColumn';
			updateStatus(this.t(statusKey));
		}
	}

	getCurrentLanguage() {
		return this.currentLanguage;
	}

	getSupportedLanguages() {
		return this.supportedLanguages;
	}
}

// Global localization instance
const i18n = new Localization();