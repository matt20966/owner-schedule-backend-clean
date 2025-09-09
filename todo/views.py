import uuid
from datetime import timedelta, datetime
from django.db import transaction
from django.db.models import Q
from django.shortcuts import get_object_or_404
from dateutil import parser
import isodate
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response

from .models import Schedule, ScheduleSeries
from .serializers import ScheduleSerializer

def _parse_dt(dt_str):
    """Parses an ISO 8601 datetime string and returns a datetime object.

    Args:
        dt_str (str): The datetime string to parse.

    Returns:
        datetime or None: The parsed datetime object or None if invalid.
    """
    if not dt_str:
        return None
    try:
        return parser.isoparse(dt_str)
    except (ValueError, TypeError):
        return None

def _parse_duration(d):
    """Parses an ISO 8601 duration string and returns a timedelta object.

    Args:
        d (str or timedelta): The duration string or timedelta object.

    Returns:
        timedelta or None: The parsed timedelta object or None if invalid.
    """
    if d is None:
        return None
    if isinstance(d, timedelta):
        return d
    try:
        return isodate.parse_duration(d)
    except (ValueError, TypeError):
        return None

def _advance(series, current):
    """Advances the current datetime based on the series' frequency.

    Skips weekends for 'every_work_day' frequency.

    Args:
        series (ScheduleSeries): The recurring event series.
        current (datetime): The current datetime instance.

    Returns:
        datetime: The next datetime instance in the series.
    """
    if series.frequency in ('daily', 'every_work_day'):
        current += timedelta(days=1)
    elif series.frequency == 'weekly':
        current += timedelta(weeks=1)
    elif series.frequency == 'fortnightly':
        current += timedelta(weeks=2)
    
    if series.frequency == 'every_work_day':
        while current.weekday() >= 5:
            current += timedelta(days=1)
    return current

def _count_occurrences_before(series, target_dt):
    """Counts the number of event occurrences before a target datetime.

    Args:
        series (ScheduleSeries): The recurring event series.
        target_dt (datetime): The target datetime to count up to.

    Returns:
        int: The number of occurrences.
    """
    if not series.start_datetime or target_dt < series.start_datetime:
        return 0
    count = 0
    current = series.start_datetime
    while current < target_dt and count < series.frequency_total:
        count += 1
        current = _advance(series, current)
    return count

