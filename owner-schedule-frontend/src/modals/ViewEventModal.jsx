import React, { useState } from "react";
import { DateTime } from 'luxon';
import classes from "./ViewEventModal.module.css"; 
import { CloseIcon, ErrorText } from "./UIComponents.jsx";

const ViewEventModal = ({ isOpen, onClose, event, onEdit, onDeleteEvent }) => {
  const [showDeleteDropdown, setShowDeleteDropdown] = useState(false);

  if (!isOpen || !event) return null;

  // --- Date and Time Formatting using Luxon ---
  // Declare these variables outside of the conditional rendering logic
  const startDateTime = DateTime.fromJSDate(new Date(event.start)).setZone(`UTC${event.utcOffset >= 0 ? '+' : ''}${event.utcOffset}`);
  const endDateTime = DateTime.fromJSDate(new Date(event.end)).setZone(`UTC${event.utcOffset >= 0 ? '+' : ''}${event.utcOffset}`);
  const eventDate = startDateTime.toLocaleString(DateTime.DATE_FULL);
// Formats the date for view
  const formattedDate = formatWithOrdinal(startDateTime);
  // --- Handlers ---
  const handleDelete = (scope) => {
    if (event && event.id) {
      onDeleteEvent(event.id, scope);
      onClose();
    } else {
      console.error("Event ID is missing, cannot delete.");
    }
  };

  const handleCopy = () => {
    if (event.link) {
      navigator.clipboard.writeText(event.link)
        .then(() => {
          console.log("Link copied to clipboard!"); 
        })
        .catch(err => {
          console.error("Failed to copy link: ", err); 
        });
    }
  };

function formatWithOrdinal(dt) {
  const day = dt.day;
  let suffix = 'th';
  if (day === 1 || day === 21 || day === 31) suffix = 'st';
  else if (day === 2 || day === 22) suffix = 'nd';
  else if (day === 3 || day === 23) suffix = 'rd';

  return dt.toFormat(`EEEE, LLLL d'${suffix}', yyyy`);
}


  const getRepeatString = (frequency, frequency_total) => {
    // The rest of your getRepeatString function remains the same
    if (!frequency_total || frequency_total < 1 || frequency === 'never') {
        return "No recurring event";
    }
    if (frequency_total === 9999) {
        return "Forever";
    }
    switch (frequency) {
      case 'daily': {
          const days = frequency_total;
          const weeks = Math.floor(days / 7);
          const remainingDays = days % 7;
          let durationString = '';
          if (weeks > 0) {
            durationString += `${weeks} ${weeks > 1 ? 'weeks' : 'week'}`;
          }
          if (remainingDays > 0) {
            if (durationString) {
              durationString += ' and ';
            }
            durationString += `${remainingDays} ${remainingDays > 1 ? 'days' : 'day'}`;
          }
          return `Every day for ${durationString}`;
      }
      case 'every_work_day': {
        const days = frequency_total;
        const workWeeks = Math.floor(days / 5);
        const remainingWorkDays = days % 5;
        let durationString = '';
        if (workWeeks > 0) {
          durationString += `${workWeeks} ${workWeeks > 1 ? 'work weeks' : 'work week'}`;
        }
        if (remainingWorkDays > 0) {
          if (durationString) {
            durationString += ' and ';
          }
          durationString += `${remainingWorkDays} ${remainingWorkDays > 1 ? 'work days' : 'work day'}`;
        }
        return `Every work day for ${durationString}`;
      }
      case 'weekly': {
        const weeks = Math.ceil(frequency_total / 7);
        return `Every week for ${weeks} ${weeks > 1 ? 'weeks' : 'week'}`;
      }
      case 'fortnightly': {
        const fortnights = Math.ceil(frequency_total / 14);
        return `Every fortnight for ${fortnights} ${fortnights > 1 ? 'fortnights' : 'fortnight'}`;
      }
      default:
        return "No recurring event";
    }
  };

  const isRecurring = !!event.series;
  return (
    <div className={classes.overlay} onClick={onClose}>
      <div className={classes.modal} onClick={(e) => e.stopPropagation()}>
        <div className={classes.header}>
          <h2 className={classes.title}>{event.title}</h2>
          <button className={classes['close-button']} onClick={onClose} aria-label="Close modal">
            <CloseIcon />
          </button>
        </div>
        <div className={classes['form-content']}>
          {/* This is the corrected line */}
          <div className={classes.field}><strong>Date:</strong> {formattedDate}</div>
          <div className={classes.field}>
            <strong>Time:</strong> {startDateTime.toFormat('h:mm a')} - {endDateTime.toFormat('h:mm a')}
          </div>
          {event.series && (
            <div className={classes.field}>
              <strong>Repeats:</strong>{" "}
              {getRepeatString(event.series.frequency, event.series.frequency_total)}
            </div>
          )}
          <div className={classes['field-link']}>
            <strong>Link:</strong> 
            {event.link ? (
              <>
                <a href={event.link} target="_blank" rel="noopener noreferrer">{event.link}</a>
                <button className={classes['copy-button']} onClick={handleCopy}>Copy</button>
              </>
            ) : "N/A"}
          </div>
          <div className={classes.field}>
            <strong>Notes:</strong>
            <p style={{ margin: 0 }}>{event.notes || "No additional notes."}</p>
          </div>
        </div>
        <div className={classes.actions}>
          {isRecurring ? (
            <div className={classes.dropdownContainer}>
              <button
                className={`${classes.button} ${classes.deleteButton}`}
                onClick={() => setShowDeleteDropdown(!showDeleteDropdown)}
              >
                Delete...
              </button>
              {showDeleteDropdown && (
                <div className={classes.dropdownContent}>
                  <button className={classes.dropdownItem} onClick={() => handleDelete('single')}>Delete this event only</button>
                  <button className={classes.dropdownItem} onClick={() => handleDelete('future')}>Delete all future in series</button>
                  <button className={classes.dropdownItem} onClick={() => handleDelete('all')}>Delete all in series</button>
                </div>
              )}
            </div>
          ) : (
            <button className={`${classes.button} ${classes.deleteButton}`} onClick={() => handleDelete('single')}>Delete</button>
          )}
          <button
            className={`${classes.button} ${classes['edit-button']}`}
            onClick={() => {
              const totalDurationInMinutes = endDateTime.diff(startDateTime, 'minutes').minutes;
              console.log("Event in ViewEventModal:", event);
              const transformedEvent = {
                ...event,
                datetime: startDateTime.toISO({ includeOffset: true }),
                duration: totalDurationInMinutes,
              };
              onEdit(transformedEvent);
            }}
          >
            Edit
          </button>
        </div>
      </div>
    </div>
  );
};

export default ViewEventModal;