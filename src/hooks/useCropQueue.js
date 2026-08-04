import { useCallback, useEffect, useRef, useState } from 'react'
import { decodeForCrop } from '../lib/crop'

/**
 * The pick → decode → crop queue, shared by the banner and gallery uploaders so
 * the subtle bits below only exist once.
 *
 * Files are cropped **sequentially**: they go into a queue, the cropper opens
 * for one at a time, and confirm or cancel advances it. Never N croppers.
 *
 * The "am I currently preparing a file" flag is a `useRef`, not state, because
 * flipping a state value re-runs the effect and orphans the in-flight decode —
 * which shows up as a spinner that never goes away. The separate `preparing`
 * state exists only to drive the overlay. This looks redundant until you
 * remove it.
 */
export default function useCropQueue() {
  const [queue, setQueue] = useState([])
  const [cropSrc, setCropSrc] = useState(null)
  const [preparing, setPreparing] = useState(false)
  const [error, setError] = useState('')

  const preparingRef = useRef(false)

  useEffect(() => {
    if (cropSrc || preparingRef.current || queue.length === 0) return
    preparingRef.current = true
    setPreparing(true)
    setError('')
    decodeForCrop(queue[0])
      .then((blob) => setCropSrc(URL.createObjectURL(blob)))
      .catch((err) => {
        setError(err.message || 'Could not read this image.')
        setQueue((q) => q.slice(1)) // skip the bad file
      })
      .finally(() => {
        preparingRef.current = false
        setPreparing(false)
      })
  }, [queue, cropSrc])

  /** Drop the current crop source and move to the next queued file. */
  const advance = useCallback(() => {
    setCropSrc((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setQueue((q) => q.slice(1))
  }, [])

  const enqueue = useCallback((files) => {
    setError('')
    setQueue((q) => [...q, ...files])
  }, [])

  // A cropper left open on unmount would leak its source URL.
  const cropSrcRef = useRef(null)
  cropSrcRef.current = cropSrc
  useEffect(
    () => () => {
      if (cropSrcRef.current) URL.revokeObjectURL(cropSrcRef.current)
    },
    [],
  )

  return { cropSrc, preparing, error, setError, enqueue, advance }
}
