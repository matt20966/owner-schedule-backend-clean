import React, { useState, useEffect } from "react";
import { DateTime } from 'luxon';
import styles from './AddEditModal.module.css';
import { CloseIcon, ErrorText } from "./UIComponents.jsx";

/**
 * Helper function to determine if a given year is a leap year.
 * This is used for validating the 'February 29th' date selection.
 * @param {number} year - The year to check.
 * @returns {boolean} True if the year is a leap year, otherwise false.
 */
const isLeapYear = (year) => {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

/**
 * A modal component for adding new events.
 * It manages form state, handles user input, performs validation,
 * and calls a parent function to add a new event upon submission.
 * @param {object} props - The component props.
 * @param {boolean} props.isOpen - Controls the visibility of the modal.
 * @param {function} props.onClose - Function to call when the modal should be closed.
 * @param {function} props.onAddEvent - Function to call with new event data upon successful submission.
 */
const AddEventModal = ({ isOpen, onClose, onAddEvent }) => {
    // State to hold all form data inputs
    const [formData, setFormData] = useState({
        title: "",
        date: "",
        startTime: "",
        durationHours: 1,
        durationMinutes: 0,
        link: "",
        frequency: "never",
        frequencyTotal: "1",
        frequencyUnit: "days",
        notes: "",
    });

    // State to hold validation errors for each form field
    const [errors, setErrors] = useState({
        title: "",
        date: "",
        startTime: "",
        notes: "",
        duration: "",
        link: "",
        repeats: "",
        general: "",
    });

    // Constants for maximum input lengths
    const maxTitleLength = 30;
    const maxNotesLength = 100;

    /**
     * Handles changes to any form input and updates the formData state.
     * Includes a specific check to prevent a date input from exceeding 4 digits in the year.
     * @param {object} e - The event object from the input change.
     */
    const handleInputChange = (e) => {
        const { name, value } = e.target;

        if (name === 'date') {
            const [year] = value.split('-');
            if (year && year.length > 4) {
                return; // Prevents updating the state if the year has more than 4 digits
            }
        }

        setFormData(prev => ({ ...prev, [name]: value }));
    };

    /**
     * Resets the form data and validation errors to their initial state.
     * Called after a successful form submission or when the modal is closed.
     */
    const clearForm = () => {
        setFormData({
            title: "",
            date: "",
            startTime: "",
            durationHours: 1,
            durationMinutes: 0,
            link: "",
            frequency: "never",
            frequencyTotal: "1",
            frequencyUnit: "days",
            notes: "",
        });
        setErrors({
            title: "",
            date: "",
            startTime: "",
            notes: "",
            duration: "",
            link: "",
            repeats: "",
            general: "",
        });
    };

    /**
     * An effect hook that runs validation whenever the formData state changes.
     * It updates the `errors` state with any new validation messages.
     */
    useEffect(() => {
        const newErrors = {};
        const { title, date, startTime, notes, durationHours, durationMinutes, link, frequency, frequencyTotal } = formData;
        
        // --- Required fields validation ---
        if (!title.trim()) {
            newErrors.title = "Title is required.";
        } else if (title.length > maxTitleLength) {
            newErrors.title = `Title is too long. Max ${maxTitleLength} characters.`;
        }

        if (!date) {
            newErrors.date = "Date is required.";
        } else {
            // New validation for February 29th in a non-leap year
            const selectedDate = DateTime.fromISO(date);
            if (selectedDate.isValid) {
                if (selectedDate.month === 2 && selectedDate.day === 29) {
                    if (!isLeapYear(selectedDate.year)) {
                        newErrors.date = `You can't select February 29th in ${selectedDate.year}. It is not a leap year.`;
                    }
                }
            } else {
                newErrors.date = "Invalid date format.";
            }
        }

        if (!startTime) {
            newErrors.startTime = "Start time is required.";
        }

        // --- Other fields validation ---
        if (notes.length > maxNotesLength) {
            newErrors.notes = `Notes are too long. Max ${maxNotesLength} characters.`;
        }

        const hours = Number(durationHours);
        const minutes = Number(durationMinutes);
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 24 || minutes < 0 || minutes >= 60) {
            newErrors.duration = "Invalid duration. Hours 0-24, minutes 0-59.";
        } else if (hours === 0 && minutes === 0) {
            newErrors.duration = "Duration must be greater than 0 minutes.";
        }

        const urlRegex = /^(https?:\/\/[^\s$.?#].[^\s]*)$/i;
        if (link && !urlRegex.test(link)) {
            newErrors.link = "Please enter a valid URL.";
        }

        if (frequency !== "never" && frequencyTotal !== "forever") {
            const parsedFrequencyTotal = Number(frequencyTotal);
            if (isNaN(parsedFrequencyTotal) || parsedFrequencyTotal <= 0) {
                newErrors.repeats = "Repeats must be a positive number.";
            }
        }

        setErrors(newErrors);
    }, [formData]); // The effect runs whenever formData changes

    // Renders null if the modal is not open
    if (!isOpen) return null;

    /**
     * Handles the form submission logic.
     * It performs a final validation check and, if successful,
     * formats the event data and calls the onAddEvent prop.
     */
    const handleAdd = () => {
        // Run a final check for required fields and existing errors
        const requiredFields = ['title', 'date', 'startTime'];
        const hasRequiredErrors = requiredFields.some(field => !formData[field]);

        if (hasRequiredErrors || Object.values(errors).some(error => error !== "")) {
            setErrors(prev => ({ ...prev, general: "Please fix the validation errors before submitting." }));
            return;
        }
        
        // Combine date and time to create a Luxon DateTime object for validation
        const combinedDateTime = DateTime.fromISO(`${formData.date}T${formData.startTime}`);
        if (!combinedDateTime.isValid) {
            setErrors(prev => ({ ...prev, general: "The selected date or time is invalid." }));
            return;
        }

        // Calculate the total duration in minutes
        const totalMinutes = Number(formData.durationHours) * 60 + Number(formData.durationMinutes);
        if (totalMinutes <= 0) {
            setErrors(prev => ({ ...prev, general: "Event duration must be greater than 0 minutes." }));
            return;
        }

        // Calculate the total number of days for recurring events
        let totalRepeatsInDays = null;
        if (formData.frequency !== "never") {
            if (formData.frequencyTotal === "forever") {
                totalRepeatsInDays = 999 * 7; // Represents a large number for 'forever'
            } else {
                const parsedFrequencyTotal = Number(formData.frequencyTotal);
                totalRepeatsInDays = formData.frequencyUnit === 'weeks' ? parsedFrequencyTotal * 7 : parsedFrequencyTotal;
            }
        }

        // Construct the final event object to be sent to the parent component
        const newEvent = {
            title: formData.title,
            datetime: combinedDateTime.toISO({ includeOffset: true }),
            duration: totalMinutes,
            link: formData.link,
            notes: formData.notes,
            frequency: formData.frequency,
            frequency_total: totalRepeatsInDays,
        };

        // Call the parent handler with the new event data and then clear the form
        onAddEvent(newEvent);
        clearForm();
        onClose();
    };

    return (
        // Overlay for the modal
        <div className={styles.overlay} onClick={onClose}>
            {/* Modal container - prevents propagation to the overlay to keep it open on click */}
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                <div className={styles.header}>
                    <h2 className={styles.title}>Add New Event</h2>
                    <button className={styles.closeButton} onClick={onClose} aria-label="Close modal">
                        <CloseIcon />
                    </button>
                </div>

                {/* Display a general error message if one exists */}
                {errors.general && (
                    <div className={`${styles.message} ${styles.errorMessage}`}>
                        {errors.general}
                    </div>
                )}

                <div className={styles.formContent}>
                    {/* Title field */}
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="new-event-title">
                            Title <span className={styles.required}>*</span>
                        </label>
                        <input 
                            className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
                            id="new-event-title" 
                            type="text" 
                            name="title"
                            value={formData.title} 
                            onChange={handleInputChange} 
                            placeholder="e.g., Team Standup"
                            maxLength={maxTitleLength}
                        />
                        <ErrorText message={errors.title} />
                    </div>

                    <div className={styles.row}>
                        {/* Date field */}
                        <div className={`${styles.field} ${styles.flex1}`}>
                            <label className={styles.label} htmlFor="new-event-date">
                                Date <span className={styles.required}>*</span>
                            </label>
                            <input 
                                className={`${styles.input} ${errors.date ? styles.inputError : ''}`}
                                id="new-event-date" 
                                type="date" 
                                name="date" 
                                value={formData.date} 
                                onChange={handleInputChange} 
                            />
                            <ErrorText message={errors.date} />
                        </div>
                        {/* Start time field */}
                        <div className={`${styles.field} ${styles.flex1}`}>
                            <label className={styles.label} htmlFor="new-event-time">
                                Start Time <span className={styles.required}>*</span>
                            </label>
                            <input 
                                className={`${styles.input} ${errors.startTime ? styles.inputError : ''}`}
                                id="new-event-time" 
                                type="time" 
                                name="startTime" 
                                value={formData.startTime} 
                                onChange={handleInputChange} 
                            />
                            <ErrorText message={errors.startTime} />
                        </div>
                    </div>

                    {/* Link field */}
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="new-event-link">Link</label>
                        <input 
                            className={`${styles.input} ${errors.link ? styles.inputError : ''}`}
                            id="new-event-link" 
                            type="url" 
                            name="link"
                            value={formData.link} 
                            onChange={handleInputChange} 
                            placeholder="e.g., https://zoom.uk/j/123456789"
                        />
                        <ErrorText message={errors.link} />
                    </div>

                    {/* Notes field */}
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="new-event-notes">Notes</label>
                        <textarea 
                            className={`${styles.input} ${styles.textarea} ${errors.notes ? styles.inputError : ''}`}
                            id="new-event-notes" 
                            name="notes"
                            value={formData.notes} 
                            onChange={handleInputChange} 
                            placeholder="e.g., Meeting with Hagrid"
                            maxLength={maxNotesLength}
                        />
                        <ErrorText message={errors.notes} />
                    </div>

                    {/* Duration fields */}
                    <div className={styles.field}>
                        <label className={styles.label}>Duration</label>
                        <div className={styles.durationGroup}>
                            <input
                                className={`${styles.input} ${styles.durationInput} ${errors.duration ? styles.inputError : ''}`}
                                type="number"
                                name="durationHours"
                                value={formData.durationHours}
                                onChange={handleInputChange}
                                min="0"
                                max="24"
                            />
                            <span>hours</span>
                            <input
                                className={`${styles.input} ${styles.durationInput} ${errors.duration ? styles.inputError : ''}`}
                                type="number"
                                name="durationMinutes"
                                value={formData.durationMinutes}
                                onChange={handleInputChange}
                                min="0"
                                max="59"
                            />
                            <span>minutes</span>
                        </div>
                        <ErrorText message={errors.duration} />
                    </div>

                    {/* Frequency selection */}
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="new-event-frequency">Frequency</label>
                        <select className={styles.input} id="new-event-frequency" name="frequency" value={formData.frequency} onChange={handleInputChange}>
                            <option value="never">Never</option>
                            <option value="daily">Daily</option>
                            <option value="every_work_day">Every Work Day (Mon-Fri)</option>
                            <option value="weekly">Weekly</option>
                            <option value="fortnightly">Fortnightly</option>
                        </select>
                    </div>
                    
                    {/* Conditional rendering for recurrence options */}
                    {formData.frequency !== 'never' && (
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="new-event-frequency-total">Repeats for</label>
                            <div className={styles.repeatForGroup}>
                                <input
                                    className={`${styles.input} ${styles.frequencyTotalInput} ${errors.repeats ? styles.inputError : ''}`}
                                    id="new-event-frequency-total"
                                    type="text"
                                    name="frequencyTotal"
                                    value={formData.frequencyTotal}
                                    onChange={handleInputChange}
                                />
                                <select className={styles.input} name="frequencyUnit" value={formData.frequencyUnit} onChange={handleInputChange}>
                                    <option value="days">days</option>
                                    <option value="weeks">weeks</option>
                                </select>
                                <button 
                                    className={`${styles.button} ${styles.foreverButton} ${formData.frequencyTotal === 'forever' ? styles.activeButton : ''}`}
                                    onClick={() => setFormData(prev => ({ ...prev, frequencyTotal: "forever" }))}
                                >
                                    Forever
                                </button>
                            </div>
                            <ErrorText message={errors.repeats} />
                        </div>
                    )}
                </div>
                
                {/* Action buttons */}
                <div className={styles.actions}>
                    <button className={`${styles.button} ${styles.cancelButton}`} onClick={onClose}>
                        Cancel
                    </button>
                    <button className={`${styles.button} ${styles.addButton}`} onClick={handleAdd}>
                        Add Event
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AddEventModal;