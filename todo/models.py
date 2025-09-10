from django.db import models
import uuid
from datetime import timedelta

# Frequency choices
FREQUENCY_CHOICES = [
    ('never', 'Never'),
    ('daily', 'Daily'),
    ('every_work_day', 'Every Work Day (Mon-Fri)'),
    ('weekly', 'Weekly'),
    ('fortnightly', 'Fortnightly'),
]

class ScheduleSeries(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    title = models.CharField(max_length=255)
    frequency = models.CharField(max_length=50, choices=FREQUENCY_CHOICES, default="never")
    frequency_total = models.IntegerField(blank=True, null=True)  # Number of repeats
    notes = models.TextField(blank=True, null=True)
    start_datetime = models.DateTimeField(null=True, blank=True)  # Original start datetime

    def __str__(self):
        return f"{self.title} ({self.frequency})"

class Schedule(models.Model):
    title = models.CharField(max_length=255, blank=True, null=True)
    id = models.AutoField(primary_key=True)
    series = models.ForeignKey(
        ScheduleSeries,
        on_delete=models.CASCADE,
        related_name='events',
        blank=True,
        null=True
    )
    datetime = models.DateTimeField()
    duration = models.DurationField(blank=True, null=True)
    link = models.URLField(blank=True, null=True)
    notes = models.TextField(blank=True, null=True)
    is_exception = models.BooleanField(default=False)

    def __str__(self):
        return f"{self.datetime} - {self.title or 'No Title'}"

    # -----------------------------
    # Edit methods
    # -----------------------------
    def update_single(self, **fields):
        """Edit only this occurrence."""
        for key, value in fields.items():
            setattr(self, key, value)
        self.save()

    @staticmethod
    def update_all(series, **fields):
        """Edit all events in a series, including exceptions."""
        Schedule.objects.filter(series=series).update(**fields)

    @staticmethod
    def update_future(series, from_datetime, **fields):
        """Edit all events in a series from a given datetime forward."""
        Schedule.objects.filter(series=series, datetime__gte=from_datetime).update(**fields)

    # -----------------------------
    # Delete methods
    # -----------------------------
    def delete_single(self):
        """
        Deletes a single occurrence.
        If part of a series, create a 'deleted exception' placeholder.
        """
        if self.series and not self.is_exception:
            Schedule.objects.create(
                title=f"DELETED_{self.title or 'Event'}",
                datetime=self.datetime,
                series=self.series,
                notes="This event was deleted.",
                is_exception=True
            )
        self.delete()

    @staticmethod
    def delete_all(series):
        """Delete all events in a series."""
        Schedule.objects.filter(series=series).delete()

    @staticmethod
    def delete_future(series, from_datetime):
        """Delete all events in a series from a given datetime forward."""
        Schedule.objects.filter(series=series, datetime__gte=from_datetime).delete()
