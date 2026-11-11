import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PageHeading, Panel } from '@/shared/components/design'
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
  saveHint,
  status,
  error,
  sidebar,
  children,
}) {
  const activeSection = tabs.find((tab) => tab.value === activeTab) || tabs[0]

  return (
    <>
      <PageHeading title={pageTitle} description={pageDescription} />
      <div className="grid items-start gap-6 xl:grid-cols-[1fr_280px]">
        <form onSubmit={onSubmit} className="flex min-w-0 flex-col gap-6" noValidate>
          {status && (
            <p role="status" className="rounded-lg border border-success/20 bg-success-soft px-4 py-3 text-xs font-medium text-success">
              {status}
            </p>
          )}
          {error && <p role="alert" className="text-xs text-destructive">{error}</p>}
          <Tabs value={activeTab} onValueChange={onTabChange} className="gap-0">
            <Panel title={activeSection.title} description={activeSection.description}>
              <TabsList className="mb-5 w-full">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value}>{tab.label}</TabsTrigger>
                ))}
              </TabsList>
              {children}
            </Panel>
          </Tabs>
          <div className="flex flex-wrap items-center justify-between gap-3">
            {saveHint && <p role="status" className="text-[11px] text-muted-foreground">{saveHint}</p>}
            <Button type="submit" disabled={saving}>
              <Save data-icon="inline-start" />
              {saving ? savingLabel : saveLabel}
            </Button>
          </div>
        </form>
        {sidebar && <aside className="flex min-w-0 flex-col gap-5">{sidebar}</aside>}
      </div>
    </>
  )
}
