// This component provides a user interface for managing application settings,
// such as timezone, calendar display options, and event durations.
import React, { useState, useEffect } from 'react'; 
import classes from './SettingsModal.module.css';
import { CloseIcon, ErrorText } from "./UIComponents.jsx";

/**
 * A utility function to fetch the UTC offset for a given timezone.
 * It handles potential errors and provides a consistent format.
 * @param {string} tz - The IANA timezone string (e.g., 'Europe/London').
 * @returns {string} The formatted UTC offset string (e.g., ' (UTC+0)').
 */
const getTimezoneOffset = (tz) => {
    try {
        const now = new Date();
        // Use toLocaleString to get the timezone name with offset
        const offset = now.toLocaleString('en-US', { timeZone: tz, timeZoneName: 'shortOffset' });
        // Regex to capture the UTC offset value
        const offsetMatch = offset.match(/GMT([+-]\d{1,2})|UTC([+-]\d{1,2})/i);
        
        // Return a formatted string if an offset is found
        if (offsetMatch) {
            return ` (UTC${offsetMatch[1] || offsetMatch[2]})`;
        }
        
        // Fallback for timezones where offset is not easily matched
        return ` (${now.toLocaleTimeString('en-US', { timeZone: tz, timeZoneName: 'short' })})`;
    } catch (e) {
        // Return an empty string on error to prevent UI issues
        console.error(`Error getting timezone offset for ${tz}:`, e);
        return '';
    }
};

/**
 * An array of common timezones pre-formatted with their labels and UTC offsets.
 * This array is defined outside the component to prevent re-computation on every render.
 */
const commonTimezones = [
    { name: 'Europe/London', value: 'Europe/London' },
    { name: 'Europe/Paris', value: 'Europe/Paris' },
    { name: 'Asia/Tokyo', value: 'Asia/Tokyo' },
    { name: 'Asia/Shanghai', value: 'Asia/Shanghai' },
    { name: 'UTC', value: 'UTC' }
].map(tz => {
    // Determine the offset label for each timezone
    const offsetLabel = tz.value === 'UTC' ? ' (UTC+0)' : getTimezoneOffset(tz.value);
    return { ...tz, label: `${tz.name}${offsetLabel}` };
});

/**
 * The SettingsModal component.
 * @param {object} props - The component props.
 * @param {boolean} props.isOpen - Controls the modal's visibility.
 * @param {function} props.onClose - Callback function to close the modal.
 * @param {function} props.onSave - Callback function to save the settings.
 * @param {object} props.currentSettings - An object containing the initial settings.
 * @returns {JSX.Element|null} The modal component or null if not open.
 */
const SettingsModal = ({ isOpen, onClose, onSave, currentSettings }) => {
    // Initialize state with values from currentSettings prop.
    const [selectedTimezone, setSelectedTimezone] = useState(currentSettings.timezone);
    const [showExpanded, setShowExpanded] = useState(currentSettings.showExpanded);
    // State for event slot duration with a fallback to '00:30:00'
    const [selectedSlotDuration, setSelectedSlotDuration] = useState(currentSettings.slotDuration || '00:30:00');

    // Early return to prevent rendering if the modal is not open.
    if (!isOpen) {
        return null;
    }

    /**
     * Handles the save action, calling the parent's onSave function with
     * the current state of all settings.
     */
    const handleSave = () => {
        onSave({
            timezone: selectedTimezone,
            showExpanded,
            slotDuration: selectedSlotDuration,
        });
    };

    return (
        // The overlay element handles the click-to-close behavior outside the modal.
        <div className={classes.overlay} onClick={onClose}>
            {/* The modal container. e.stopPropagation() prevents the overlay click event from firing. */}
            <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
                <div className={classes.header}>
                    <h2 className={classes.title}>Settings</h2>
                    <button
                        className={classes['close-button']}
                        onClick={onClose}
                        aria-label="Close modal" 
                    >
                        <CloseIcon />
                    </button>
                </div>
                
                <div className={classes['form-content']}>
                    {/* Timezone Selection Field */}
                    <div className={classes.field}>
                        <label className={classes.label} htmlFor="timezone-select">Timezone</label>
                        <select
                            id="timezone-select"
                            className={classes.input}
                            value={selectedTimezone}
                            onChange={(e) => setSelectedTimezone(e.target.value)}
                        >
                            {/* Map through the pre-computed timezones for options */}
                            {commonTimezones.map((tz) => (
                                <option key={tz.value} value={tz.value}>
                                    {tz.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Slot Duration Selection Field */}
                    <div className={classes.field}>
                        <label className={classes.label} htmlFor="slot-duration-select">Slot Duration</label>
                        <select
                            id="slot-duration-select"
                            className={classes.input}
                            value={selectedSlotDuration}
                            onChange={(e) => setSelectedSlotDuration(e.target.value)}
                        >
                            <option value="00:15:00">15 minutes</option>
                            <option value="00:30:00">30 minutes</option>
                            <option value="00:45:00">45 minutes</option>
                            <option value="01:00:00">1 hour</option>
                        </select>
                    </div>
                    {/* Checkbox for expanded occurrences */}
                    <div className={classes.field}>
                        <label htmlFor="show-expanded" className={classes['checkbox-container']}>
                            <input
                                type="checkbox"
                                id="show-expanded"
                                className={classes['hidden-checkbox']}
                                checked={showExpanded}
                                onChange={(e) => setShowExpanded(e.target.checked)}
                            />
                            {/* Custom checkbox visual element */}
                            <div className={classes['custom-checkbox']}>
                                <div className={classes.checkmark}></div>
                            </div>
                            <span className={classes.label}>
                                Show expanded occurrences
                            </span>
                        </label>
                    </div>
                </div>

                {/* Action Buttons Section */}
                <div className={classes.actions}>
                    <button className={`${classes.button} ${classes['cancel-button']}`} onClick={onClose}>
                        Cancel
                    </button>
                    <button className={`${classes.button} ${classes['save-button']}`} onClick={handleSave}>
                        Save Settings
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SettingsModal;