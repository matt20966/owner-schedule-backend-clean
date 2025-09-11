//const API_BASE_URL = 'http://127.0.0.1:8000/api/schedules';   <-- This is for development only
// Use the environment variable from .env
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;
console.log(API_BASE_URL);


/**
 * A helper function to handle API responses and errors consistently.
 * @param {Response} response - The fetch API response object.
 * @returns {Promise<any>} A promise that resolves with the JSON data or rejects with an error.
 */
const handleResponse = async (response) => {
    if (response.status === 204) {
        return;
    }

    const data = await response.json();
    if (!response.ok) {
        const errorMessage = typeof data === 'object' && data !== null ? JSON.stringify(data) : `HTTP error! Status: ${response.status}`;
        throw new Error(errorMessage);
    }
    return data;
};

/**
 * Fetches events from the API within a specified date range.
 * @param {Date} startDate - The start of the date range.
 * @param {Date} endDate - The end of the date range.
 * @returns {Promise<Array<Object>>} A promise that resolves with the event data.
 */
export const fetchEvents = async (startDate, endDate) => {
    try {
        const params = new URLSearchParams({
            datetime__gte: startDate.toISOString(),
            datetime__lte: endDate.toISOString(),
        });
        
        const response = await fetch(`${API_BASE_URL}/?${params}`);
        return handleResponse(response);
    } catch (err) {
        console.error('Error fetching events:', err.message);
        throw err; // Re-throw to be caught by the calling component
    }
};

/**
 * Creates a new event or a recurring series.
 * @param {Object} eventPayload - The data for the new event.
 * @returns {Promise<Object>} A promise that resolves with the newly created event data.
 */
export const addEvent = async (eventPayload) => {
    console.error(eventPayload);
    try {
        const response = await fetch(`${API_BASE_URL}/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(eventPayload),
        });
        return handleResponse(response);
    } catch (err) {
        console.error('Error adding event:', err.message);
        // On failure, return an error object with the message
        return { success: false, error: err.message };

    }
};

/**
 * Updates an event using the dedicated 'edit' action on the backend.
 * @param {string|number} eventId - The unique ID of the event (can be an integer or a composite string).
 * @param {Object} payload - The update data, which MUST include the 'edit_type' scope ('single', 'all', 'future').
 * @returns {Promise<Object>} A promise that resolves with the updated event data.
 */
export const saveEvent = async (eventId, payload) => {
    try {
        // The URL points to the custom 'edit' action for the specific event.
        const response = await fetch(`${API_BASE_URL}/${eventId}/edit/`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        return handleResponse(response);
    } catch (err) {
        console.error('Error saving event:', err.message);
        throw err;
    }
};

/**
 * Deletes an event using the dedicated 'delete' action on the backend.
 * @param {string|number} eventId - The unique ID of the event to delete.
 * @param {string} scope - The scope of deletion: 'single', 'all', or 'future'.
 * @returns {Promise<void>} A promise that resolves when the deletion is successful.
 */
export const deleteEvent = async (eventId, scope) => {
    try {
        const params = new URLSearchParams({ delete_type: scope });
        
        const response = await fetch(`${API_BASE_URL}/${eventId}/delete/?${params}`, {
            method: 'DELETE',
        });
        return handleResponse(response);
    } catch (err) {
        console.error('Error deleting event:', err.message);
        throw err;
    }
};