class ScheduleViewSet(viewsets.ModelViewSet):
    """A ViewSet for handling Schedule and ScheduleSeries operations.

    Includes custom actions for editing and deleting recurring events.
    """
    queryset = Schedule.objects.all().order_by('datetime')
    serializer_class = ScheduleSerializer

    def _get_event_and_series(self, pk):
        """Retrieves a specific event instance and its series.

        Handles both integer PKs for stored events and composite 'uuid-datetime' PKs for recurring events.

        Args:
            pk (str or int): The primary key of the event.

        Returns:
            tuple: (schedule, series, event_dt) or (None, None, None) if not found.
        """
        schedule, series, event_dt = None, None, None
        
        # Handles a recurring event instance identified by a composite PK like 'uuid-datetime'.
        if isinstance(pk, str) and '-' in pk:
            try:
                series_id_str = pk[:36]
                dt_str = pk[37:]
                event_dt = _parse_dt(dt_str)
                series = get_object_or_404(ScheduleSeries, id=uuid.UUID(series_id_str))
                
                # Check for a specific exception event for this series and datetime.
                schedule = Schedule.objects.filter(series=series, datetime=event_dt).first()
                if not schedule:
                    # If no exception exists, create a temporary Schedule object to represent the base event instance.
                    schedule = Schedule(series=series, datetime=event_dt, title=series.title, notes=series.notes)
            except (ValueError, ScheduleSeries.DoesNotExist):
                return None, None, None
        
        # Handles a standalone or an explicitly saved exception event by its integer PK.
        else:
            try:
                schedule = get_object_or_404(Schedule, pk=int(pk))
                series = schedule.series
                event_dt = schedule.datetime
            except (ValueError, Schedule.DoesNotExist):
                return None, None, None

        return schedule, series, event_dt

    def list(self, request, *args, **kwargs):
        """Returns a list of all events within a specified datetime range.

        Combines stored single events and exceptions with dynamically generated
        recurring events from series.
        """
        start_date_str = request.query_params.get('datetime__gte')
        end_date_str = request.query_params.get('datetime__lte')

        if not (start_date_str and end_date_str):
            return Response({"error": "Missing datetime range parameters"}, status=status.HTTP_400_BAD_REQUEST)

        start_date = _parse_dt(start_date_str)
        end_date = _parse_dt(end_date_str)

        if not (start_date and end_date):
            return Response({"error": "Invalid date format"}, status=status.HTTP_400_BAD_REQUEST)

        # Retrieve stored standalone events and exceptions within the date range.
        stored_qs = self.get_queryset().filter(
            Q(series__isnull=True) | Q(is_exception=True),
            datetime__gte=start_date,
            datetime__lte=end_date
        ).order_by('datetime')
        stored_events = list(stored_qs)

        # Retrieve all series that might have occurrences in the date range.
        series_qs = ScheduleSeries.objects.filter(start_datetime__lte=end_date)

        # Get the first occurrence of each series to use as a template for other events.
        base_by_series = {
            e.series_id: e
            for e in Schedule.objects.filter(series__isnull=False, is_exception=False)
            .order_by('series', 'datetime')
            .distinct('series')
        }

        # Index exceptions and deleted events for quick lookup.
        exceptions_by_key = {}
        deleted_keys = set()
        for ex in stored_events:
            if ex.series_id:
                key = (ex.series_id, ex.datetime)
                exceptions_by_key[key] = ex
                if ex.is_exception and (ex.title or "").startswith("DELETED_"):
                    deleted_keys.add(key)

        # Generate recurring events dynamically.
        dynamic_events = []
        for s in series_qs:
            base = base_by_series.get(s.id)
            if not base:
                continue

            if not s.frequency_total or s.frequency_total <= 0:
                continue

            current = s.start_datetime
            count = 0
            while current <= end_date and count < s.frequency_total:
                if current >= start_date:
                    key = (s.id, current)
                    if key in deleted_keys:
                        # Skip if this occurrence is explicitly deleted.
                        pass
                    elif key in exceptions_by_key:
                        # Skip if there's an exception, as it's already in stored_events.
                        pass
                    else:
                        # Create a temporary Schedule object for this dynamic occurrence.
                        composite_id = f"{s.id}-{current.isoformat()}"
                        dynamic_events.append(Schedule(
                            id=composite_id,
                            series=s,
                            title=s.title,
                            datetime=current,
                            duration=base.duration,
                            link=base.link,
                            notes=s.notes,
                            is_exception=False
                        ))
                current = _advance(s, current)
                count += 1
        
        # Combine all events, filter out deleted ones, and sort by datetime.
        all_events = []
        for e in stored_events:
            if e.is_exception and (e.title or "").startswith("DELETED_"):
                continue
            all_events.append(e)
        all_events.extend(dynamic_events)

        all_events.sort(key=lambda x: x.datetime)

        serializer = self.get_serializer(all_events, many=True)
        return Response(serializer.data)

    def create(self, request, *args, **kwargs):
        """Creates a new single or recurring event."""
        data = request.data
        title = data.get('title')
        dt = _parse_dt(data.get('datetime'))
        duration = _parse_duration(data.get('duration'))
        notes = data.get('notes')
        link = data.get('link')
        frequency = data.get('frequency') or 'never'
        frequency_total = data.get('frequency_total')

        if not dt:
            return Response({"error": "Invalid or missing 'datetime'."}, status=status.HTTP_400_BAD_REQUEST)

        # Advance the start date if it falls on a weekend for a workday series.
        if frequency == 'every_work_day':
            while dt.weekday() >= 5:
                dt += timedelta(days=1)

        if frequency != 'never':
            # Create a recurring event series.
            if not frequency_total or int(frequency_total) <= 0:
                return Response({"error": "'frequency_total' must be > 0 for recurring series."},
                                 status=status.HTTP_400_BAD_REQUEST)

            with transaction.atomic():
                # Create the series and the first event instance.
                series = ScheduleSeries.objects.create(
                    title=title,
                    frequency=frequency,
                    frequency_total=int(frequency_total),
                    notes=notes,
                    start_datetime=dt
                )
                base_event = Schedule.objects.create(
                    series=series,
                    title=title,
                    datetime=dt,
                    duration=duration,
                    notes=notes,
                    link=link,
                    is_exception=False
                )
            ser = self.get_serializer(base_event)
            return Response(ser.data, status=status.HTTP_201_CREATED)

        # Create a single, non-recurring event.
        event = Schedule.objects.create(
            title=title,
            datetime=dt,
            duration=duration,
            notes=notes,
            link=link,
            is_exception=False
        )
        ser = self.get_serializer(event)
        return Response(ser.data, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['patch'], url_path='edit')
    @transaction.atomic
    def edit_event(self, request, pk=None):
        """Edits a single event, all events in a series, or all future events.

        Uses the 'edit_type' in the request data to determine the scope of the edit.
        """
        edit_type = request.data.get('edit_type', 'single')
        schedule, series, event_dt = self._get_event_and_series(pk)

        if not schedule:
            return Response({"error": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

        data = request.data.copy()
        data['duration'] = _parse_duration(data.get('duration'))

        if edit_type == 'all':
            # Edit all events in a series.
            if not series:
                return Response({"error": "'all' edit is only for recurring events."},
                                 status=status.HTTP_400_BAD_REQUEST)

            # Update series fields.
            series.title = data.get('title', series.title)
            series.notes = data.get('notes', series.notes)
            series.frequency = data.get('frequency', series.frequency)
            series.frequency_total = data.get('frequency_total', series.frequency_total)
            new_dt = _parse_dt(data.get('datetime')) or event_dt
            offset_hours = new_dt.utcoffset().total_seconds() / 3600
            new_dt = new_dt - timedelta(hours=offset_hours)
            print(new_dt)


            if not new_dt:
                return Response({"error": "Missing or invalid datetime for time update."},
                                 status=status.HTTP_400_BAD_REQUEST)

            date_only = new_dt.date()
            selected_weekday = date_only.weekday()

            series_start = series.start_datetime

            # Adjust the start date for weekly/fortnightly frequencies if the weekday changes.
            if series.frequency in ['weekly', 'fortnightly']:
                current_weekday = series_start.weekday()
                days_to_shift = (selected_weekday - current_weekday) % 7
                new_series_start = series_start + timedelta(days=days_to_shift)
                series.start_datetime = new_series_start.replace(
                    hour=new_dt.hour,
                    minute=new_dt.minute,
                    second=new_dt.second,
                    microsecond=new_dt.microsecond
                )
            else:
                # For other frequencies, just update the time.
                series.start_datetime = series_start.replace(
                    hour=new_dt.hour,
                    minute=new_dt.minute,
                    second=new_dt.second,
                    microsecond=new_dt.microsecond
                )

            series.save()

            # Update all existing event instances in the series.
            for event in Schedule.objects.filter(series=series):
                event_date = event.datetime.date()
                if series.frequency in ['weekly', 'fortnightly']:
                    current_weekday = event_date.weekday()
                    days_to_shift = (selected_weekday - current_weekday) % 7
                    event_date += timedelta(days=days_to_shift)

                event.datetime = datetime.combine(
                    event_date, new_dt.time(), tzinfo=event.datetime.tzinfo
                )
                event.title = data.get('title', event.title)
                event.notes = data.get('notes', event.notes)
                event.duration = data.get('duration', event.duration)
                event.link = data.get('link', event.link)
                event.is_exception = False
                event.save()

            return Response({"status": "All events in the series updated."},
                             status=status.HTTP_200_OK)

        elif edit_type == 'future':
            # Edit all future events by creating a new series.
            if not series:
                return Response({"error": "'future' edit is only for recurring events."}, status=status.HTTP_400_BAD_REQUEST)

            original_series_total = series.frequency_total
            # Shorten the original series to end before the edited event.
            old_count = _count_occurrences_before(series, event_dt)
            series.frequency_total = old_count
            series.save()

            new_title = data.get('title', series.title)
            new_notes = data.get('notes', series.notes)
            new_duration = data.get('duration', schedule.duration)
            new_link = data.get('link', schedule.link)

            new_dt = _parse_dt(data.get('datetime')) or event_dt

            # Calculate the number of events for the new series.
            new_total_occurrences = original_series_total - old_count
            if new_total_occurrences <= 0:
                return Response({"status": "No future events to modify."}, status=status.HTTP_200_OK)

            # Create the new series with the new start date and other updated data.
            new_series = ScheduleSeries.objects.create(
                title=new_title,
                notes=new_notes,
                frequency=series.frequency,
                frequency_total=new_total_occurrences,
                start_datetime=new_dt
            )

            # Create the first event instance for the new series.
            Schedule.objects.create(
                series=new_series,
                datetime=new_dt,
                is_exception=False,
                title=new_title,
                notes=new_notes,
                duration=new_duration,
                link=new_link
            )

            return Response({"status": "Future events updated by creating a new series."}, status=status.HTTP_200_OK)
        
        elif edit_type == 'single':
            # Check if this single event is being converted into a series
            frequency = data.get('frequency', 'never')
            frequency_total = data.get('frequency_total')

            if not series and frequency != 'never' and frequency_total and int(frequency_total) > 0:
                # Create a new series
                new_series = ScheduleSeries.objects.create(
                    title=data.get('title', schedule.title),
                    frequency=frequency,
                    frequency_total=int(frequency_total),
                    notes=data.get('notes', schedule.notes),
                    start_datetime=_parse_dt(data.get('datetime')) or schedule.datetime
                )

                # Attach the event to the new series
                schedule.series = new_series
                schedule.is_exception = False
                schedule.save()

                # Update with any new fields
                serializer = self.get_serializer(schedule, data=data, partial=True)
                serializer.is_valid(raise_exception=True)
                serializer.save()

                return Response(serializer.data, status=status.HTTP_200_OK)

            # Existing logic for editing a single event in a series
            is_base_event = False
            new_datetime_str = data.get('datetime')
            datetime_changed = new_datetime_str and new_datetime_str != schedule.datetime.isoformat()
            if datetime_changed:
                if series:
                    # Create a placeholder at the old datetime to mark it as deleted.
                    deleted_event = Schedule.objects.filter(
                        series=series,
                        datetime=schedule.datetime,
                        title__startswith="DELETED_"
                    ).first()

                    if not deleted_event:
                        Schedule.objects.create(
                            series=series,
                            datetime=schedule.datetime,
                            is_exception=True,
                            duration=timedelta(0),
                            title=f"DELETED_{uuid.uuid4()}"
                        )
                    schedule.series = None
                    schedule.frequency = 'never'
                    new_datetime = datetime.fromisoformat(new_datetime_str)
                    is_base_event = series and series.start_datetime == schedule.datetime

                    # Handle the special case of editing the first event (base event) in a series.
                    if is_base_event:
                        # Find the next event in the series to become the new base event.
                        next_base_event = (
                            Schedule.objects
                            .filter(
                                series=series,
                                datetime__gt=schedule.datetime
                            )
                            .exclude(title__startswith="DELETED_")
                            .order_by('datetime')
                            .first()
                        )

                        if next_base_event:
                            if new_datetime > series.get_end_datetime():
                                # If the edited base event is moved outside the series, detach it.
                                schedule.series = None
                                schedule.is_exception = False
                                
                                # Create a placeholder exception to mark the original date as "deleted".
                                deleted_event = Schedule.objects.filter(
                                    series=series,
                                    datetime=schedule.datetime,
                                    title__startswith="DELETED_"
                                ).first()

                                if deleted_event:
                                    pass
                                else:
                                    Schedule.objects.create(
                                        series=series,
                                        datetime=schedule.datetime,
                                        is_exception=True,
                                        duration=timedelta(0),
                                        title=f"DELETED_{uuid.uuid4()}"
                                    )

                                # The next event in the series becomes the new base.
                                series.start_datetime = next_base_event.datetime
                                series.save()
                                
                            else:
                                # If the edited base event is still within the series, update the series' start date.
                                series.start_datetime = new_datetime
                                series.save()

                                # Mark the current event as an exception.
                                schedule.is_exception = True
                                
                                # The next event becomes the new base.
                                next_base_event.is_exception = False
                                next_base_event.save()
                        else:
                            # If there are no other events, delete the series.
                            schedule.series = None
                            schedule.is_exception = False
                            series.delete()
                    else:
                        # If editing a non-base recurring event, simply mark it as an exception.
                        schedule.is_exception = True
            else:
                # If the datetime didn't change but other fields did, and it's a recurring event, mark it as an exception.
                if series:
                    schedule.is_exception = True
                
            # Update the event with the new data.
            serializer = self.get_serializer(schedule, data=data, partial=True)
            serializer.is_valid(raise_exception=True)
            serializer.save()
            return Response(serializer.data, status=status.HTTP_200_OK)
        
        return Response({"error": "Invalid edit_type."}, status=status.HTTP_400_BAD_REQUEST)

    @action(detail=True, methods=['delete'], url_path='delete')
    @transaction.atomic
    def delete_event(self, request, pk=None):
        """Deletes a single event, all events in a series, or all future events.

        Uses the 'delete_type' in the query parameters to determine the scope of the delete.
        """
        delete_type = request.query_params.get('delete_type', 'single')
        schedule, series, event_dt = self._get_event_and_series(pk)

        if not schedule:
            return Response({"error": "Event not found."}, status=status.HTTP_404_NOT_FOUND)

        if delete_type == 'all':
            # Delete all events in a series.
            if not series:
                return Response({"error": "'all' delete is only for recurring events."}, status=status.HTTP_400_BAD_REQUEST)
            # Delete only non-exception occurrences, keeping the series and its exceptions.
            Schedule.objects.filter(series=series, is_exception=False).delete()
            return Response(status=status.HTTP_204_NO_CONTENT)

        elif delete_type == 'future':
            # Delete all future events in a series.
            if not series:
                return Response({"error": "'future' delete is only for recurring events."}, status=status.HTTP_400_BAD_REQUEST)
            
            # Shorten the series by updating its frequency_total.
            series.frequency_total = _count_occurrences_before(series, event_dt)
            series.save()
            
            # Delete all non-exception future events.
            Schedule.objects.filter(series=series, is_exception=False, datetime__gte=event_dt).delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
            
        else:
            # Single occurrence delete.
            if not series:
                # For a standalone event, just delete it.
                schedule.delete()
            else:
                # For a recurring event, mark the specific occurrence as a "deleted" exception.
                event = Schedule.objects.filter(
                    series=series,
                    datetime=event_dt
                ).exclude(title__startswith="DELETED_").first()

                if event:
                    event.is_exception = True
                    event.title = f"DELETED_{uuid.uuid4()}"
                    event.duration = timedelta(0)
                    event.notes = 'Deleted occurrence'
                    event.link = ''
                    event.save()

            return Response(status=status.HTTP_204_NO_CONTENT)