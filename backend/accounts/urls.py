from django.urls import path
from .views import (
    LoginView, MeView, AdminDashboardView, AdminUsersView, AdminUserReportView, AdminDeleteUserView,
    AdminActivityView, AdminExportUsersView, AdminExportActivityView,
    AdminExportSearchesView, AdminExportUserReportView, AdminContentView, AdminDeleteContentView,
    AdminSitesView, AdminSystemView, AdminExportAllView, AdminAIUsageView,
    ChangePasswordView, PasswordResetRequestView, PasswordResetConfirmView, AdminResetPasswordView, AdminUserBudgetView,
)

urlpatterns = [
    path("login/", LoginView.as_view()),
    path("me/", MeView.as_view()),
    path("password/change/", ChangePasswordView.as_view()),
    path("password/reset/request/", PasswordResetRequestView.as_view()),
    path("password/reset/confirm/", PasswordResetConfirmView.as_view()),
    path("admin/dashboard/", AdminDashboardView.as_view()),
    path("admin/users/", AdminUsersView.as_view()),
    path("admin/users/<int:user_id>/report/", AdminUserReportView.as_view()),
    path("admin/users/<int:user_id>/", AdminDeleteUserView.as_view()),
    path("admin/users/<int:user_id>/password/", AdminResetPasswordView.as_view()),
    path("admin/users/<int:user_id>/budget/", AdminUserBudgetView.as_view()),
    path("admin/activity/", AdminActivityView.as_view()),
    path("admin/content/", AdminContentView.as_view()),
    path("admin/content/<int:content_id>/", AdminDeleteContentView.as_view()),
    path("admin/sites/", AdminSitesView.as_view()),
    path("admin/system/", AdminSystemView.as_view()),
    path("admin/ai-usage/", AdminAIUsageView.as_view()),
    path("admin/export/users/", AdminExportUsersView.as_view()),
    path("admin/export/activity/", AdminExportActivityView.as_view()),
    path("admin/export/searches/", AdminExportSearchesView.as_view()),
    path("admin/export/user-report/", AdminExportUserReportView.as_view()),
    path("admin/export/all/", AdminExportAllView.as_view()),
]
