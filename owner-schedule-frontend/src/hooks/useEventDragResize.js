// useEventDragResize.js

import { useCallback } from 'react';
import { DateTime } from 'luxon';

/**
 * A custom hook to encapsulate the logic for handling event drag and drop
 * and resizing events within a FullCalendar component.
 * @param {function} saveEventAndCommit - A function to save the event to the backend and
 * commit the action for undo/redo history.
 * @param {string} selectedTimezone - The currently selected timezone.
 * @param {function} onOpenSeriesModal - A callback to open the series modal for recurring events.
 * @returns {object} An object containing the onEventDrop and onEventResize callbacks.
 */
export const useEventDragResize = (saveEventAndCommit, selectedTimezone, onOpenSeriesModal) => {

    /**
     * Handles drag-and-drop operations for an event.
     */
    const onEventDrop = useCallback(
        (info) => {
            const { event, oldEvent } = info;

            // Check if the event is a recurring event by checking for a series_id
            console.error(event.extendedProps.series);
            if (event.extendedProps.series != null) {
                onOpenSeriesModal(event);
                info.revert(); // Revert the visual change until the user makes a choice in the modal
                return;
            }

            // If it's a single, non-recurring event, save it immediately
            const duration = (event.end.getTime() - event.start.getTime()) / (1000 * 60);
            const datetime = DateTime.fromJSDate(event.start)
                .setZone(selectedTimezone, { keepLocalTime: true })
                .toISO();

            const updatedEvent = {
                ...event.extendedProps,
                id: event.id,
                title: event.title,
                datetime: datetime,
                duration: duration,
                notes: event.extendedProps.notes,
                link: event.extendedProps.link,
            };
            saveEventAndCommit(updatedEvent, 'single');
        },
        [saveEventAndCommit, selectedTimezone, onOpenSeriesModal]
    );

    /**
     * Handles resizing an event.
     */
    const onEventResize = useCallback(
        (info) => {
            const { event, oldEvent } = info;
            // Check if the event is a recurring event by checking for a series_id
            if (event.extendedProps.series != null) {
                onOpenSeriesModal(event);
                info.revert(); // Revert the visual change until the user makes a choice in the modal
                return;
            }
            // If it's a single, non-recurring event, save it immediately
            const duration = (event.end.getTime() - event.start.getTime()) / (1000 * 60);
            const datetime = DateTime.fromJSDate(event.start)
                .setZone(selectedTimezone, { keepLocalTime: true })
                .toISO();
            const updatedEvent = {
                ...event.extendedProps,
                id: event.id,
                title: event.title,
                datetime: datetime,
                duration: duration,
                notes: event.extendedProps.notes,
                link: event.extendedProps.link,
            };
            saveEventAndCommit(updatedEvent, 'single');
        },
        [saveEventAndCommit, selectedTimezone, onOpenSeriesModal]
    );

    return { onEventDrop, onEventResize };
};