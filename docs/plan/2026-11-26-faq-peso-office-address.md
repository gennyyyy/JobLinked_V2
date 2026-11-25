# FAQ: restore the PESO office address

**Status:** approved by user 2026-11-26. Source: official PESO Santa Maria Facebook pin,
`14.818470214142, 120.95965451912`.

## Problem

The FAQ accordion item "Where is the PESO office and how can I reach them?" opens to
`PesoOfficeInfo`, which only renders a phone number and an email. The question asks *where*,
so the answer is incomplete. The footer "Contact" column is correct as contact-details-only and
must not change.

## Scope

`src/features/public-site/Faq.jsx` — in the `faq-contact` `AccordionContent`, above
`<PesoOfficeInfo className="text-sm" />`, add one address line:

- Text: `Poblacion, Santa Maria, Bulacan 3022`
- Rendered as an anchor to the official pin so the user can open the map:
  `https://www.bing.com/maps/default.aspx?v=2&pc=FACEBK&mid=8100&where1=14.818470214142%2C+120.95965451912&FORM=FBKPL1&name=Poblacion%2C+Santa+Maria%2C+Philippines%2C+3022&mkt=en-GB`
- `target="_blank"` with `rel="noreferrer"`, same `hover:text-primary transition-colors`
  treatment as the existing phone/email anchors.
- Keep the address and the contact details in one block with readable spacing.

Do not add the address to `src/shared/components/PesoOfficeInfo.jsx` — that component also feeds
the footer, which stays contact-only. Do not touch the PESO services page.

## Done when

- Opening "Where is the PESO office and how can I reach them?" shows the address as a map link,
  followed by the phone number and email.
- The footer Contact column still shows only phone + email.
- `npx vitest run src/features/public-site/__tests__/Faq.test.jsx` and `npm run lint` pass.
