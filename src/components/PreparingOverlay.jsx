import Spinner from './Spinner'

/**
 * Shown while a HEIC file is being decoded for the crop tool. It's slow enough
 * on a large file (seconds) that silence reads as a freeze.
 */
export default function PreparingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-gray-900/90">
      <Spinner className="size-6 text-white" />
      <span className="text-sm text-gray-200">Preparing photo…</span>
    </div>
  )
}
