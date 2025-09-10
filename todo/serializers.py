from rest_framework import serializers
from .models import Schedule, ScheduleSeries

class ScheduleSeriesSerializer(serializers.ModelSerializer):
    class Meta:
        model = ScheduleSeries
        fields = '__all__'

class ScheduleSerializer(serializers.ModelSerializer):
    # Use CharField for IDs because some events have string-based series IDs
    id = serializers.CharField()
    
    series = ScheduleSeriesSerializer(read_only=True)
    
    # Allow null for duration if it's not set
    #duration = serializers.DurationField(allow_null=True)

    class Meta:
        model = Schedule
        fields = '__all__'
