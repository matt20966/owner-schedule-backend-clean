# owner_schedule_backend/urls.py
import os
from django.contrib import admin
from django.urls import path, re_path, include
from django.views.static import serve
from django.conf import settings
from todo.views import FrontendAppView
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('todo.urls')),  # <-- all API endpoints under /api/
    # Serve static assets
    re_path(r'^assets/(?P<path>.*)$', serve, {'document_root': os.path.join(settings.BASE_DIR, 'owner_schedule_backend', 'frontend', 'dist', 'assets')}),
    # Catch-all for frontend routes
    re_path(r'^.*$', FrontendAppView.as_view(), name='frontend'),
] + static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)

