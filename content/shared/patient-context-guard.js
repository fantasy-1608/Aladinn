export class PatientContextGuard {
    /**
     * Creates a composite safety key for a patient session
     * @param {string} patientId 
     * @param {string} encounterId 
     * @param {string} admissionDate 
     * @param {string} formType 
     * @returns {string} The composite key
     */
    static createKey(patientId, encounterId, admissionDate, formType) {
        if (!patientId || !encounterId) {
            throw new Error('Missing required patient identifiers for safety lock');
        }
        // Fallback for optional fields
        const safeDate = admissionDate || 'unknown_date';
        const safeForm = formType || 'unknown_form';
        
        // Simple hash approach or concatenated string
        // Since this runs in content script, a concatenated string is sufficient for comparison
        return `${patientId}_${encounterId}_${safeDate}_${safeForm}`;
    }

    /**
     * Validates if the current context matches the locked context
     * @param {string} lockedKey 
     * @param {string} currentPatientId 
     * @param {string} currentEncounterId 
     * @param {string} currentAdmissionDate 
     * @param {string} currentFormType 
     * @returns {boolean} True if matched, false otherwise
     */
    static validate(lockedKey, currentPatientId, currentEncounterId, currentAdmissionDate, currentFormType) {
        if (!lockedKey) return false;
        
        try {
            const currentKey = this.createKey(currentPatientId, currentEncounterId, currentAdmissionDate, currentFormType);
            return lockedKey === currentKey;
        } catch (_e) {
            return false;
        }
    }
}
