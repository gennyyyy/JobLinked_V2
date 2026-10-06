import { describe, it, expect } from 'vitest'
import { mapResumeText } from '../resumeAutofill'

const SAMPLE = `Juan Dela Cruz
Email: juan.delacruz@example.com
Mobile: 09171234567
Birthdate: 1990-05-04
Address: Norzagaray-Santa Maria Road
City: Santa Maria
Province: Bulacan
Postal Code: 3022`

const BLANK = {
  firstName: '',
  middleName: '',
  lastName: '',
  email: '',
  mobileNumber: '',
  birthdate: '',
  houseNumberUnit: '',
  streetAddress: '',
  subdivisionBuilding: '',
  barangayDistrict: '',
  cityMunicipality: '',
  provinceState: '',
  postalCode: '',
  skills: [],
  education: { level: '', school: '', field: '', year: '' },
}

describe('mapResumeText', () => {
  it('maps a full labeled resume', () => {
    expect(mapResumeText(SAMPLE)).toEqual({
      ...BLANK,
      firstName: 'Juan',
      middleName: '',
      lastName: 'Dela Cruz',
      email: 'juan.delacruz@example.com',
      mobileNumber: '09171234567',
      birthdate: '1990-05-04',
      streetAddress: 'Norzagaray-Santa Maria Road',
      cityMunicipality: 'Santa Maria',
      provinceState: 'Bulacan',
      postalCode: '3022',
    })
  })

  it('leaves low-confidence fields blank', () => {
    expect(mapResumeText('Objective: team player seeking growth')).toEqual(BLANK)
  })

  it('normalizes +63 mobiles and Month D, YYYY birthdates', () => {
    const out = mapResumeText('Contact: +639171234567\nBorn: January 5, 1990')
    expect(out.mobileNumber).toBe('09171234567')
    expect(out.birthdate).toBe('1990-01-05')
  })

  it('reads numeric dates as DD/MM (PH convention)', () => {
    expect(mapResumeText('DOB: 05/04/1990').birthdate).toBe('1990-04-05')
    expect(mapResumeText('DOB: 15/03/1995').birthdate).toBe('1995-03-15')
    expect(mapResumeText('DOB: 99/99/1990').birthdate).toBe('')
    expect(mapResumeText('Birthdate: 1990-99-99').birthdate).toBe('')
  })

  it('prefers the labeled birthdate over an earlier unlabeled date', () => {
    expect(mapResumeText('Contract ends 2024-12-31\nJoined 2019-06-01\nDOB: 15/03/1995').birthdate).toBe('1995-03-15')
  })

  it('returns blanks for empty input', () => {
    expect(mapResumeText('')).toEqual(BLANK)
  })

  it('parses Last, First comma names', () => {
    const out = mapResumeText('Dela Cruz, Juan\njuan@example.com')
    expect(out.firstName).toBe('Juan')
    expect(out.middleName).toBe('')
    expect(out.lastName).toBe('Dela Cruz')
  })

  it('keeps compound surnames together with a middle name', () => {
    const out = mapResumeText('Juan Santos Dela Cruz\njuan@example.com')
    expect(out).toMatchObject({ firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz' })
    const plain = mapResumeText('Juan Santos Cruz\njuan@example.com')
    expect(plain).toMatchObject({ firstName: 'Juan', middleName: 'Santos', lastName: 'Cruz' })
  })

  it('keeps double first names together', () => {
    expect(mapResumeText('Mary Ann Reyes\nmary@example.com')).toMatchObject({ firstName: 'Mary Ann', middleName: '', lastName: 'Reyes' })
    expect(mapResumeText('Mary Ann Santos Reyes\nmary@example.com')).toMatchObject({ firstName: 'Mary Ann', middleName: 'Santos', lastName: 'Reyes' })
    expect(mapResumeText('Mary Ann Dela Cruz\nmary@example.com')).toMatchObject({ firstName: 'Mary Ann', middleName: '', lastName: 'Dela Cruz' })
    expect(mapResumeText('John Paul Cruz\njohn@example.com')).toMatchObject({ firstName: 'John Paul', middleName: '', lastName: 'Cruz' })
    expect(mapResumeText('Mary Ann Santos De La Cruz\nmary@example.com')).toMatchObject({ firstName: 'Mary Ann', middleName: 'Santos', lastName: 'De La Cruz' })
  })

  it('handles Ana Marie / Juan Carlos / Jose Rizal doubles, leaves Santos middles alone', () => {
    expect(mapResumeText('Ana Marie Cruz\nana@example.com')).toMatchObject({ firstName: 'Ana Marie', middleName: '', lastName: 'Cruz' })
    expect(mapResumeText('Juan Carlos Dela Cruz\njc@example.com')).toMatchObject({ firstName: 'Juan Carlos', middleName: '', lastName: 'Dela Cruz' })
    expect(mapResumeText('Jose Rizal Cruz\njose@example.com')).toMatchObject({ firstName: 'Jose Rizal', middleName: '', lastName: 'Cruz' })
    expect(mapResumeText('Juan Santos Cruz\njuan@example.com')).toMatchObject({ firstName: 'Juan', middleName: 'Santos', lastName: 'Cruz' })
  })

  it('skips resume headers when scanning for a name', () => {
    const out = mapResumeText('CURRICULUM VITAE\nJuan Dela Cruz\njuan@example.com')
    expect(out.firstName).toBe('Juan')
    expect(out.lastName).toBe('Dela Cruz')
  })

  it('strips Jr/Sr/II/III suffixes from names', () => {
    const out = mapResumeText('Juan Santos Dela Cruz Jr.\njuan@example.com')
    expect(out).toMatchObject({ firstName: 'Juan', middleName: 'Santos', lastName: 'Dela Cruz' })
  })

  it('splits trailing-zip addresses right-to-left', () => {
    const out = mapResumeText('Juan Dela Cruz\nBlk 5 Lot 12 Sampaguita Street, Santa Maria, Bulacan 3022')
    expect(out).toMatchObject({
      houseNumberUnit: '',
      streetAddress: 'Blk 5 Lot 12 Sampaguita Street',
      cityMunicipality: 'Santa Maria',
      provinceState: 'Bulacan',
      postalCode: '3022',
    })
  })

  it('never mistakes a birth year for a postal code', () => {
    const out = mapResumeText('Juan Dela Cruz\nBorn: January 5, 1990')
    expect(out.postalCode).toBe('')
    expect(out.birthdate).toBe('1990-01-05')
  })

  it('fills barangay from Brgy-anchored lines, never street', () => {
    const out = mapResumeText('Juan Dela Cruz\nBrgy. Pulong Buhangin\nSanta Maria, Bulacan 3022')
    expect(out).toMatchObject({
      streetAddress: '',
      barangayDistrict: 'Pulong Buhangin',
      cityMunicipality: 'Santa Maria',
      provinceState: 'Bulacan',
      postalCode: '3022',
    })
  })

  it('splits barangay segment out of trailing-zip lines', () => {
    const out = mapResumeText('Juan Dela Cruz\nBlk 5 Lot 12 Sampaguita St, Brgy. Pulong Buhangin, Santa Maria, Bulacan 3022')
    expect(out).toMatchObject({
      barangayDistrict: 'Pulong Buhangin',
      cityMunicipality: 'Santa Maria',
      provinceState: 'Bulacan',
      postalCode: '3022',
    })
    expect(out.streetAddress).toContain('Sampaguita')
  })

  it('splits house/unit and subdivision segments when unambiguous', () => {
    const out = mapResumeText('Juan Dela Cruz\nUnit 402, Sampaguita Street, Santa Maria, Bulacan 3022')
    expect(out.houseNumberUnit).toBe('Unit 402')
    const sub = mapResumeText('Juan Dela Cruz\nGreenview Subdivision, Santa Maria, Bulacan 3022')
    expect(sub.subdivisionBuilding).toContain('Greenview')
  })

  it('extracts skills from a Skills section, deduped', () => {
    const out = mapResumeText('Juan Dela Cruz\nSkills: Data Entry, communication, DATA ENTRY\n• Teamwork')
    expect(out.skills).toEqual(['Data Entry', 'communication', 'Teamwork'])
  })

  it('caps skills at 20', () => {
    const many = Array.from({ length: 25 }, (_, i) => `Skill${i}`).join(', ')
    const out = mapResumeText(`Skills: ${many}`)
    expect(out.skills).toHaveLength(20)
  })

  it('matches synonym headers like Expertise', () => {
    const out = mapResumeText('Juan Dela Cruz\nExpertise: Welding, Cooking, Driving')
    expect(out.skills).toEqual(expect.arrayContaining(['Welding', 'Cooking', 'Driving']))
  })

  it('splits sentence lines on and/& inside a section', () => {
    const out = mapResumeText('Juan Dela Cruz\nSkills:\nProficient in Cooking and Driving')
    expect(out.skills).toEqual(expect.arrayContaining(['Cooking', 'Driving']))
  })

  it('finds gazetteer skills mentioned outside any section', () => {
    const out = mapResumeText('Juan Dela Cruz\nProficient in Microsoft Excel and driving.')
    expect(out.skills).toEqual(expect.arrayContaining(['Microsoft Excel', 'driving']))
  })

  it('leaves skills blank when none are found', () => {
    expect(mapResumeText(SAMPLE).skills).toEqual([])
  })

  it('hits expanded gazetteer terms (tech/trade/NC II)', () => {
    const out = mapResumeText('Juan Dela Cruz\nProficient in JavaScript, React, Photoshop, Canva and SAP. Skilled in Welding SMAW and Cookery NC II.')
    expect(out.skills.map((s) => s.toLowerCase())).toEqual(
      expect.arrayContaining(['javascript', 'react', 'photoshop', 'canva', 'sap', 'welding smaw', 'cookery nc ii'])
    )
  })

  it('splits pipe- and slash-separated skills', () => {
    const out = mapResumeText('Juan Dela Cruz\nSkills: Welding | Driving / Cooking')
    expect(out.skills).toEqual(expect.arrayContaining(['Welding', 'Driving', 'Cooking']))
  })

  it('ignores compound header remainder like Skills / Expertise', () => {
    const out = mapResumeText('Juan Dela Cruz\nSkills / Expertise\nWelding')
    expect(out.skills.map((s) => s.toLowerCase())).not.toContain('expertise')
    expect(out.skills).toEqual(expect.arrayContaining(['Welding']))
  })

  it('does not break a skills run on ALL_CAPS lines', () => {
    const out = mapResumeText('Juan Dela Cruz\nSkills:\nTEAMWORK\nWELDING\nCommunication')
    expect(out.skills.map((s) => s.toLowerCase())).toEqual(
      expect.arrayContaining(['teamwork', 'welding', 'communication'])
    )
  })

  it('reassembles a wrapped, unlabeled address (zip before province)', () => {
    const out = mapResumeText(
      'HANS PALAD\nblk. 17 lot 21, abarca\nstreet, cityland, Pulong\nBuhangin, Sta Maria, 3017,\nBulacan, Philippines\nP R O G R A M M I N G',
    )
    expect(out).toMatchObject({
      houseNumberUnit: 'blk. 17 lot 21',
      subdivisionBuilding: 'cityland',
      barangayDistrict: 'Pulong Buhangin',
      cityMunicipality: 'Sta Maria',
      provinceState: 'Bulacan',
      postalCode: '3017',
    })
    expect(out.streetAddress).toBe('abarca street')
  })

  it('reads only the highest attainment, even when it sits above the heading', () => {
    const out = mapResumeText(
      'HANS PALAD\nCORNELIA M. DE JESUS MEMORIAL\nSCHOOL (GRADE 1 - 6)\nMATER DEI ACADEMY (GRADE 7 - 9)\nPULONG BUHANGIN NATIONAL HIGH\nSCHOOL (GRADE 10)\nMATER DEI ACADEMY (GRADE 11 - 12)\nBSIT PUP SANTA MARIA (2023 - Present)\nE D U C A T I O N   H I S T O R Y',
    )
    expect(out.education).toEqual({ level: 'College', school: 'PUP SANTA MARIA', field: 'BSIT', year: '2023' })
  })

  it('leaves education blank when the resume has none', () => {
    expect(mapResumeText('Juan Dela Cruz\nEmail: juan@example.com').education).toEqual({
      level: '', school: '', field: '', year: '',
    })
  })

  it('reads a letter-spaced skills header from a designed PDF', () => {
    const out = mapResumeText(
      'HANS PALAD\nP R O G R A M M I N G\nL A N G U A G E\nPython\nJavaScript\nTailwind\nP E R S O N A L\nI N F O R M A T I O N\nNAME: HANS PALAD',
    )
    expect(out.skills).toEqual(expect.arrayContaining(['Python', 'JavaScript', 'Tailwind']))
  })
})
