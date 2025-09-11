// App.jsx

import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import interactionPlugin from '@fullcalendar/interaction';
import luxonPlugin from '@fullcalendar/luxon2';
import AddEventModal from '../modals/AddEventModal.jsx';
import EditEventModal from '../modals/EditEventModal.jsx';
import ViewEventModal from '../modals/ViewEventModal.jsx';
import SettingsModal from '../modals/SettingsModal.jsx';
import EditSeriesModal from '../modals/EditSeriesModal.jsx';
import { DateTime, Settings } from 'luxon';
import { parseDurationToMinutes, formatEventsForCalendar } from '../utils/utils.js';
import {
    fetchEvents,
    addEvent,
    saveEvent,
    deleteEvent,
} from '../services/api';
import { useUndoShortcut, useRedoShortcut } from '../hooks/keyboardShortcuts.js';
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { useUndoRedo } from '../hooks/useUndoRedo.js';
import './Calendar.css';
import { useEventDragResize } from '../hooks/useEventDragResize.js';
import { CloseIcon, ErrorText } from "../modals/UIComponents.jsx";


// Set the default timezone for all Luxon DateTime operations in this component.
Settings.defaultZone = 'local';

/**
 * A banner component to display success, error, or info messages.
 * @param {object} props - The component props.
 * @param {string} props.message - The message to display.
 * @param {string} props.type - The type of banner (e.g., 'success', 'error').
 * @param {function} props.onClose - The function to call when the banner is closed.
 */
const Banner = ({ message, type, onClose }) => {
    if (!message) return null;
    return (
        <div className={`banner ${type}`}>
            <span>{message}</span>
            <button onClick={onClose} className="banner-close-button">
                <CloseIcon />
            </button>
        </div>
    );
};


