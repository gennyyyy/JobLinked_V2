import heroBg from '../../assets/hero-bg.jpg'

// Shared background treatment for every auth screen (login, registration,
// recovery). The gradient keeps form text readable over the photo.
export const AUTH_BG_CLASS = 'bg-muted/60 bg-cover bg-center'
export const AUTH_BG_STYLE = {
  backgroundImage: `linear-gradient(180deg, rgba(247,250,255,0.72) 0%, rgba(247,250,255,0.60) 100%), url(${heroBg})`,
}
