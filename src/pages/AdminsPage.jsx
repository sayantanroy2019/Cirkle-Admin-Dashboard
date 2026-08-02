import PageHeader from '../components/PageHeader'

/**
 * Placeholder for Section 5. It exists now only so the role gate around it is
 * real and testable — reaching this page at all proves the administrative
 * check passed.
 */
export default function AdminsPage() {
  return (
    <>
      <PageHeader
        title="Admins"
        description="Create and manage Cirkle admin accounts."
      />
      <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50/50 px-6 py-16 text-center">
        <p className="text-sm text-gray-500">
          Admin account management lands in Section 5.
        </p>
      </div>
    </>
  )
}
