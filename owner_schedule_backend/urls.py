import os
from django.contrib import admin
from django.urls import path, include
# Remove these imports (no longer needed):
# from django.views.static import serve
# from todo.views import FrontendAppView
# from django.conf.urls.static import static  # Optional, but remove if no Django statics needed

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include('todo.urls')),  # All API endpoints under /api/
    # Optional: Add a root view if you want something at / (e.g., a simple API health check)
    # path('', lambda request: JsonResponse({'status': 'API running'}), name='root'),
]
# Remove the + static(...) if not serving Django statics