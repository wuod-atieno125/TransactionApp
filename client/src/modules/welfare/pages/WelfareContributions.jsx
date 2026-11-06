import { useEffect, useMemo, useState } from 'react'
import { FileDown } from 'lucide-react'
import PageHeader from '../../../shared/components/PageHeader.jsx'
import TransactionTable from '../../transactions/components/TransactionTable.jsx'
import {
  createTransaction,
  decideTransactionReversal,
  getTransactionReversalRequests,
  getTransactions,
  reverseTransaction,
} from '../../transactions/services/transactionService.js'
import { formatCurrency } from '../../../shared/utils/formatCurrency.js'
import { getMembers } from '../../members/services/memberService.js'
import useAutoDismiss from '../../../shared/hooks/useAutoDismiss.js'
import WelfareSummary from '../components/WelfareSummary.jsx'
import {
  getRequirements,
  getWelfareBalance,
  getWelfareStatement,
  getWelfareWithdrawals,
  getWelfareWithdrawalExportData,
  getWelfareReversalRequests,
  getWelfareSummary,
  getWelfareWeeklyReport,
  getWelfareMemberReport,
  getWelfareMonthlyReport,
  getWelfareMonthlyMemberReport,
  requestWelfareWithdrawal,
  setRequirement,
  decideWelfareWithdrawal,
  executeWelfareWithdrawal,
  decideWelfareReversal,
} from '../services/welfareApi.jsx'

function formatReportDate(value) {
  if (!value) return '—'
  const dateValue = String(value)
  const date = dateValue.includes('T')
    ? new Date(dateValue)
    : new Date(`${dateValue}T00:00:00Z`)
  return new Intl.DateTimeFormat('en-KE', {
    dateStyle: 'medium',
    timeZone: 'Africa/Nairobi',
  }).format(date)
}

function currentNairobiDate() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Nairobi',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date())
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]))
  return `${values.year}-${values.month}-${values.day}`
}

function currentNairobiMonth() {
  return currentNairobiDate().slice(0, 7)
}

