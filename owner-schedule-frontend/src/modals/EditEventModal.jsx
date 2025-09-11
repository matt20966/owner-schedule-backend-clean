import React, { useState, useEffect } from "react";
import { DateTime } from 'luxon';
import styles from './AddEditModal.module.css';
import { CloseIcon, ErrorText } from "./UIComponents.jsx";

// Helper function to determine if a year is a leap year.
const isLeapYear = (year) => {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
};

// Main component for the event editing modal.
export default function EditEventModal({ isOpen, onClose, onUpdateEvent, onDeleteEvent, event }) {
    // State to hold the form data for the event.
    const [formData, setFormData] = useState({
        title: '',
        date: '',
        startTime: '',
        durationHours: 1,
        durationMinutes: 0,
        link: '',
        frequency: 'never',
        frequencyTotal: '1',
        frequencyUnit: "days",
        notes: '',
    });

    // State to store validation error messages for each field.
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

    // State to track the original event date for change detection.
    const [originalDate, setOriginalDate] = useState('');
    // State to control the visibility of the save action dropdown.
    const [showSaveDropdown, setShowSaveDropdown] = useState(false);
    // State to control the visibility of the delete action dropdown.
    const [showDeleteDropdown, setShowDeleteDropdown] = useState(false);

    // Constant values for maximum allowed length of input fields.
    const maxTitleLength = 30;
    const maxNotesLength = 100;

    // Effect hook to populate the form with event data when the modal opens or the event prop changes.
    useEffect(() => {
        if (event) {
            // Convert total minutes duration to hours and minutes.
            const totalDurationInMinutes = event.duration || 0;
            const durationHours = Math.floor(totalDurationInMinutes / 60);
            const durationMinutes = totalDurationInMinutes % 60;

            // Parse the event datetime using Luxon.
            const startLuxon = DateTime.fromISO(event.datetime, { setZone: true });

            // Determine the initial value for frequency total.
            let initialFrequencyTotal;
            if (event.series?.frequency_total === null) {
                initialFrequencyTotal = "forever";
            } else if (event.series?.frequency_total) {
                initialFrequencyTotal = event.series.frequency_total.toString();
            } else {
                initialFrequencyTotal = "1";
            }

            // Set the form data and original date based on the event details.
            const initialFormData = {
                title: event.title || '',
                date: startLuxon.toISODate() || '',
                startTime: startLuxon.toFormat('HH:mm') || '',
                durationHours,
                durationMinutes,
                link: event.link || '',
                frequency: event.series?.frequency || 'never',
                frequencyTotal: initialFrequencyTotal,
                frequencyUnit: "days",
                notes: event.notes || '',
            };

            setFormData(initialFormData);
            setOriginalDate(initialFormData.date);
            // Reset validation errors.
            setErrors({
                title: "", date: "", startTime: "", notes: "",
                duration: "", link: "", repeats: "", general: "",
            });
        }
    }, [event]);

    // Effect hook for real-time validation of form inputs as they change.
    useEffect(() => {
        const newErrors = {};
        const { title, date, startTime, notes, durationHours, durationMinutes, link, frequency, frequencyTotal } = formData;

        // Validation for title field.
        if (!title.trim()) {
            newErrors.title = "Title is required.";
        } else if (title.length > maxTitleLength) {
            newErrors.title = `Title is too long. Max ${maxTitleLength} characters.`;
        }

        // Validation for date field, including a check for leap years.
        if (!date) {
            newErrors.date = "Date is required.";
        } else {
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

        // Validation for start time.
        if (!startTime) {
            newErrors.startTime = "Start time is required.";
        }

        // Validation for notes length.
        if (notes.length > maxNotesLength) {
            newErrors.notes = `Notes are too long. Max ${maxNotesLength} characters.`;
        }

        // Validation for duration inputs.
        const hours = Number(durationHours);
        const minutes = Number(durationMinutes);
        if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 24 || minutes < 0 || minutes >= 60) {
            newErrors.duration = "Invalid duration. Hours 0-24, minutes 0-59.";
        } else if (hours === 0 && minutes === 0) {
            newErrors.duration = "Duration must be greater than 0 minutes.";
        }

        // Validation for URL format.
        const urlRegex = /^(https?:\/\/[^\s$.?#].[^\s]*)$/i;
        if (link && !urlRegex.test(link)) {
            newErrors.link = "Please enter a valid URL.";
        }

        // Validation for repeat count if the event is recurring.
        if (frequency !== "never" && frequencyTotal !== "forever") {
            const parsedFrequencyTotal = Number(frequencyTotal);
            if (isNaN(parsedFrequencyTotal) || parsedFrequencyTotal <= 0) {
                newErrors.repeats = "Repeats must be a positive number.";
            }
        }

        // Update the errors state with the new validation results.
        setErrors(newErrors);
    }, [formData]);


    // Handles changes to form input fields.
    const handleInputChange = (e) => {
        const { name, value } = e.target;
        // Prevent year from exceeding 4 digits.
        if (name === 'date') {
            const [year] = value.split('-');
            if (year && year.length > 4) {
                return;
            }
        }
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    // Handler specifically for the 'forever' button on the frequency total input.
    const handleFrequencyTotalChange = (value) => {
        setFormData(prev => ({ ...prev, frequencyTotal: value }));
    };

    // Handles the event update logic, triggered by save buttons.
    const handleUpdate = (scope) => {
        // Perform a final validation check before proceeding.
        const requiredFields = ['title', 'date', 'startTime'];
        const hasRequiredErrors = requiredFields.some(field => !formData[field]);

        if (hasRequiredErrors || Object.values(errors).some(error => error !== "")) {
            setErrors(prev => ({ ...prev, general: "Please fix the validation errors before submitting." }));
            return;
        }

        // Combine date and time to create a single DateTime object.
        const combinedDateTime = DateTime.fromISO(`${formData.date}T${formData.startTime}`);
        if (!combinedDateTime.isValid) {
            setErrors(prev => ({ ...prev, general: "The selected date or time is invalid." }));
            return;
        }

        // Calculate total duration in minutes.
        const totalMinutes = Number(formData.durationHours) * 60 + Number(formData.durationMinutes);
        if (totalMinutes <= 0) {
            setErrors(prev => ({ ...prev, general: "Event duration must be greater than 0 minutes." }));
            return;
        }

        // Calculate total repeats in days for the API payload.
        let totalRepeatsInDays = null;
        if (formData.frequency !== "never") {
            if (formData.frequencyTotal === "forever") {
                totalRepeatsInDays = 999 * 7;
            } else {
                const parsedFrequencyTotal = Number(formData.frequencyTotal);
                totalRepeatsInDays = formData.frequencyUnit === 'weeks' ? parsedFrequencyTotal * 7 : parsedFrequencyTotal;
            }
        }
      
        // Construct the payload to be sent to the backend.
        const payload = {
            id: event.id,
            title: formData.title,
            datetime: combinedDateTime.toISO({ includeOffset: true }),
            duration: totalMinutes,
            link: formData.link,
            notes: formData.notes,
            scope: scope,
            frequency: formData.frequency,
            frequency_total: totalRepeatsInDays,
        };

        // Add series data to the payload if the event is part of a series or is being made recurring.
        if (event.series || formData.frequency !== 'never') {
            payload.series_data = {
                frequency: formData.frequency,
                frequency_total: formData.frequencyTotal === 'forever' ? null : Number(formData.frequencyTotal),
            };
        }

        // Call the update function and close the modal.
        onUpdateEvent(payload, scope);
        onClose();
    };

    // Handles the event deletion logic.
    const handleDelete = (scope) => {
        if (event && event.id) {
            // Call the delete function and close the modal.
            onDeleteEvent(event.id, scope);
            onClose();
        } else {
            console.error("Event ID is missing, cannot delete.");
        }
    };

    // Render the modal only if it's open and an event is provided.
    if (!isOpen || !event) return null;

    // Check if the event is part of a recurring series.
    const isRecurring = !!event.series;
    // Check if the date has been changed from the original.
    const hasDateChanged = formData.date !== originalDate;

    return (
        <>
            {/* Modal overlay to handle closing when clicking outside the modal content. */}
            <div className={styles.overlay} onClick={onClose}>
                {/* Modal content container. */}
                <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
                    <div className={styles.header}>
                        <h2 className={styles.title}>Edit Event</h2>
                        <button className={styles.closeButton} onClick={onClose} aria-label="Close modal">
                            <CloseIcon />
                        </button>
                    </div>

                    {/* Display a general error message if one exists. */}
                    {errors.general && (
                        <div className={`${styles.message} ${styles.errorMessage}`}>
                            {errors.general}
                        </div>
                    )}

                    {/* Form fields for event details. */}
                    <div className={`${styles.formContent} modal-form-content`}>
                        {/* Title field. */}
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="edit-event-title">Title <span className={styles.required}></span></label>
                            <input
                                className={`${styles.input} ${errors.title ? styles.inputError : ''}`}
                                id="edit-event-title"
                                type="text"
                                name="title"
                                value={formData.title}
                                onChange={handleInputChange}
                                placeholder="e.g., Team Standup"
                                maxLength={maxTitleLength}
                            />
                            <ErrorText message={errors.title} />
                        </div>

                        {/* Date and Time fields. */}
                        <div className={styles.row}>
                            <div className={`${styles.field} ${styles.flex1}`}>
                                <label className={styles.label} htmlFor="edit-event-date">Date <span className={styles.required}></span></label>
                                <input
                                    className={`${styles.input} ${errors.date ? styles.inputError : ''}`}
                                    id="edit-event-date"
                                    type="date"
                                    name="date"
                                    value={formData.date}
                                    onChange={handleInputChange}
                                />
                                <ErrorText message={errors.date} />
                            </div>
                            <div className={`${styles.field} ${styles.flex1}`}>
                                <label className={styles.label} htmlFor="edit-event-time">Start Time <span className={styles.required}></span></label>
                                <input
                                    className={`${styles.input} ${errors.startTime ? styles.inputError : ''}`}
                                    id="edit-event-time"
                                    type="time"
                                    name="startTime"
                                    value={formData.startTime}
                                    onChange={handleInputChange}
                                />
                                <ErrorText message={errors.startTime} />
                            </div>
                        </div>

                        {/* Duration fields. */}
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

                        {/* Link field. */}
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="edit-event-link">Link</label>
                            <input
                                className={`${styles.input} ${errors.link ? styles.inputError : ''}`}
                                id="edit-event-link"
                                type="url"
                                name="link"
                                value={formData.link}
                                onChange={handleInputChange}
                                placeholder="e.g., https://zoom.us/j/123456789"
                            />
                            <ErrorText message={errors.link} />
                        </div>

                        {/* Notes field. */}
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="edit-event-notes">Notes</label>
                            <textarea
                                className={`${styles.input} ${styles.textarea} ${errors.notes ? styles.inputError : ''}`}
                                id="edit-event-notes"
                                name="notes"
                                value={formData.notes}
                                onChange={handleInputChange}
                                placeholder="e.g., Discuss project milestones and deliverables."
                                maxLength={maxNotesLength}
                            />
                            <ErrorText message={errors.notes} />
                        </div>

                        {/* Frequency dropdown. */}
                        <div className={styles.field}>
                            <label className={styles.label} htmlFor="edit-event-frequency">Frequency</label>
                            <select
                                className={styles.input}
                                id="edit-event-frequency"
                                name="frequency"
                                value={formData.frequency}
                                onChange={handleInputChange}
                            >
                                <option value="never">Never</option>
                                <option value="daily">Daily</option>
                                <option value="every_work_day">Every Work Day (Mon-Fri)</option>
                                <option value="weekly">Weekly</option>
                                <option value="fortnightly">Fortnightly</option>
                            </select>
                        </div>

                        {/* Repeat count section, shown only for recurring events. */}
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
                                        onClick={() => handleFrequencyTotalChange('forever')}
                                    >
                                        Forever
                                    </button>
                                </div>
                                <ErrorText message={errors.repeats} />
                            </div>
                        )}
                    </div>

                    {/* Action buttons for saving and deleting. */}
                    <div className={styles.actions}>
                        {/* Conditional rendering for recurring events. */}
                        {isRecurring ? (
                            <>
                                {/* Delete button with a dropdown for different delete options. */}
                                <div className={styles.dropdownContainer}>
                                    <button
                                        className={`${styles.button} ${styles.deleteButton}`}
                                        onClick={() => {
                                            setShowDeleteDropdown(!showDeleteDropdown);
                                            setShowSaveDropdown(false);
                                        }}
                                    >
                                        Delete...
                                    </button>
                                    {showDeleteDropdown && (
                                        <div className={styles.dropdownContent}>
                                            <button className={styles.dropdownItem} onClick={() => handleDelete('single')}>Delete this event only</button>
                                            <button className={styles.dropdownItem} onClick={() => handleDelete('future')}>Delete all future in series</button>
                                            <button className={styles.dropdownItem} onClick={() => handleDelete('all')}>Delete all in series</button>
                                        </div>
                                    )}
                                </div>
                                {/* Save button with a dropdown for different update options. */}
                                <div className={styles.dropdownContainer}>
                                    <button
                                        className={`${styles.button} ${styles.saveButton}`}
                                        onClick={() => {
                                            if (hasDateChanged) {
                                                handleUpdate('single');
                                            } else {
                                                setShowSaveDropdown(!showSaveDropdown);
                                                setShowDeleteDropdown(false);
                                            }
                                        }}
                                    >
                                        {hasDateChanged ? 'Save' : 'Save Changes...'}
                                    </button>
                                    {showSaveDropdown && !hasDateChanged && (
                                        <div className={styles.dropdownContent}>
                                            <button className={styles.dropdownItem} onClick={() => handleUpdate('single')}>Edit this event only</button>
                                            <button className={styles.dropdownItem} onClick={() => handleUpdate('future')}>Edit all future in series</button>
                                            <button className={styles.dropdownItem} onClick={() => handleUpdate('all')}>Edit all in series</button>
                                        </div>
                                    )}
                                </div>
                            </>
                        ) : (
                            // Buttons for a single, non-recurring event.
                            <>
                                <button className={`${styles.button} ${styles.deleteButton}`} onClick={() => handleDelete('single')}>Delete</button>
                                <button className={`${styles.button} ${styles.saveButton}`} onClick={() => handleUpdate('single')}>Save Changes</button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}