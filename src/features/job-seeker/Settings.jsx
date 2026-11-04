import AccountSettings from '@/shared/components/AccountSettings'
import ChangePassword from '@/shared/components/ChangePassword'

export default function Settings() {
  return (
    <>
      <AccountSettings />
      <div className="mt-6">
        <ChangePassword />
      </div>
    </>
  )
}
