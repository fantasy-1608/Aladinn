# Clinical Safety & Security Rules

All features must comply with these zero-trust boundaries to ensure clinician protection and patient safety.

## 1. Patient Context Integrity
- **Verification Loop:** All state modifications to the patient record must execute an active-check comparing patient identifiers BEFORE and AFTER calculations/AI workflows.
- **Fail Closed:** If the patient identifier, encounter identifier, tab context, or window context changes at any step, the operation must immediately halt and raise an alert.
- **TTL Limit:** Cached patient context tokens must not exceed a time-to-live (TTL) of **2 minutes** (120,000ms).

## 2. Protected Health Information (PHI) Redaction
- **Complete De-identification:** Before transmitting any string or payload to an LLM provider, names, phone numbers, identity cards, insurance IDs, and addresses must be stripped or masked.
- **Exclusion Check:** If raw patient name fields or identifiers are detected post-redaction, the API connection must abort.

## 3. Auto-Sign Guards
- **User Intent:** The auto-sign loop must only launch via active clinician command.
- **Stability Conditions:** The loop must automatically suspend if the active browser window loses focus, if a tab change occurs, or if an unrecognized modal/e-Seal structure appears on the page.
- **Visual Validation:** Compare document metadata in the signing window directly against the active HIS patient model.