const App = () => {
    // --- STATE MANAGEMENT ---

    // Calendar and event display settings.
    const [selectedTimezone, setSelectedTimezone] = useState('Europe/London');
    const [showExpanded, setShowExpanded] = useState(false); // For recurring events
    const [slotDuration, setSlotDuration] = useState(() => localStorage.getItem('slotDuration') || '00:30:00');

    // The date that the calendar is currently centered on. Initialized to today.
    const [referenceDate, setReferenceDate] = useState(() => DateTime.local({ zone: selectedTimezone }).startOf('day'));

    // The current set of events to display on the calendar.
    const [events, setEvents] = useState([]);

    // The current view of the calendar (e.g., 'timeGridWeek'), persisted in localStorage.
    const [currentView, setCurrentView] = useState(() => localStorage.getItem('calendarView') || 'timeGridWeek');

    // State for managing the visibility of modals.
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [isSettingsModalOpen, setIsSettingsModal] = useState(false);
    const [isEditSeriesModalOpen, setIsEditSeriesModalOpen] = useState(false); // Set to false initially
    
    // State to hold the event object currently being viewed or edited.
    const [viewEvent, setViewEvent] = useState(null);
    const [editEvent, setEditEvent] = useState(null);
    const [eventForSeriesModal, setEventForSeriesModal] = useState(null); // New state to hold event for series modal

    // State for the undo/redo history stacks. Each entry represents a user action.
    const [undoHistory, setUndoHistory] = useState([]);
    const [redoHistory, setRedoHistory] = useState([]);

    // State for the notification banner.
    const [banner, setBanner] = useState({ message: '', type: '' });

    // Stores the start and end dates of the current calendar view to trigger data fetching.
    const [viewDates, setViewDates] = useState({ start: null, end: null });

    // --- REFS & MEMOIZED VALUES ---

    // A ref to access the FullCalendar component's API directly.
    const calendarRef = useRef(null);

    // Memoize the UTC offset calculation to prevent re-computation on every render.
    const utcOffsetInHours = useMemo(() => {
        return DateTime.local().setZone(selectedTimezone).offset / 60;
    }, [selectedTimezone]);

    // --- EFFECTS ---

    // Effect to automatically hide the banner after 5 seconds.
    useEffect(() => {
        if (banner.message) {
            const timer = setTimeout(() => {
                setBanner({ message: '', type: '' });
            }, 5000);
            return () => clearTimeout(timer); // Cleanup on component unmount or if banner changes.
        }
    }, [banner]);

    /**
     * Shows a notification banner.
     * @param {string} message - The message to display.
     * @param {string} type - The banner type ('success', 'error', 'info').
     */
    const showBanner = (message, type) => {
        setBanner({ message, type });
    };

    /**
     * Fetches events from the API for the given date range.
     * Wrapped in useCallback to prevent re-creation on every render,
     * which is crucial as it's a dependency for another useEffect.
     */
    const fetchEventsCallback = useCallback(async (viewStart, viewEnd) => {
        if (!viewStart || !viewEnd) {
            console.warn("fetchEvents called without viewStart or viewEnd");
            return;
        }

        try {
            const data = await fetchEvents(viewStart, viewEnd);
            // Formats raw API data into a structure FullCalendar can understand.
            const formattedEvents = formatEventsForCalendar(data, showExpanded, viewStart, viewEnd);
            setEvents(formattedEvents);
        } catch (err) {
            console.error('Error fetching events:', err);
            showBanner('Failed to fetch events.', 'error');
        }
    }, [showExpanded]); // Depends on showExpanded to re-format events if the setting changes.

    // Effect to trigger fetching events whenever the visible date range changes.
    useEffect(() => {
        if (viewDates.start && viewDates.end) {
            fetchEventsCallback(viewDates.start, viewDates.end);
        }
    }, [fetchEventsCallback, viewDates]);


    // --- SETTINGS HANDLER ---

    /**
     * Handles saving new settings from the SettingsModal.
     * Updates state and localStorage.
     */
    const handleSaveSettings = (newSettings) => {
        setSelectedTimezone(newSettings.timezone);
        setShowExpanded(newSettings.showExpanded);
        setSlotDuration(newSettings.slotDuration);
        localStorage.setItem('slotDuration', newSettings.slotDuration);
        setIsSettingsModal(false);
        showBanner('Settings saved successfully!', 'success');
    };


    // --- EVENT INTERACTION HANDLERS ---

    /**
     * Handles clicking an event on the calendar, opening the ViewEventModal.
     */
    const handleEventClick = (info) => {
        const { event } = info;
        const clickedEvent = {
            ...event.extendedProps,
            id: event.id,
            title: event.title,
            start: event.start,
            end: event.end,
            link: event.extendedProps.link,
            notes: event.extendedProps.notes,
            utcOffset: utcOffsetInHours,
        };
        setViewEvent(clickedEvent);
    };


    // --- UNDO/REDO LOGIC ---

    /**
     * Pushes a new action to the undo history and clears the redo history.
     * This should be called after any successful state-changing action (add, edit, delete).
     * @param {object} action - The action object (e.g., { type: 'add', eventId: '...' }).
     */
    const commitAction = useCallback((action) => {
        setUndoHistory(prevHistory => [...prevHistory, action]);
        setRedoHistory([]); // A new action invalidates the old redo history.
    }, []);

    /**
     * Reverts the last action from the undo history.
     */
    const undo = useCallback(async () => {
        if (undoHistory.length === 0) {
            showBanner('Nothing to undo.', 'info');
            return;
        }

        const lastAction = undoHistory[undoHistory.length - 1];

        try {
            if (lastAction.type === 'add') {
                // To undo an 'add', we 'delete' the event that was just added.
                await deleteEvent(lastAction.eventId);
                showBanner('Event creation undone.', 'success');
                // Move the action to the redo history.
                setRedoHistory(prevHistory => [lastAction, ...prevHistory]);

            } else if (lastAction.type === 'edit') {
                // To undo an 'edit', we save the event with its original data.
                const originalEvent = lastAction.originalEvent;
                const payload = {
                    edit_type: 'single', // Undo only applies to the single instance.
                    title: originalEvent.title,
                    datetime: originalEvent.datetime,
                    duration: `PT${originalEvent.duration}M`,
                    notes: originalEvent.notes,
                    link: originalEvent.link,
                };
                await saveEvent(originalEvent.id, payload);
                showBanner('Event edit undone.', 'success');
                // Construct and move the action to redo history.
                const redoAction = {
                    type: 'edit',
                    originalEvent: originalEvent,
                    updatedEvent: lastAction.updatedEvent,
                };
                setRedoHistory(prevHistory => [redoAction, ...prevHistory]);

            } else if (lastAction.type === 'delete') {
                // To undo a 'delete', we 'add' the event back with its original data.
                const { eventData } = lastAction;
                const newEvent = await addEvent(eventData);
                showBanner('Event deletion undone.', 'success');
                // Update the action with the new ID and move it to redo history.
                setRedoHistory(prevHistory => [{ ...lastAction, eventId: newEvent.id }, ...prevHistory]);
            }

            // Remove the action from the undo stack and refresh calendar events.
            setUndoHistory(prevHistory => prevHistory.slice(0, -1));
            await fetchEventsCallback(viewDates.start, viewDates.end);

        } catch (err) {
            console.error('Error performing undo:', err);
            showBanner('Failed to undo action.', 'error');
        }
    }, [undoHistory, fetchEventsCallback, viewDates]);

    /**
     * Re-applies the last undone action from the redo history.
     */
    const redo = useCallback(async () => {
        if (redoHistory.length === 0) {
            showBanner('Nothing to redo.', 'info');
            return;
        }

        const nextAction = redoHistory[0];

        try {
            if (nextAction.type === 'add') {
                // To redo an 'add', we simply add the event again.
                const newEvent = await addEvent(nextAction.eventData);
                showBanner('Event re-created.', 'success');
                // Move the action back to the undo history with the new ID.
                setUndoHistory(prevHistory => [...prevHistory, { ...nextAction, eventId: newEvent.id }]);

            } else if (nextAction.type === 'edit') {
                // To redo an 'edit', we re-apply the updated event data.
                const updatedEvent = nextAction.updatedEvent;
                const payload = {
                    edit_type: 'single',
                    title: updatedEvent.title,
                    datetime: updatedEvent.datetime,
                    duration: updatedEvent.duration,
                    notes: updatedEvent.notes,
                    link: updatedEvent.link,
                };
                await saveEvent(updatedEvent.id, payload);
                showBanner('Event edit re-applied.', 'success');
                // Move the action back to the undo history.
                setUndoHistory(prevHistory => [...prevHistory, nextAction]);

            } else if (nextAction.type === 'delete') {
                // To redo a 'delete', we delete the event again.
                const { eventId, scope } = nextAction;
                await deleteEvent(eventId, scope);
                showBanner('Event re-deleted.', 'success');
                // Move the action back to the undo history.
                setUndoHistory(prevHistory => [...prevHistory, nextAction]);
            }

            // Remove the action from the redo stack and refresh calendar events.
            setRedoHistory(prevHistory => prevHistory.slice(1));
            await fetchEventsCallback(viewDates.start, viewDates.end);

        } catch (err) {
            console.error('Error performing redo:', err);
            showBanner('Failed to redo action.', 'error');
        }
    }, [redoHistory, fetchEventsCallback, viewDates]); // Removed undoHistory dependency as it's not directly read.

    // Register custom hooks to listen for keyboard shortcuts (e.g., Ctrl+Z, Ctrl+Y).
    useUndoShortcut(undo);
    useRedoShortcut(redo);


    // --- API ACTION WRAPPERS (These functions call the API and then commit the action for undo) ---

    /**
     * Prepares event data, sends it to the API to be added, and then commits the action.
     * @param {object} event - The event data from the AddEventModal.
     */
    const addEventAndCommit = async (event) => {
        try {
            // Convert duration from minutes to ISO 8601 format (e.g., PT1H30M).
            const hours = Math.floor(event.duration / 60);
            const minutes = event.duration % 60;
            const durationISO = `PT${hours}H${minutes}M`;

            // Adjust frequency total based on recurrence type to match backend logic.
            let adjustedFrequencyTotal = event.frequency_total;
            if (event.frequency === 'every_work_day' && event.frequency_total) {
                const fullWeeks = Math.floor(event.frequency_total / 7);
                const weekendDays = fullWeeks * 2;
                adjustedFrequencyTotal = event.frequency_total - weekendDays;
            } else if (event.frequency === 'weekly' && event.frequency_total) {
                adjustedFrequencyTotal = Math.ceil(event.frequency_total / 7);
            } else if (event.frequency === 'fortnightly' && event.frequency_total) {
                adjustedFrequencyTotal = Math.ceil(event.frequency_total / 14);
            }

            // Adjust the datetime to the selected timezone before sending to the backend.
            const newIsoString = DateTime.fromISO(event.datetime)
                .setZone(selectedTimezone, { keepLocalTime: true })
                .toISO();

            const eventData = {
                datetime: newIsoString,
                title: event.title,
                duration: durationISO,
                notes: event.notes || null,
                link: event.link || null,
                frequency: event.frequency || null,
                frequency_total: adjustedFrequencyTotal || null,
            };

            const newEvent = await addEvent(eventData);
            // Add this action to the undo history.
            commitAction({ type: 'add', eventId: newEvent.id, eventData: eventData });

            setIsAddModalOpen(false);
            showBanner('Event added successfully!', 'success');
            await fetchEventsCallback(viewDates.start, viewDates.end);
        } catch (err) {
            console.error('Error adding event:', err);
            showBanner(`Failed to add event: ${err.message}`, 'error');
        }
    };

    /**
     * Saves an existing event, preparing the payload for the Django backend,
     * and then commits the edit action.
     * @param {object} eventData - The updated event data from the EditEventModal.
     * @param {string} scope - The scope of the edit ('single', 'all', 'future').
     */
    const saveEventAndCommit = async (eventData, scope) => {
        try {
            const eventId = eventData.id;
            // Find the original event state to store for the undo action.
            const originalEvent = events.find(e => e.id === eventId);
            if (!originalEvent) {
                showBanner('Original event not found.', 'error');
                return;
            }
            console.error("scope", scope);
            // Create a snapshot of the event before the edit for the undo history.
            const originalPayload = {
                id: originalEvent.id,
                title: originalEvent.title,
                datetime: originalEvent.start.toISOString(),
                duration: parseDurationToMinutes(originalEvent.duration), // Convert back to minutes
                notes: originalEvent.notes,
                link: originalEvent.link,
            };

            const hours = Math.floor(eventData.duration / 60);
            const minutes = eventData.duration % 60;
            const formattedDuration = `PT${hours}H${minutes}M`;

            const newIsoString = DateTime.fromISO(eventData.datetime)
                .setZone(selectedTimezone, { keepLocalTime: true })
                .toISO();

            // This payload structure matches the Django backend's `edit_event` action.
            const payload = {
                edit_type: scope,
                title: eventData.title,
                datetime: newIsoString,
                duration: formattedDuration,
                notes: eventData.notes || null,
                link: eventData.link || null,
                frequency: eventData.frequency || 'never',
                frequency_total: eventData.frequency_total || null,
            }
            console.error("save event being called with", payload);
            await saveEvent(eventId, payload);

            // Commit the edit action with both original and updated states.
            commitAction({
                type: 'edit',
                originalEvent: originalPayload,
                updatedEvent: { id: eventId, ...payload },
            });

            setEditEvent(null);
            setViewEvent(null);
            setIsEditSeriesModalOpen(false); // Close the series modal after the action is committed
            showBanner('Event updated successfully!', 'success');
            await fetchEventsCallback(viewDates.start, viewDates.end);
        } catch (err) {
            console.error('Error updating event:', err);
            showBanner('Failed to update event.', 'error');
        }
    };

    /**
     * Deletes an event and commits the action for undo history.
     * @param {string} eventId - The ID of the event to delete.
     * @param {string} [scope='single'] - The scope of deletion ('single', 'all', 'future').
     */
    const deleteEventAndCommit = async (eventId, scope = 'single') => {
        try {
            if (!eventId) throw new Error('Cannot delete event without an ID.');

            // Find the event to get its data before deletion for the undo history.
            const eventToDelete = events.find(e => e.id === eventId);
            if (!eventToDelete) {
                throw new Error('Event to delete not found in current state.');
            }

            // Snapshot the event's data.
            const eventData = {
                title: eventToDelete.title,
                datetime: eventToDelete.start.toISOString(),
                duration: `PT${parseDurationToMinutes(eventToDelete.duration)}M`,
                notes: eventToDelete.notes,
                link: eventToDelete.link,
                // Include recurrence info if it exists.
                frequency: eventToDelete.series_id ? (eventToDelete.extendedProps.frequency || null) : null,
                frequency_total: eventToDelete.series_id ? (eventToDelete.extendedProps.frequency_total || null) : null,
            };

            await deleteEvent(eventId, scope);

            // Commit the delete action.
            commitAction({ type: 'delete', eventId: eventId, scope: scope, eventData: eventData });

            setEditEvent(null);
            setViewEvent(null);
            showBanner('Event deleted successfully!', 'success');
            await fetchEventsCallback(viewDates.start, viewDates.end);

        } catch (err) {
            console.error('Error deleting event:', err);
            showBanner('Failed to delete event.', 'error');
        }
    };

    /**
     * Handles opening the series modal.
     * @param {object} event - The event object to pass to the modal.
     */
    const handleOpenSeriesModal = useCallback((event) => {
        setEventForSeriesModal(event);
        setIsEditSeriesModalOpen(true);
    }, []);

    // --- FULLCALENDAR CALLBACKS ---

    // Pass the new handleOpenSeriesModal callback to the custom hook
    const { onEventDrop, onEventResize } = useEventDragResize(saveEventAndCommit, selectedTimezone, handleOpenSeriesModal);

    /**
     * Callback executed when the calendar's view or date range changes.
     * It updates the reference date and view state, persisting them to localStorage.
     */
    const handleDatesSet = useCallback((dateInfo) => {
        const newStartDate = DateTime.fromJSDate(dateInfo.start);
        setReferenceDate(newStartDate);
        setCurrentView(dateInfo.view.type);
        // Persist the user's last viewed date and view type.
        localStorage.setItem('calendarDate', newStartDate.toISO());
        localStorage.setItem('calendarView', dateInfo.view.type);

        // Update the viewDates state, which triggers the useEffect to fetch new events.
        setViewDates({ start: dateInfo.start, end: dateInfo.end });
    }, []);

    const renderEventContent = useCallback((eventInfo) => {
        const slotDurationInMinutes = parseDurationToMinutes(slotDuration);
        const hasConflict = eventInfo.event.extendedProps.hasConflict;

        // Use a class name to style the event when it has a conflict.
        const eventClassName = hasConflict ? 'fc-event-with-time has-conflict' : 'fc-event-with-time';

        if (slotDurationInMinutes <= 15) {
            return (
                <div className={`fc-event-main-content ${eventClassName}`}>
                    <div className="fc-event-time">{eventInfo.timeText}</div>
                    <div className="fc-event-title">{eventInfo.event.title}</div>
                    {hasConflict && <div className="conflict-icon">⚠️</div>}
                </div>
            );
        }

        return (
            <div className={`fc-event-main-content ${hasConflict ? 'has-conflict' : ''}`}>
                <div className="fc-event-title">{eventInfo.event.title}</div>
                {hasConflict && <div className="conflict-icon">⚠️</div>}
            </div>
        );
    }, [slotDuration]);

    /**
     * Memoizes the FullCalendar component to prevent it from re-rendering
     * unless its key props (like `events` or callbacks) change. This is a
     * major performance optimization.
     */
    const MemoizedCalendar = useMemo(() => {
        return (
            <FullCalendar
                eventDidMount={(info) => {
                    if (info.event.extendedProps.hasConflict) {
                        // a tooltip on hover for overlapping events
                        info.el.setAttribute('title', 'Events are overlapping!');
                    }
                }}
                ref={calendarRef}
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin, luxonPlugin]}
                initialView={currentView}
                initialDate={referenceDate.toJSDate()}
                events={events}
                editable={true}
                droppable={true}
                eventDrop={onEventDrop}
                eventResize={onEventResize}
                eventClick={handleEventClick}
                datesSet={handleDatesSet}
                headerToolbar={false} // Disable default header, using a custom one.
                dayHeaderFormat={{ weekday: 'short', day: 'numeric' }}
                slotMinTime="00:00:00"
                slotMaxTime="24:00:00"
                weekends={true}
                nowIndicator={true}
                allDaySlot={false}
                height="100%"
                firstDay={1} // Monday
                timeZone={selectedTimezone}
                eventOverlap={true}
                slotDuration={slotDuration}
                displayEventEnd={true}
                eventContent={renderEventContent}
            />
        );
    }, [events, referenceDate, handleEventClick, handleDatesSet, selectedTimezone, currentView, slotDuration, renderEventContent]);

    // --- RENDER ---

    return (
        <>
            <div className="calendar-container">
                <Banner message={banner.message} type={banner.type} onClose={() => setBanner({ message: '', type: '' })} />

                {/* Custom navigation and action controls */}
                <div className="nav-wrapper">
                    <div className="nav-center-group">
                        <button className="nav-button" onClick={() => calendarRef.current.getApi().prev()}>←</button>
                        <div className="date-selector-group">
                            <div className="datepicker-container">
                                <DatePicker
                                    selected={referenceDate.toJSDate()}
                                    onChange={(date) => {
                                        if (date) {
                                            const newDate = DateTime.fromJSDate(date).startOf("day");
                                            setReferenceDate(newDate);
                                            calendarRef.current.getApi().gotoDate(newDate.toJSDate());
                                            localStorage.setItem('calendarDate', newDate.toISO());
                                        }
                                    }}
                                    customInput={
                                        <button className="date-icon-button">
                                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="calendar-icon">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5m-9-6h.008v.008H12v-.008zM12 15h.008v.008H12V15zm0 2.25h.008v.008H12v-.008zM9.75 15h.008v.008H9.75V15zm0 2.25h.008v.008H9.75v-.008zM7.5 15h.008v.008H7.5V15zm0 2.25h.008v.008H7.5v-.008zm6.75-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15zm0 2.25h.008v.008h-.008v-.008zm2.25-4.5h.008v.008h-.008v-.008zm0 2.25h.008v.008h-.008V15z" />
                                            </svg>
                                        </button>
                                    }
                                    popperPlacement="bottom-start"
                                    calendarClassName="custom-date-picker"
                                    firstDayOfWeek={1} // Monday
                                    dayClassName={(date) => {
                                        const day = DateTime.fromJSDate(date);

                                        // Get the start/end of the selected week (Monday → Sunday)
                                        const startOfWeek = referenceDate.startOf('week');
                                        const endOfWeek = referenceDate.endOf('week');

                                        // Only highlight days in the week containing the selected date
                                        if (day >= startOfWeek && day <= endOfWeek) {
                                            // Exclude days outside the current month
                                            if (day.month === referenceDate.month && day.year === referenceDate.year) {
                                                return 'week-selected';
                                            }
                                        }

                                        return '';
                                    }}
                                />
                            </div>
                            <span className="current-date">
                                {referenceDate.startOf('week').toFormat('MMM d')} - {referenceDate.endOf('week').toFormat('MMM d, yyyy')}
                            </span>
                        </div>
                        <button className="nav-button" onClick={() => calendarRef.current.getApi().next()}>→</button>
                    </div>
                    <div className="action-buttons">
                        <button className="settings-button" onClick={() => setIsSettingsModal(true)}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="settings-icon">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            </svg>
                        </button>
                        <button className="add-event-button" onClick={() => setIsAddModalOpen(true)}>
                            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="add-event-icon">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                            </svg>
                        </button>
                    </div>
                </div>

                {/* The memoized calendar instance */}
                {MemoizedCalendar}

                {/* Modals for adding, viewing, editing events, and settings */}
                <AddEventModal
                    isOpen={isAddModalOpen}
                    onClose={() => setIsAddModalOpen(false)}
                    onAddEvent={addEventAndCommit}
                />
                <ViewEventModal
                    isOpen={!!viewEvent}
                    event={viewEvent}
                    onClose={() => setViewEvent(null)}
                    onEdit={event => { setEditEvent(event); setViewEvent(null); }}
                    onDeleteEvent={deleteEventAndCommit}
                />
                <EditEventModal
                    isOpen={!!editEvent}
                    onClose={() => setEditEvent(null)}
                    event={editEvent}
                    onUpdateEvent={saveEventAndCommit}
                    onDeleteEvent={deleteEventAndCommit}
                />
                <SettingsModal
                    isOpen={isSettingsModalOpen}
                    onClose={() => setIsSettingsModal(false)}
                    onSave={handleSaveSettings}
                    currentSettings={{ timezone: selectedTimezone, showExpanded: showExpanded, slotDuration: slotDuration }}
                />
                <EditSeriesModal
                    isOpen={isEditSeriesModalOpen}
                    onCancel={() => setIsEditSeriesModalOpen(false)}
                    event={eventForSeriesModal} // Pass the event state to the modal
                    onConfirm={(editType) => {
                        // This function is for handling the user's choice inside the modal
                        const updatedEvent = {
                            id: eventForSeriesModal.id,
                            title: eventForSeriesModal.title,
                            // Use the start date from the moved/resized event
                            datetime: DateTime.fromJSDate(eventForSeriesModal.start).setZone(selectedTimezone, { keepLocalTime: true }).toISO(),
                            // Calculate the new duration
                            duration: (eventForSeriesModal.end.getTime() - eventForSeriesModal.start.getTime()) / (1000 * 60),
                            notes: eventForSeriesModal.extendedProps.notes,
                            link: eventForSeriesModal.extendedProps.link,
                        };
                        saveEventAndCommit(updatedEvent, editType);
                        console.error("Save and commit" , editType);
                        // The saveEventAndCommit function will close the modal upon success
                    }}
                />
            </div>
        </>
    );
};

export default App;