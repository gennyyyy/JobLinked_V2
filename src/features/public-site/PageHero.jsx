import landingBg from '@/assets/landing_page_bg.png'

export default function PageHero({ title, description }) {
  return (
    <header className="page-hero bg-cover bg-center border-b border-border" style={{ backgroundImage: `linear-gradient(180deg, rgba(247,250,255,0.88) 0%, rgba(247,250,255,0.72) 100%), url(${landingBg})` }}>
      <div className="page-container py-14 md:py-16">
        <h1 className="display-heading text-navy">{title}</h1>
        {description && (
          <p className="mt-5 max-w-xl text-sm leading-7 text-muted-foreground md:text-base">{description}</p>
        )}
      </div>
    </header>
  )
}
