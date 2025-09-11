import { DateTime, Duration } from 'luxon';

/**
 * Parses a duration string (ISO 8601 or HH:MM:SS) into minutes.
 * @param {string} durationStr - The duration string to parse.
 * @returns {number} The duration in minutes, or a default of 60 if parsing fails.
 */
export const parseDurationToMinutes = (durationStr) => {
    // Returns a default value for invalid or non-string inputs.
    if (typeof durationStr !== 'string' || !durationStr) {
        console.warn('Invalid duration input. Returning default of 60 minutes.');
        return 60;
    }

    let duration;
    try {
        duration = Duration.fromISO(durationStr);
        if (!duration.isValid) {
            // Fallback for custom 'HH:MM:SS' format if ISO parsing fails.
            const parts = durationStr.split(':').map(Number);
            // Ensure parts are valid numbers and there are at least two (hours and minutes).
            if (parts.length >= 2 && !parts.some(isNaN)) {
                duration = Duration.fromObject({
                    hours: parts[0],
                    minutes: parts[1],
                    seconds: parts[2] || 0 // Default seconds to 0
                });
            }
        }
    } catch (e) {
        console.error(`Failed to parse duration: "${durationStr}"`, e);
        return 60;
    }

    // Return a default value if the final duration object is invalid.
    if (!duration || !duration.isValid) {
        console.warn(`Duration "${durationStr}" could not be parsed. Returning default of 60 minutes.`);
        return 60;
    }

    return duration.as('minutes');
};

/**
 * Checks if a given event overlaps with any other event in the list.
 * @param {Object} currentEvent - The event to check for overlaps.
 * @param {Array<Object>} allEvents - The complete list of events to compare against.
 * @returns {boolean} True if an overlap is detected, otherwise false.
 */
const checkOverlap = (currentEvent, allEvents) => {
    // Check for overlaps with other events in the list.
    return allEvents.some(otherEvent => {
        // Skip comparing the event with itself.
        if (currentEvent.id === otherEvent.id) {
            return false;
        }

        const start1 = DateTime.fromJSDate(currentEvent.start);
        const end1 = DateTime.fromJSDate(currentEvent.end);
        const start2 = DateTime.fromJSDate(otherEvent.start);
        const end2 = DateTime.fromJSDate(otherEvent.end);

        // A standard time overlap check:
        // (Start1 < End2) AND (End1 > Start2)
        const overlaps = start1 < end2 && end1 > start2;

        return overlaps;
    });
};

export const formatEventsForCalendar = (data, showExpanded) => {
    const seenSeriesIds = new Set();
    const formattedEvents = [];

    // Early exit for empty or invalid data.
    if (!Array.isArray(data) || data.length === 0) {
        return formattedEvents;
    }

    // Pass 1: Format events and store them in an array.
    data.sort((a, b) => DateTime.fromISO(a.datetime) - DateTime.fromISO(b.datetime));

    data.forEach(event => {
        const { id, title, notes, link, series, datetime, duration, is_exception } = event;
        const eventDateTime = DateTime.fromISO(datetime, { zone: 'utc' });

        if (!eventDateTime.isValid) {
            console.warn(`Skipping event with invalid datetime: "${datetime}"`);
            return;
        }

        const eventDurationMinutes = parseDurationToMinutes(duration);

        const formattedEvent = {
            id,
            title,
            notes,
            link,
            series,
            start: eventDateTime.toJSDate(),
            end: eventDateTime.plus({ minutes: eventDurationMinutes }).toJSDate(),
            color: is_exception ? '#df5050ff' : '#60a5fa',
            hasConflict: false, // Default to no conflict
        };

        if (!series || is_exception || showExpanded) {
            formattedEvents.push(formattedEvent);
        } else if (!seenSeriesIds.has(series.id)) {
            formattedEvents.push(formattedEvent);
            seenSeriesIds.add(series.id);
        }
    });

    // Pass 2: Check for overlaps among the formatted events.
    formattedEvents.forEach(event => {
        if (checkOverlap(event, formattedEvents)) {
            event.hasConflict = true;
        }
    });

    return formattedEvents;
};

