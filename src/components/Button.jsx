import { Link } from 'react-router-dom'
import Spinner from './Spinner'

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60'

const VARIANTS = {
  primary: 'bg-brand text-white hover:bg-brand-dark',
  secondary: 'border border-gray-300 bg-white text-gray-700 hover:bg-gray-50',
  // Deactivating is reversible, so this reads as serious rather than alarming:
  // amber text on a hairline border, not a solid red block.
  caution: 'border border-amber-300 bg-white text-amber-700 hover:bg-amber-50',
}

export default function Button({
  variant = 'primary',
  loading = false,
  disabled,
  className = '',
  to,
  children,
  ...props
}) {
  const classes = `${BASE} ${VARIANTS[variant]} ${className}`

  if (to) {
    return (
      <Link to={to} className={classes} {...props}>
        {children}
      </Link>
    )
  }

  return (
    <button disabled={disabled || loading} className={classes} {...props}>
      {loading && <Spinner />}
      {children}
    </button>
  )
}
