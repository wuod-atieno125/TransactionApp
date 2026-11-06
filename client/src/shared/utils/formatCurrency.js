export function formatCurrency(amount, currency = 'KES') {
  return `${currency} ${Number(amount).toLocaleString('en-KE')}`
}