function currentNairobiWeekStart() {
  const date = new Date(`${currentNairobiDate()}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() - date.getUTCDay())
  return date.toISOString().slice(0, 10)
}

function isSunday(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const date = new Date(`${value}T00:00:00Z`)
  return !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value &&
    date.getUTCDay() === 0
}

export default function WelfareTransactionsPage({ user }) {
  const [search, setSearch] = useState('')
  const [transactions, setTransactions] = useState([])
  const [reversalRequests, setReversalRequests] = useState([])
  const [members, setMembers] = useState([])
  const [selectedMemberId, setSelectedMemberId] = useState('')
  const [amount, setAmount] = useState('')
  const [mpesaReference, setMpesaReference] = useState('')
  const [transactionToReverse, setTransactionToReverse] = useState(null)
  const [reversalReason, setReversalReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [membersLoading, setMembersLoading] = useState(false)
  const [reversalRequestsLoading, setReversalRequestsLoading] = useState(true)
  const [reversalBusyId, setReversalBusyId] = useState('')
  const [reversalBusyAction, setReversalBusyAction] = useState('')
  const [saving, setSaving] = useState(false)
  const [reversing, setReversing] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [welfareOverview, setWelfareOverview] = useState({
    balance: null,
    statement: null,
    requirement: null,
    withdrawals: [],
  })
  const [activeSection, setActiveSection] = useState('overview')
  const [fundSummary, setFundSummary] = useState(null)
  const [welfareReversalRequests, setWelfareReversalRequests] = useState([])
  const [weeklyReport, setWeeklyReport] = useState(null)
  const [memberReport, setMemberReport] = useState(null)
  const [monthlyReport, setMonthlyReport] = useState(null)
  const [monthlyMemberReport, setMonthlyMemberReport] = useState(null)
  const [reportCalendarType, setReportCalendarType] = useState('week')
  const [reportMonth, setReportMonth] = useState(currentNairobiMonth)
  const [reportError, setReportError] = useState('')
  const [reportLoading, setReportLoading] = useState(false)
  const [withdrawalForm, setWithdrawalForm] = useState({ amount: '', purpose: '' })
  const [requirementForm, setRequirementForm] = useState({ amount: '', reason: '' })
  const [reportWeek, setReportWeek] = useState(currentNairobiWeekStart)
  const [sectionBusy, setSectionBusy] = useState(false)
  const [exportingReport, setExportingReport] = useState(false)

  useAutoDismiss(error, setError)
  useAutoDismiss(success, setSuccess)
  useAutoDismiss(reportError, setReportError)

  const role = String(user?.role || '').toLowerCase().replace(/\s+/g, '')
  const canRecordPayment = role === 'treasurer'
  const canRequestOwnReversal = ['member', 'chairperson', 'secretary'].includes(role)
  const canViewFund = ['treasurer', 'chairperson', 'secretary'].includes(role)
  const canViewCollectiveBalance = canViewFund || role === 'member'
  const canRequestWithdrawal = role === 'treasurer'
  const canApproveWithdrawal = role === 'chairperson'
  const canExecuteWithdrawal = role === 'treasurer'
  const canSetRequirement = role === 'chairperson'
  const enteredMinimum = Number(requirementForm.amount)
  const currentMinimum = Number(welfareOverview.requirement?.amount)
  const hasMinimumChanged =
    requirementForm.amount.trim() !== '' &&
    Number.isFinite(enteredMinimum) &&
    enteredMinimum > 0 &&
    (!welfareOverview.requirement || enteredMinimum !== currentMinimum)
  const canViewReports = ['treasurer', 'chairperson'].includes(role)
  const canReviewReversals = ['treasurer', 'chairperson'].includes(role)
  const reversalApprovalRequired = canRequestOwnReversal || canRecordPayment
  const reversalReasonRequired = reversalApprovalRequired

  async function generateMonthlyReport() {
    setReportCalendarType('month')
    setReportLoading(true)
    setReportError('')
    setMonthlyReport(null)
    setMonthlyMemberReport(null)
    try {
      const [summary, contributors] = await Promise.all([
        getWelfareMonthlyReport(reportMonth),
        getWelfareMonthlyMemberReport(reportMonth),
      ])
      setMonthlyReport(summary)
      setMonthlyMemberReport(contributors)
    } catch (requestError) {
      setReportError(requestError.message || 'Unable to generate the monthly welfare report.')
    } finally {
      setReportLoading(false)
    }
  }

  async function reloadTransactions() {
    const result = await getTransactions({ limit: 100 })
    setTransactions(result.transactions)
  }

  useEffect(() => {
    let active = true

    getTransactions({ limit: 100 })
      .then(result => {
        if (active) setTransactions(result.transactions)
      })
      .catch(requestError => {
        if (active) setError(requestError.message || 'Unable to load welfare transaction records.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    if (canRecordPayment) {
      getMembers()
        .then(result => {
          if (active) setMembers(result)
        })
        .catch(requestError => {
          if (active) setError(requestError.message || 'Unable to load approved members.')
        })
        .finally(() => {
          if (active) setMembersLoading(false)
        })

      getTransactionReversalRequests()
        .then(result => {
          if (active) setReversalRequests(result)
        })
        .catch(requestError => {
          if (active) {
            setError(requestError.message || 'Unable to load member reversal requests.')
          }
        })
        .finally(() => {
          if (active) setReversalRequestsLoading(false)
        })
    }

    return () => {
      active = false
    }
  }, [canRecordPayment])

  useEffect(() => {
    let active = true

    Promise.allSettled([
      canViewCollectiveBalance ? getWelfareBalance() : Promise.resolve(null),
      getRequirements(),
      canViewFund ? getWelfareWithdrawals() : Promise.resolve([]),
      user?.id ? getWelfareStatement(user.id) : Promise.resolve(null),
    ]).then(([balance, requirements, withdrawals, statement]) => {
      if (!active) return
      const activeRequirement = requirements.status === 'fulfilled'
        ? requirements.value.find(item => !item.ended_at) || requirements.value[0] || null
        : null
      setWelfareOverview({
        balance: balance.status === 'fulfilled' ? balance.value : null,
        requirement: activeRequirement,
        withdrawals: withdrawals.status === 'fulfilled' ? withdrawals.value : [],
        statement: statement.status === 'fulfilled' ? statement.value : null,
      })
      if (canSetRequirement && activeRequirement) {
        setRequirementForm(current => current.amount
          ? current
          : { ...current, amount: String(activeRequirement.amount) })
      }
    })

    return () => {
      active = false
    }
  }, [canSetRequirement, canViewCollectiveBalance, canViewFund, user?.id])

  useEffect(() => {
    let active = true
    const reportRequests = canViewReports && reportCalendarType === 'week'
      ? [
        getWelfareWeeklyReport(reportWeek),
        getWelfareMemberReport(reportWeek),
      ]
      : [Promise.resolve(null), Promise.resolve(null)]
    const requests = [
      canViewFund ? getWelfareSummary() : Promise.resolve(null),
      canReviewReversals ? getWelfareReversalRequests() : Promise.resolve([]),
      ...reportRequests,
    ]

    Promise.allSettled(requests).then(([summary, reversals, primaryReport, contributorReport]) => {
      if (!active) return
      setFundSummary(summary.status === 'fulfilled' ? summary.value : null)
      setWelfareReversalRequests(reversals.status === 'fulfilled' ? reversals.value : [])
      if (reportCalendarType === 'week') {
        const reportFailures = [
          primaryReport.status === 'rejected'
            ? `Unable to load the weekly fund report: ${primaryReport.reason?.message || 'Request failed.'}`
            : '',
          contributorReport.status === 'rejected'
            ? `Unable to load contributor activity: ${contributorReport.reason?.message || 'Request failed.'}`
            : '',
        ].filter(Boolean)
        setReportError(reportFailures.join(' '))
        setWeeklyReport(primaryReport.status === 'fulfilled' ? primaryReport.value : null)
        setMemberReport(contributorReport.status === 'fulfilled' ? contributorReport.value : null)
      }
    })

    return () => {
      active = false
    }
  }, [canViewFund, canReviewReversals, canViewReports, reportCalendarType, reportWeek])

  async function refreshWelfareData() {
    const [balance, requirements, withdrawals, statement] = await Promise.all([
      canViewCollectiveBalance
        ? getWelfareBalance()
        : Promise.resolve(welfareOverview.balance),
      getRequirements(),
      canViewFund ? getWelfareWithdrawals() : Promise.resolve(welfareOverview.withdrawals),
      user?.id ? getWelfareStatement(user.id) : Promise.resolve(null),
    ])
    setWelfareOverview({
      balance,
      requirement: requirements.find(item => !item.ended_at) || requirements[0] || null,
      withdrawals,
      statement,
    })
  }

  async function handleWithdrawalSubmit(event) {
    event.preventDefault()
    setSectionBusy(true)
    try {
      await requestWelfareWithdrawal(withdrawalForm)
      setWithdrawalForm({ amount: '', purpose: '' })
      await refreshWelfareData()
      setSuccess('Welfare withdrawal request submitted for chairperson review.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to submit withdrawal request.')
    } finally {
      setSectionBusy(false)
    }
  }

  async function handleRequirementSubmit(event) {
    event.preventDefault()
    setSectionBusy(true)
    try {
      const requirement = await setRequirement(requirementForm)
      setRequirementForm({ amount: String(requirement.amount), reason: '' })
      await refreshWelfareData()
      setSuccess('The minimum welfare contribution was updated successfully.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to update the welfare requirement.')
    } finally {
      setSectionBusy(false)
    }
  }

  async function handleWithdrawalAction(request, action) {
    setSectionBusy(true)
    try {
      if (action === 'approve') {
        await decideWelfareWithdrawal(request.id, true, '')
      } else {
        if (action === 'reject') {
          await decideWelfareWithdrawal(request.id, false, '')
        } else {
          await executeWelfareWithdrawal(request.id)
        }
      }
      await refreshWelfareData()
      setSuccess(
        action === 'approve'
          ? 'Withdrawal approved.'
          : action === 'reject'
            ? 'Withdrawal rejected.'
            : 'Withdrawal executed.',
      )
    } catch (requestError) {
      setError(requestError.message || 'Unable to update withdrawal request.')
    } finally {
      setSectionBusy(false)
    }
  }

  async function exportWelfareReport(withdrawalsOnly = false) {
    setExportingReport(true)
    setReportError('')
    try {
      const { withdrawals = [], officeHolders = [] } = await getWelfareWithdrawalExportData()
      const reportWithdrawals = withdrawalsOnly
        ? withdrawals.filter(request => request.status === 'executed')
        : withdrawals
      const { jsPDF } = await import('jspdf')
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' })
      const margin = 34
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const tableWidth = pageWidth - margin * 2
      let y = margin

      const formatDateTime = value => value
        ? new Intl.DateTimeFormat('en-KE', {
          dateStyle: 'medium',
          timeStyle: 'short',
          timeZone: 'Africa/Nairobi',
        }).format(new Date(value))
        : '—'
      const cellText = value => String(value ?? '—')
      const addTable = (title, headers, rows, widths) => {
        const titleHeight = 24
        const padding = 5
        const fontSize = 8
        const lineHeight = 10
        const headerFill = [35, 67, 117]
        const bodyFill = [238, 244, 253]
        const drawHeader = () => {
          const prepared = headers.map((header, index) =>
            pdf.splitTextToSize(cellText(header), tableWidth * widths[index] - padding * 2),
          )
          const rowHeight = Math.max(23, ...prepared.map(lines => lines.length * lineHeight + padding * 2))
          pdf.setFillColor(...headerFill)
          pdf.rect(margin, y, tableWidth, rowHeight, 'F')
          let x = margin
          prepared.forEach((lines, index) => {
            const columnWidth = tableWidth * widths[index]
            pdf.setFont('helvetica', 'bold')
            pdf.setFontSize(fontSize)
            pdf.setTextColor(255, 255, 255)
            pdf.text(lines, x + padding, y + padding + fontSize)
            if (index > 0) pdf.line(x, y, x, y + rowHeight)
            x += columnWidth
          })
          y += rowHeight
          return rowHeight
        }
        if (y + titleHeight + 24 > pageHeight - margin) {
          pdf.addPage()
          y = margin
        }
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(12)
        pdf.setTextColor(35, 54, 82)
        pdf.text(title, margin, y + 13)
        y += titleHeight
        drawHeader()

        if (!rows.length) rows = [['No records available', ...Array(headers.length - 1).fill('')]]
        rows.forEach((row, rowIndex) => {
          const prepared = row.map((value, index) =>
            pdf.splitTextToSize(cellText(value), tableWidth * widths[index] - padding * 2),
          )
          const rowHeight = Math.max(22, ...prepared.map(lines => lines.length * lineHeight + padding * 2))
          if (y + rowHeight > pageHeight - margin) {
            pdf.addPage()
            y = margin
            drawHeader()
          }
          if (rowIndex % 2 === 0) {
            pdf.setFillColor(...bodyFill)
            pdf.rect(margin, y, tableWidth, rowHeight, 'F')
          }
          pdf.setDrawColor(205, 215, 229)
          pdf.rect(margin, y, tableWidth, rowHeight)
          let x = margin
          prepared.forEach((lines, index) => {
            const columnWidth = tableWidth * widths[index]
            if (index > 0) pdf.line(x, y, x, y + rowHeight)
            pdf.setFont('helvetica', 'normal')
            pdf.setFontSize(fontSize)
            pdf.setTextColor(36, 48, 65)
            pdf.text(lines, x + padding, y + padding + fontSize)
            x += columnWidth
          })
          y += rowHeight
        })
        y += 14
      }

      const report = reportCalendarType === 'week' ? weeklyReport : monthlyReport
      const reportStart = reportCalendarType === 'week'
        ? report?.weekStart || reportWeek
        : report?.monthStart || `${reportMonth}-01`
      const reportEnd = reportCalendarType === 'week'
        ? report?.weekEnd || ''
        : report?.monthEnd || ''

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(18)
      pdf.setTextColor(24, 45, 76)
      pdf.text(withdrawalsOnly ? 'GCMS Welfare Withdrawal Report' : 'GCMS Welfare Report', margin, y + 16)
      y += 30
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.setTextColor(70, 80, 95)
      if (!withdrawalsOnly) {
        pdf.text(
          `${reportCalendarType === 'week' ? 'Weekly' : 'Monthly'} period: ${formatReportDate(reportStart)}${reportEnd ? ` – ${formatReportDate(reportEnd)}` : ''}`,
          margin,
          y,
        )
        y += 14
      }
      pdf.text(`Exported: ${formatDateTime(new Date().toISOString())}`, margin, y)
      y += 20

      if (!withdrawalsOnly) {
        addTable('Fund summary', ['Metric', 'Value'], reportMetrics.map(metric => [metric.label, metric.value]), [0.7, 0.3])

        const contributionRows = reportCalendarType === 'week'
          ? reportRows.map((item, index) => [
            index + 1,
            item.memberName || 'Unknown contributor',
            item.mpesaReference || '—',
            formatDateTime(item.paidAt),
            formatCurrency(item.amount),
          ])
          : reportRows.map((item, index) => [
            index + 1,
            item.memberName || 'Unknown contributor',
            item.activeTransactionCount || 0,
            formatCurrency(item.activeContributionTotal),
            item.reversedTransactionCount || 0,
            formatCurrency(item.reversedContributionTotal),
          ])
        addTable(
          'Contributor activity',
          reportCalendarType === 'week'
            ? ['#', 'Contributor', 'M-Pesa code', 'Date', 'Amount']
            : ['#', 'Contributor', 'Active records', 'Active amount', 'Reversed records', 'Reversed amount'],
          contributionRows,
          reportCalendarType === 'week'
            ? [0.05, 0.27, 0.2, 0.27, 0.21]
            : [0.05, 0.25, 0.13, 0.2, 0.15, 0.22],
        )
        if (reportCalendarType === 'month') {
          const monthlyPayments = Array.isArray(monthlyMemberReport?.contributions)
            ? monthlyMemberReport.contributions
            : []
          addTable(
            'Monthly payment records',
            ['#', 'Contributor', 'M-Pesa code', 'Date', 'Amount', 'Status'],
            monthlyPayments.map((item, index) => [
              index + 1,
              item.memberName || 'Unknown contributor',
              item.mpesaReference || '—',
              formatDateTime(item.paidAt),
              formatCurrency(item.amount),
              item.status === 'reversed' ? 'Reversed' : 'Received',
            ]),
            [0.05, 0.24, 0.18, 0.25, 0.16, 0.12],
          )
        }
      }

      const withdrawalSummaryRows = reportWithdrawals.map((request, index) => [
        index + 1,
        request.purpose || '—',
        request.requester_name || 'Unknown',
        formatCurrency(request.requested_amount),
        request.status,
        formatDateTime(request.reviewed_at),
        formatDateTime(request.executed_at),
        formatCurrency(request.deducted_amount),
      ])
      addTable(
        withdrawalsOnly ? 'Completed withdrawals' : 'Withdrawal requests',
        ['#', 'Purpose', 'Requested by', 'Requested', 'Status', 'Approved / rejected at', 'Executed at', 'Withdrawn'],
        withdrawalSummaryRows,
        [0.04, 0.2, 0.12, 0.11, 0.09, 0.17, 0.15, 0.12],
      )

      const deductionRows = reportWithdrawals.flatMap((request, index) => {
        const deductions = Array.isArray(request.deductions) ? request.deductions : []
        return deductions.map(deduction => [
          index + 1,
          request.purpose || '—',
          deduction.member_name || 'Unknown member',
          formatCurrency(deduction.amount),
        ])
      })
      addTable(
        'Withdrawal deductions by member',
        ['Request #', 'Purpose', 'Member', 'Amount deducted'],
        deductionRows,
        [0.12, 0.38, 0.3, 0.2],
      )

      const officeHolderRows = officeHolders.map(holder => [
        String(holder.role || 'Office holder').replaceAll('_', ' '),
        holder.full_name || 'Unknown',
        holder.phone || '—',
      ])
      addTable(
        'Office holders',
        ['Position', 'Name', 'Phone number'],
        officeHolderRows,
        [0.28, 0.42, 0.3],
      )
      const period = reportCalendarType === 'week' ? reportWeek : reportMonth
      pdf.save(withdrawalsOnly
        ? `gcms-welfare-withdrawals-${new Date().toISOString().slice(0, 10)}.pdf`
        : `gcms-welfare-${reportCalendarType}-${period}-report.pdf`)
    } catch (requestError) {
      setReportError(requestError.message || 'Unable to export the welfare report.')
    } finally {
      setExportingReport(false)
    }
  }

  async function handleReversalAction(request, decision) {
    setSectionBusy(true)
    try {
      await decideWelfareReversal(request.id, decision, '')
      setWelfareReversalRequests(current => current.filter(item => item.id !== request.id))
      setSuccess(`Reversal request ${decision}.`)
    } catch (requestError) {
      setError(requestError.message || 'Unable to review reversal request.')
    } finally {
      setSectionBusy(false)
    }
  }

  async function handleRecordPayment(event) {
    event.preventDefault()
    setError('')
    setSuccess('')

    const member = members.find(item => item.id === selectedMemberId)
    if (!member) {
      setError('Select an approved member to record this welfare contribution.')
      return
    }

    setSaving(true)
    try {
      await createTransaction({
        memberUserId: member.id,
        enteredMemberName: member.fullName,
        amount: Number(amount),
        mpesaReference: mpesaReference.trim(),
      })
      await reloadTransactions()
      setSelectedMemberId('')
      setAmount('')
      setMpesaReference('')
      setSuccess('Payment recorded. The date and received status were added automatically.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to record welfare contribution.')
    } finally {
      setSaving(false)
    }
  }

  function openReversal(transaction) {
    setError('')
    setSuccess('')
    setReversalReason('')
    setTransactionToReverse(transaction)
  }

  async function handleReverseTransaction(event) {
    event.preventDefault()
    if (!transactionToReverse) return

    setError('')
    setSuccess('')
    setReversing(true)

    try {
      const result = await reverseTransaction(transactionToReverse.id, reversalReason.trim())
      await reloadTransactions()
      setTransactionToReverse(null)
      setReversalReason('')
      setSuccess(result.message || 'Welfare transaction reversal completed.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to reverse this welfare transaction.')
    } finally {
      setReversing(false)
    }
  }

  async function decideMemberReversalRequest(request, decision) {
    setReversalBusyId(request.id)
    setReversalBusyAction(decision)
    setError('')
    setSuccess('')

    try {
      const result = await decideTransactionReversal(request.id, decision)
      setReversalRequests(current => current.filter(item => item.id !== request.id))
      await reloadTransactions()
      setSuccess(result.message || 'Member reversal request reviewed.')
    } catch (requestError) {
      setError(requestError.message || 'Unable to review the welfare reversal request.')
    } finally {
      setReversalBusyId('')
      setReversalBusyAction('')
    }
  }

  const results = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return transactions

    return transactions.filter(transaction =>
      `${transaction.entered_member_name || ''} ${transaction.mpesa_reference || ''}`
        .toLowerCase()
        .includes(term),
    )
  }, [search, transactions])

  const displayedReport = reportCalendarType === 'week' ? weeklyReport : monthlyReport
  const displayedContributorReport = reportCalendarType === 'week' ? memberReport : monthlyMemberReport
  const reportContributors = Array.isArray(displayedContributorReport?.members)
    ? displayedContributorReport.members
    : []
  const reportContributions = Array.isArray(displayedContributorReport?.contributions)
    ? displayedContributorReport.contributions
    : []
  const reportRows = reportCalendarType === 'week' ? reportContributions : reportContributors
  const reportMetrics = reportCalendarType === 'week'
    ? [
        { label: 'Contributions received', value: formatCurrency(weeklyReport?.contributionTotal) },
        { label: 'Contribution records', value: Number(weeklyReport?.transactionCount || 0).toLocaleString('en-KE') },
      ]
    : [
        { label: 'Active contributions', value: formatCurrency(monthlyReport?.activeContributionTotal) },
        { label: 'Active records', value: Number(monthlyReport?.activeTransactionCount || 0).toLocaleString('en-KE') },
        { label: 'Reversed contributions', value: formatCurrency(monthlyReport?.reversedContributionTotal) },
        { label: 'Reversed records', value: Number(monthlyReport?.reversedTransactionCount || 0).toLocaleString('en-KE') },
      ]

  return (
    <>
      <PageHeader
        eyebrow="WELFARE CENTRE"
        title="A shared fund for shared care"
        description="See the health of the welfare fund, your member balance, and the activity keeping our community supported."
      />
      <WelfareSummary {...welfareOverview} balance={welfareOverview.balance || fundSummary} />
      <nav className="welfare-section-tabs" aria-label="Welfare sections">
        {[
          ['overview', 'Overview', true],
          ['contributions', 'Contributions', true],
          ['withdrawals', 'Withdrawals', canViewFund],
          ['reports', 'Reports', canViewReports],
          ['governance', 'Governance', canSetRequirement || canReviewReversals],
        ].filter(([, , visible]) => visible).map(([key, label]) => (
          <button
            className={activeSection === key ? 'active' : ''}
            key={key}
            type="button"
            onClick={() => setActiveSection(key)}
          >
            {label}
          </button>
        ))}
      </nav>
      {activeSection === 'overview' && (
        <section className="welfare-detail-grid">
          <article className="content-card">
            <div className="card-heading"><div><h2>Your welfare statement</h2><p>Your balance and contribution history are private to your account.</p></div></div>
            <strong className="welfare-detail-total">{formatCurrency(welfareOverview.statement?.balance)}</strong>
            <p className="feature-muted">Total contributions: {formatCurrency(welfareOverview.statement?.total_contributions)}</p>
            <button className="secondary-button" type="button" onClick={() => setActiveSection('contributions')}>View contribution activity</button>
          </article>
          {canViewFund && (
            <article className="content-card">
              <div className="card-heading"><div><h2>Fund snapshot</h2><p>Read-only collective fund health.</p></div></div>
              <strong className="welfare-detail-total">{formatCurrency(fundSummary?.active_total || welfareOverview.balance?.balance)}</strong>
              <p className="feature-muted">{fundSummary?.active_count || 0} active contribution records</p>
              <button className="secondary-button" type="button" onClick={() => setActiveSection('reports')}>Open fund reports</button>
            </article>
          )}
        </section>
      )}
      {activeSection === 'withdrawals' && canViewFund && (
        <section className="welfare-detail-grid">
          {canRequestWithdrawal && (
            <form className="content-card feature-form" onSubmit={handleWithdrawalSubmit}>
              <div className="card-heading"><div><h2>Request welfare support</h2><p>Requests are reviewed by the chairperson before execution.</p></div></div>
              <label>Amount (KES)<input className="feature-input" type="number" min="0.01" step="0.01" required value={withdrawalForm.amount} onChange={event => setWithdrawalForm({ ...withdrawalForm, amount: event.target.value })} /></label>
              <label>Purpose<textarea className="feature-textarea" minLength="3" maxLength="1000" required value={withdrawalForm.purpose} onChange={event => setWithdrawalForm({ ...withdrawalForm, purpose: event.target.value })} /></label>
              <button className="primary-button" disabled={sectionBusy} type="submit">{sectionBusy ? 'Submitting…' : 'Submit withdrawal request'}</button>
            </form>
          )}
          <article className="content-card">
            <div className="card-heading"><div><h2>Withdrawal register</h2><p>Track pending, approved, rejected, and executed requests.</p></div></div>
            <div className="welfare-request-list">
              {welfareOverview.withdrawals.length === 0 ? <p className="empty-state">No withdrawal requests yet.</p> : welfareOverview.withdrawals.map(request => (
                <div className="welfare-request" key={request.id}>
                  <div><strong>{formatCurrency(request.requested_amount)}</strong><p>{request.purpose}</p><small>{request.status}</small></div>
                  {canApproveWithdrawal && request.status === 'pending' && (
                    <div className="approval-actions">
                      <button className="secondary-button" type="button" disabled={sectionBusy} onClick={() => handleWithdrawalAction(request, 'reject')}>Reject</button>
                      <button className="primary-button" type="button" disabled={sectionBusy} onClick={() => handleWithdrawalAction(request, 'approve')}>Approve</button>
                    </div>
                  )}
                  {canExecuteWithdrawal && request.status === 'approved' && <button className="primary-button" type="button" disabled={sectionBusy} onClick={() => handleWithdrawalAction(request, 'execute')}>Execute</button>}
                </div>
              ))}
            </div>
          </article>
        </section>
      )}
      {activeSection === 'reports' && canViewReports && (
        <section className="content-card">
          <div className="card-heading">
            <div><h2>Welfare reporting</h2><p>Review weekly fund performance and individual contributor activity.</p></div>
            {role === 'treasurer' && (
              <div className="approval-actions">
                <button className="secondary-button" type="button" onClick={() => exportWelfareReport(false)} disabled={exportingReport || reportLoading || !displayedReport}>
                  <FileDown size={16} />{exportingReport ? 'Creating PDF…' : 'Export full report'}
                </button>
                <button className="secondary-button" type="button" onClick={() => exportWelfareReport(true)} disabled={exportingReport}>
                  <FileDown size={16} />{exportingReport ? 'Creating PDF…' : 'Export withdrawals only'}
                </button>
              </div>
            )}
          </div>
          <div className="welfare-calendar-controls">
            <div className="welfare-calendar-switch" role="group" aria-label="Report calendar type">
              <button
                className={reportCalendarType === 'week' ? 'active' : ''}
                type="button"
                aria-pressed={reportCalendarType === 'week'}
                onClick={() => {
                  setReportError('')
                  setReportCalendarType('week')
                }}
              >
                Weekly
              </button>
              <button
                className={reportCalendarType === 'month' ? 'active' : ''}
                type="button"
                aria-pressed={reportCalendarType === 'month'}
                onClick={() => {
                  generateMonthlyReport()
                }}
              >
                Monthly
              </button>
            </div>
            {reportCalendarType === 'week' ? (
              <label className="welfare-report-date">
                Week starting
                <input className="feature-input" type="date" value={reportWeek} onChange={event => {
                  if (!isSunday(event.target.value)) {
                    setReportError('Choose a Sunday to load the weekly welfare report.')
                    return
                  }
                  setReportError('')
                  setWeeklyReport(null)
                  setMemberReport(null)
                  setReportWeek(event.target.value)
                }} />
                <small>Weekly reports start on Sunday.</small>
              </label>
            ) : (
              <label className="welfare-report-date">
                Choose month
                <input className="feature-input" type="month" value={reportMonth} onChange={event => {
                  setReportError('')
                  setMonthlyReport(null)
                  setMonthlyMemberReport(null)
                  setReportMonth(event.target.value)
                }} />
              </label>
            )}
            {reportCalendarType === 'month' && (
              <button
                className="primary-button"
                type="button"
                onClick={generateMonthlyReport}
                disabled={reportLoading || !reportMonth}
              >
                {reportLoading ? 'Generating…' : 'Generate monthly report'}
              </button>
            )}
          </div>
          {reportError && <p className="app-error" role="alert">{reportError}</p>}
          <section className="welfare-report-summary" aria-label={`${reportCalendarType === 'week' ? 'Weekly' : 'Monthly'} contribution summary`}>
            <div className="welfare-report-heading">
              <div>
                <h3>{reportCalendarType === 'week' ? 'Weekly fund summary' : 'Monthly fund summary'}</h3>
                <p>
                  {displayedReport
                    ? `${formatReportDate(reportCalendarType === 'week' ? displayedReport.weekStart : displayedReport.monthStart)} – ${formatReportDate(reportCalendarType === 'week' ? displayedReport.weekEnd : displayedReport.monthEnd)}`
                    : reportCalendarType === 'week'
                      ? `Week of ${formatReportDate(reportWeek)}`
                      : new Intl.DateTimeFormat('en-KE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(new Date(`${reportMonth}-01T00:00:00Z`))}
                </p>
              </div>
              <span className="feature-pill">Africa/Nairobi</span>
            </div>
            {reportCalendarType === 'month' && reportLoading ? (
              <p className="empty-state" role="status">Generating monthly welfare report…</p>
            ) : displayedReport ? (
              <div className={`welfare-report-metrics${reportCalendarType === 'month' ? ' welfare-report-metrics--monthly' : ''}`}>
                {reportMetrics.map(metric => (
                  <article className="welfare-report-metric" key={metric.label}>
                    <span>{metric.label}</span>
                    <strong>{metric.value}</strong>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-state">No {reportCalendarType === 'week' ? 'weekly' : 'monthly'} fund report is available for this period.</p>
            )}
          </section>
          <section className="welfare-report-members" aria-label={`${reportCalendarType === 'week' ? 'Weekly' : 'Monthly'} contributor activity`}>
            <div className="welfare-report-heading">
              <div>
                <h3>Contributor activity</h3>
                <p>Welfare contributions recorded during the selected {reportCalendarType}.</p>
              </div>
            </div>
            {reportCalendarType === 'month' && reportLoading ? (
              <p className="empty-state" role="status">Loading monthly contributor summary…</p>
            ) : reportRows.length ? (
              <div className="feature-table-wrap">
                <table className="feature-table">
                  <thead>
                    <tr>
                      <th>Contributor</th>
                      {reportCalendarType === 'week' ? (
                        <>
                          <th>M-Pesa code</th>
                          <th>Date</th>
                          <th>Amount</th>
                        </>
                      ) : (
                        <>
                          <th>Active records</th>
                          <th>Active contributed</th>
                          <th>Reversed records</th>
                          <th>Reversed amount</th>
                        </>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {reportRows.map((contributor, index) => (
                      <tr key={contributor.contributionId || contributor.memberUserId || `${contributor.memberName}-${index}`}>
                        <td>{contributor.memberName || 'Unknown contributor'}</td>
                        {reportCalendarType === 'week' ? (
                          <>
                            <td>{contributor.mpesaReference || '—'}</td>
                            <td>{formatReportDate(contributor.paidAt)}</td>
                            <td>{formatCurrency(contributor.amount)}</td>
                          </>
                        ) : (
                          <>
                            <td>{Number(contributor.activeTransactionCount || 0).toLocaleString('en-KE')}</td>
                            <td>{formatCurrency(contributor.activeContributionTotal)}</td>
                            <td>{Number(contributor.reversedTransactionCount || 0).toLocaleString('en-KE')}</td>
                            <td>{formatCurrency(contributor.reversedContributionTotal)}</td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="empty-state">No contributor activity is available for this {reportCalendarType}.</p>
            )}
          </section>
          {reportCalendarType === 'month' && (
            <section className="welfare-report-members" aria-label="Monthly payment records">
              <div className="welfare-report-heading">
                <div>
                  <h3>Monthly payment records</h3>
                  <p>Review every recorded payment for the selected month.</p>
                </div>
              </div>
              {reportLoading ? (
                <p className="empty-state" role="status">Loading monthly payments…</p>
              ) : monthlyMemberReport?.contributions?.length ? (
                <div className="feature-table-wrap">
                  <table className="feature-table">
                    <thead>
                      <tr>
                        <th>Contributor</th>
                        <th>M-Pesa code</th>
                        <th>Date</th>
                        <th>Amount</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyMemberReport.contributions.map(payment => (
                        <tr key={payment.contributionId}>
                          <td>{payment.memberName || 'Unknown contributor'}</td>
                          <td>{payment.mpesaReference || '—'}</td>
                          <td>{formatReportDate(payment.paidAt)}</td>
                          <td>{formatCurrency(payment.amount)}</td>
                          <td>{payment.status === 'reversed' ? 'Reversed' : 'Received'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="empty-state">No payments were recorded during this month.</p>
              )}
            </section>
          )}
        </section>
      )}
      {activeSection === 'governance' && (canSetRequirement || canReviewReversals) && (
        <section className="welfare-detail-grid">
          {canSetRequirement && (
            <form className="content-card feature-form" onSubmit={handleRequirementSubmit}>
              <div className="card-heading"><div><h2>Update minimum contribution</h2><p>Members and office holders may contribute this amount or more.</p></div></div>
              <label>Minimum amount (KES)<input className="feature-input" type="number" min="0.01" step="0.01" required value={requirementForm.amount} onChange={event => setRequirementForm({ ...requirementForm, amount: event.target.value })} /></label>
              <small>
                {welfareOverview.requirement
                  ? `Current minimum: ${formatCurrency(welfareOverview.requirement.amount)}`
                  : 'No minimum has been set yet.'}
              </small>
              <label>Reason<textarea className="feature-textarea" maxLength="1000" value={requirementForm.reason} onChange={event => setRequirementForm({ ...requirementForm, reason: event.target.value })} /></label>
              <button className="primary-button" disabled={sectionBusy || !hasMinimumChanged} type="submit">{sectionBusy ? 'Updating…' : 'Save new minimum'}</button>
            </form>
          )}
          {canReviewReversals && (
            <article className="content-card">
              <div className="card-heading"><div><h2>Reversal review queue</h2><p>Treasurer and chairperson review contribution corrections here.</p></div></div>
              {welfareReversalRequests.length === 0 ? <p className="empty-state">No reversal requests require review.</p> : welfareReversalRequests.map(request => (
                <div className="welfare-request" key={request.id}>
                  <div><strong>{request.entered_member_name}</strong><p>{request.reason}</p><small>{formatCurrency(request.amount)} · {request.status}</small></div>
                  <div className="approval-actions"><button className="secondary-button" type="button" disabled={sectionBusy} onClick={() => handleReversalAction(request, 'rejected')}>Reject</button><button className="primary-button" type="button" disabled={sectionBusy} onClick={() => handleReversalAction(request, 'approved')}>Approve</button></div>
                </div>
              ))}
            </article>
          )}
        </section>
      )}
      {activeSection === 'contributions' && (
        <>
        {canRecordPayment && (
        <section className="content-card payment-entry-card">
          <div className="card-heading">
            <div>
              <h2>Record a welfare contribution</h2>
              <p>Select an approved member or office holder and enter their welfare contribution details.</p>
            </div>
          </div>

          {error && !transactionToReverse && <p className="app-error" role="alert">{error}</p>}
          {success && <p className="account-success" role="status">{success}</p>}

          <form className="account-form payment-entry-form" onSubmit={handleRecordPayment}>
            <label htmlFor="payment-member">
              Approved contributor
              <select
                id="payment-member"
                value={selectedMemberId}
                onChange={event => setSelectedMemberId(event.target.value)}
                required
                disabled={membersLoading || members.length === 0}
              >
                <option value="">
                  {membersLoading ? 'Loading approved contributors…' : 'Select a contributor'}
                </option>
                {members.map(member => (
                  <option key={member.id} value={member.id}>
                    {member.fullName} · {member.role}
                  </option>
                ))}
              </select>
              {!membersLoading && members.length === 0 && (
                <small>No approved contributors are available to select.</small>
              )}
            </label>

            <label htmlFor="payment-amount">
              Amount (KES)
              <input
                id="payment-amount"
                type="number"
                min={welfareOverview.requirement?.amount || '0.01'}
                max="9999999999.99"
                step="0.01"
                value={amount}
                onChange={event => setAmount(event.target.value)}
                required
              />
              {welfareOverview.requirement?.amount && (
                <small>Minimum contribution: {formatCurrency(welfareOverview.requirement.amount)}</small>
              )}
            </label>

            <label htmlFor="payment-mpesa-reference">
              M-Pesa code
              <input
                id="payment-mpesa-reference"
                type="text"
                maxLength={100}
                value={mpesaReference}
                onChange={event => setMpesaReference(event.target.value)}
                required
              />
            </label>

            <p className="payment-entry-meta">
              Payment date is recorded automatically. Status is set to Received by the server.
            </p>

            <button
              className="primary-button"
              type="submit"
              disabled={saving || membersLoading || members.length === 0}
            >
              {saving ? 'Recording welfare contribution…' : 'Record welfare contribution'}
            </button>
          </form>
        </section>
      )}
      {canRecordPayment && (
        <section className="content-card">
          <div className="card-heading">
            <div>
              <h2>Member reversal requests</h2>
              <p>Review the member’s reason. Welfare reversal requests and approvals are available for 12 hours after the record is created.</p>
            </div>
          </div>
          {reversalRequestsLoading ? (
            <p>Loading member reversal requests…</p>
          ) : reversalRequests.length === 0 ? (
            <p className="empty-state">There are no pending member reversal requests.</p>
          ) : (
            <section className="approval-grid">
              {reversalRequests.map(request => (
                <article className="content-card approval-card" key={request.id}>
                  <b>{request.requested_by_name} requested a reversal</b>
                  <p>
                    {request.entered_member_name} · {formatCurrency(request.amount)}
                    {request.mpesa_reference ? ` · ${request.mpesa_reference}` : ''}
                  </p>
                  <div className="deletion-request-reason">
                    <span>MEMBER’S REASON</span>
                    <p>{request.reason}</p>
                  </div>
                  <div className="approval-actions">
                    {request.reversal_allowed === false && (
                      <p className="transaction-action-muted">
                        Reversal window expired after 12 hours.
                      </p>
                    )}
                    <button
                      className="secondary-button"
                      type="button"
                      disabled={request.reversal_allowed === false || reversalBusyId === request.id}
                      onClick={() => decideMemberReversalRequest(request, 'rejected')}
                    >
                      {reversalBusyId === request.id && reversalBusyAction === 'rejected' ? 'Rejecting…' : 'Reject'}
                    </button>
                    <button
                      className="primary-button"
                      type="button"
                      disabled={request.reversal_allowed === false || reversalBusyId === request.id}
                      onClick={() => decideMemberReversalRequest(request, 'approved')}
                    >
                      {reversalBusyId === request.id && reversalBusyAction === 'approved'
                        ? 'Approving…'
                        : request.approval_required ? 'Approve and forward' : 'Approve reversal'}
                    </button>
                  </div>
                </article>
              ))}
            </section>
          )}
        </section>
      )}
      <section className="content-card">
        <div className="toolbar">
          <input
            aria-label="Search welfare transaction records"
            placeholder="Search member or M-Pesa code"
            value={search}
            onChange={event => setSearch(event.target.value)}
          />
        </div>
        {!canRecordPayment && error && <p className="app-error" role="alert">{error}</p>}
        {loading ? <p>Loading welfare transaction records…</p> : (
          <TransactionTable
            rows={results}
            canReverse={canRecordPayment}
            canRequestReversal={canRequestOwnReversal}
            onReverse={openReversal}
          />
        )}
      </section>
      {transactionToReverse && (
        <div className="transaction-reversal-backdrop">
          <section
            className="transaction-reversal-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="transaction-reversal-title"
          >
            <h2 id="transaction-reversal-title">
              {canRequestOwnReversal
                ? 'Request welfare transaction reversal'
                : reversalApprovalRequired ? 'Request welfare reversal approval' : 'Reverse welfare transaction'}
            </h2>
            <p>
              {canRequestOwnReversal
                ? 'Your request and reason will be sent to the treasurer for review.'
                : reversalApprovalRequired
                ? `Request approval to reverse the welfare contribution recorded for ${transactionToReverse.entered_member_name}. Requests and approvals are available for 12 hours after recording.`
                : `Request approval to reverse the welfare contribution recorded for ${transactionToReverse.entered_member_name}? This action will be recorded in the audit log.`}
            </p>
            {reversalReasonRequired && <p className="password-change-hint">Enter a reason of at least 5 characters.</p>}
            {error && <p className="app-error" role="alert">{error}</p>}
            <form onSubmit={handleReverseTransaction}>
              <label htmlFor="transaction-reversal-reason">
                {canRequestOwnReversal
                  ? 'Reason for reversal request'
                  : reversalApprovalRequired
                    ? 'Reason for approval request'
                    : 'Reason for reversal (optional)'}
                <textarea
                  id="transaction-reversal-reason"
                  value={reversalReason}
                  onChange={event => setReversalReason(event.target.value)}
                  minLength={reversalReasonRequired ? 5 : undefined}
                  maxLength={1000}
                  rows={4}
                  required={reversalReasonRequired}
                />
              </label>
              <div className="transaction-reversal-actions">
                <button
                  className="feature-button"
                  type="button"
                  onClick={() => setTransactionToReverse(null)}
                  disabled={reversing}
                >
                  Cancel
                </button>
                <button
                  className="transaction-reverse-button"
                  type="submit"
                  disabled={reversing || (reversalReasonRequired && reversalReason.trim().length < 5)}
                >
                  {reversing
                    ? reversalApprovalRequired ? 'Sending request…' : 'Reversing…'
                    : reversalApprovalRequired ? 'Send approval request' : 'Confirm reversal'}
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
        </>
      )}
    </>
  )
}
