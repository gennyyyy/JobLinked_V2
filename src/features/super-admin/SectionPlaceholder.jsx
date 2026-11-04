import { EmptyState, PageHeading } from '@/shared/components/design'

export default function SectionPlaceholder({ title, description }) {
  return (
    <>
      <PageHeading eyebrow="PESO Admin" title={title} description={description} />
      <EmptyState
        title="This section is not connected yet."
        description="The API for this workspace section has not been wired into this build. The sidebar item is kept so the navigation matches the reference design."
      />
    </>
  )
}
