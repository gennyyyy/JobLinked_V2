import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeading, Panel } from '@/shared/components/design'
import Flash from '@/shared/components/Flash'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'

export default function TabbedProfileLayout({
  pageTitle,
  pageDescription,
  tabs,
  activeTab,
  onTabChange,
  onSubmit,
  saving,
  saveLabel,
  savingLabel,
  showSave = true,
  saveHint,
  status,
  error,
  sidebar,
  children,
}) {
  const activeSection = tabs.find((tab) => tab.value === activeTab) || tabs[0]

  return (
    <>
      <PageHeading title={pageTitle} description={pageDescription} compact />
      <div className="grid items-start gap-4 xl:grid-cols-[1fr_280px]">
        <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-4" noValidate>
          {status && (
            <Flash>{status}</Flash>
          )}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <Tabs value={activeTab} onValueChange={onTabChange} className="gap-0">
            <Panel title={activeSection.title} description={activeSection.description} size="sm">
              <TabsList className="mb-3 h-auto w-full flex-wrap group-data-horizontal/tabs:h-auto">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
                ))}
              </TabsList>
              {children}
            </Panel>
          </Tabs>
          {showSave && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              {saveHint && <p role="status" className="text-xs text-muted-foreground">{saveHint}</p>}
              <Button type="submit" disabled={saving}>
                <Save data-icon="inline-start" />
                {saving ? savingLabel : saveLabel}
              </Button>
            </div>
          )}
        </form>
        {sidebar && <aside className="flex min-w-0 flex-col gap-4">{sidebar}</aside>}
      </div>
    </>
  )
}
