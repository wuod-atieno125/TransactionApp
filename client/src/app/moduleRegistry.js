import ApprovalsPage from '../modules/approvals/pages/ApprovalsPage.jsx'
import AuditLogPage from '../modules/audit/pages/AuditLogPage.jsx'
import DashboardPage from '../modules/dashboard/pages/DashboardPage.jsx'
import GroupRulesPage from '../modules/group-rules/pages/GroupRulesPage.jsx'
import MeetingMinutesPage from '../modules/meetings/pages/MeetingMinutesPage.jsx'
import MeetingsPage from '../modules/meetings/pages/MeetingsPage.jsx'
import MembersPage from '../modules/members/pages/MembersPage.jsx'
import NotificationsPage from '../modules/notifications/pages/NotificationsPage.jsx'
import ReportsPage from '../modules/reports/pages/ReportsPage.jsx'
import SettingsPage from '../modules/members/pages/SettingsPage.jsx'
import TechnicalAdminPage from '../modules/technical-administration/pages/TechnicalAdminPage.jsx'
import WelfareTransactionsPage from '../modules/welfare/pages/WelfareContributions.jsx'
import FinesPage from "../modules/fines/pages/FinesPage.jsx";

export const moduleRegistry = {
  dashboard: DashboardPage,
  welfareContributions: WelfareTransactionsPage,
  members: MembersPage,
  approvals: ApprovalsPage,
  reports: ReportsPage,
  settings: SettingsPage,
  groupRules: GroupRulesPage,
  meetings: MeetingsPage,
  minutes: MeetingMinutesPage,
  notifications: NotificationsPage,
  technicalAdmin: TechnicalAdminPage,
  auditLog: AuditLogPage,
  fines: FinesPage,
}
